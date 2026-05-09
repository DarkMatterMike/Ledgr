/**
 * ledgr – backend/worker.js
 *
 * Background worker: runs scheduled jobs only.
 * No HTTP server, no Express — just cron + DB.
 *
 * Deploy as a separate Railway service pointing at this file:
 *   Start command: node backend/worker.js
 *
 * The web service (server.js) should have no cron jobs at all.
 * This separation means sync jobs never compete with user-facing requests.
 */

"use strict";

const cron = require("node-cron");
const dotenv = require("dotenv");

dotenv.config();

const {
  pool,
  initDB,
  getData,
  setData,
  getItemsForUser,
  syncItemTransactions,
  applySyncResultsToDB,
  sendPushToUser,
  emailTrialExpiring,
} = require("./db");

/* ── Hourly: trial expiry + cleanup ──────────────────────────────── */
cron.schedule("0 * * * *", async () => {
  const now = Date.now();
  console.log(`[worker] ${new Date().toISOString()} — hourly check`);
  try {
    // Expire trials that have ended
    const expired = await pool.query(`
      UPDATE users SET subscription_status = 'expired'
      WHERE subscription_status = 'trialing' AND trial_ends_at < $1
      RETURNING id, email
    `, [now]);
    for (const u of expired.rows) {
      console.log(`[worker] Trial expired: ${u.email}`);
    }

    // Send "trial ending tomorrow" emails — only once per user
    // Uses a DB flag so exactly one email is sent regardless of how many times the cron runs
    const expiringSoon = await pool.query(`
      SELECT id, email, trial_ends_at FROM users
      WHERE subscription_status = 'trialing'
        AND trial_ends_at BETWEEN $1 AND $2
        AND (metadata->>'trial_expiry_email_sent') IS NULL
    `, [now + 20 * 60 * 60 * 1000, now + 28 * 60 * 60 * 1000]);
    for (const u of expiringSoon.rows) {
      await emailTrialExpiring(u.email, 1).catch(() => {});
      // Mark as sent so we never send it again
      await pool.query(
        `UPDATE users SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"trial_expiry_email_sent": true}'::jsonb WHERE id = $1`,
        [u.id]
      );
      console.log(`[worker] Sent trial expiring email to ${u.email}`);
    }

    // Clean up expired/used password reset tokens older than 24 hours
    await pool.query(`
      DELETE FROM password_resets
      WHERE used = TRUE OR expires_at < $1
    `, [now - 24 * 60 * 60 * 1000]);

    // Clear expired account lockouts
    await pool.query(`
      UPDATE users SET failed_login_attempts = 0, locked_until = NULL
      WHERE locked_until IS NOT NULL AND locked_until < $1
    `, [now]);

  } catch (e) { console.error("[worker] Hourly check failed:", e.message); }
});

/* ── Every 4 hours: sync active users ────────────────────────────── */
cron.schedule("0 */4 * * *", async () => {
  console.log(`[worker] ${new Date().toISOString()} — syncing active users`);
  try {
    const { rows } = await pool.query(`
      SELECT id FROM users
      WHERE role = 'owner'
         OR subscription_status = 'active'
         OR (subscription_status = 'trialing' AND trial_ends_at > $1)
    `, [Date.now()]);

    for (const { id: userId } of rows) {
      try {
        const items = await getItemsForUser(userId);
        if (!items.length) continue;

        // ── Guardrail: flag users with large transaction counts ──────
        const { rows: countRows } = await pool.query(
          `SELECT COUNT(*) FROM transactions WHERE user_id = $1`, [userId]
        );
        const txnCount = parseInt(countRows[0].count, 10);
        if (txnCount > 5000) {
          console.warn(`[guardrail] high transaction count  user=${userId}  count=${txnCount}`);
        }

        // ── Time the sync so slow runs are visible in logs ───────────
        const syncStart = Date.now();
        const { added, modified, removed } = await syncItemTransactions(userId);
        const result = await applySyncResultsToDB(userId, added, modified, removed);
        const syncMs = Date.now() - syncStart;

        console.log(`[worker] ${userId}: +${result.added} added, ${result.modified} modified, ${result.removed} removed  (${syncMs}ms)`);

        if (syncMs > 15000) {
          console.warn(`[guardrail] slow sync  user=${userId}  duration=${syncMs}ms  items=${items.length}`);
        }

        if (result.added > 0) {
          const examples = result.newTxns.slice(0, 2).map(t => t.merchant || t.name).join(", ");
          await sendPushToUser(userId, {
            title: `ledgr. — ${result.added} new transaction${result.added !== 1 ? "s" : ""}`,
            body:  examples || `${result.added} new transaction${result.added !== 1 ? "s" : ""} synced`,
            url:   "/",
          });
        }

        // ── Duplicate detection ──────────────────────────────────────
        if (result.added > 0) {
          try {
            const { rows: txns } = await pool.query(
              `SELECT id, amount, date, name, merchant_name, pending, fingerprint
               FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 500`,
              [userId]
            );
            // Detect duplicates: same amount + merchant within a 5-day window
            let dupCount = 0;
            const paired = new Set();
            for (let i = 0; i < txns.length; i++) {
              if (paired.has(txns[i].id)) continue;
              const a = txns[i];
              const amtA = Math.round(Math.abs(a.amount) * 100);
              const nameA = (a.merchant_name || a.name || "").toLowerCase().trim();
              const dateA = new Date(a.date).getTime();
              for (let j = i + 1; j < txns.length; j++) {
                if (paired.has(txns[j].id)) continue;
                const b = txns[j];
                const amtB = Math.round(Math.abs(b.amount) * 100);
                const nameB = (b.merchant_name || b.name || "").toLowerCase().trim();
                const dateB = new Date(b.date).getTime();
                const daysDiff = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);
                if (amtA === amtB && nameA === nameB && daysDiff <= 5) {
                  dupCount++;
                  paired.add(a.id);
                  paired.add(b.id);
                  break;
                }
              }
            }
            if (dupCount > 0) {
              await setData(userId, "pendingDuplicates", { count: dupCount, detectedAt: Date.now() });
              await sendPushToUser(userId, {
                title: `ledgr. — ${dupCount} possible duplicate${dupCount !== 1 ? "s" : ""} found`,
                body:  "Tap to review your transactions",
                url:   "/?openDuplicates=true",
              });
              console.log(`[worker] ${userId}: ${dupCount} duplicate pairs detected`);
            } else {
              // Clear any existing duplicate alert if none found
              await setData(userId, "pendingDuplicates", null);
            }
          } catch (e) { console.error(`[worker] Dup detection failed for ${userId}:`, e.message); }
        }
      } catch (err) { console.error(`[worker] Failed for user ${userId}:`, err.message); }
    }
  } catch (err) { console.error("[worker] Sync failed:", err.message); }
});

/* ── Startup ──────────────────────────────────────────────────────── */
initDB().then(() => {
  console.log("\n  ⚙️   Ledgr worker");
  console.log("  =>  Hourly check:   0 * * * *");
  console.log("  =>  Plaid sync:     0 */4 * * *");
  console.log("  =>  Worker ready\n");
}).catch(err => {
  console.error("Worker DB init failed:", err.message);
  process.exit(1);
});
