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

    // Send "trial ending tomorrow" emails (trial ends in 20-28 hours)
    const expiringSoon = await pool.query(`
      SELECT id, email, trial_ends_at FROM users
      WHERE subscription_status = 'trialing'
        AND trial_ends_at BETWEEN $1 AND $2
    `, [now + 20 * 60 * 60 * 1000, now + 28 * 60 * 60 * 1000]);
    for (const u of expiringSoon.rows) {
      await emailTrialExpiring(u.email, 1).catch(() => {});
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
        const { added, modified, removed } = await syncItemTransactions(userId);
        const result = await applySyncResultsToDB(userId, added, modified, removed);
        console.log(`[worker] ${userId}: +${result.added} added, ${result.modified} modified, ${result.removed} removed`);
        if (result.added > 0) {
          const examples = result.newTxns.slice(0, 2).map(t => t.merchant || t.name).join(", ");
          await sendPushToUser(userId, {
            title: `ledgr. — ${result.added} new transaction${result.added !== 1 ? "s" : ""}`,
            body:  examples || `${result.added} new transaction${result.added !== 1 ? "s" : ""} synced`,
            url:   "/",
          });
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
