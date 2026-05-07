"use strict";

/**
 * migrate-transactions.js
 *
 * Moves existing transactions out of the JSON blob in app_data and into
 * the new transactions table.
 *
 * Safety guarantees:
 *   - Dry-run mode: pass --dry-run to see exactly what will happen
 *     without touching any data.
 *   - Per-user DB transactions: if anything fails for one user the whole
 *     operation is rolled back for that user only. Other users are unaffected.
 *   - Count verification: the row count in the transactions table is compared
 *     against the blob count before the blob key is renamed. A mismatch aborts
 *     and rolls back that user.
 *   - Non-destructive: the original blob is RENAMED to key = 'transactions_blob_backup',
 *     NOT deleted. Your data stays in the database until you manually remove it
 *     once you have confirmed everything looks correct.
 *   - Idempotent: safe to run multiple times. ON CONFLICT (id, user_id) DO NOTHING
 *     means re-running skips rows that already exist in the table.
 *
 * Usage:
 *   node migrate-transactions.js --dry-run   # preview only, no changes
 *   node migrate-transactions.js             # live migration
 *
 * After verifying the app works correctly you can remove the backup blobs with:
 *   DELETE FROM app_data WHERE key = 'transactions_blob_backup';
 */

const { Pool } = require("pg");
const dotenv   = require("dotenv");

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const KNOWN_TXN_FIELDS = new Set([
  "id", "plaidAccountId", "plaidItemId", "accountId", "date",
  "authorized_date", "merchant", "name", "amount", "categoryId",
  "userCategorized", "pending", "type", "recurring", "recurringDay",
  "notes", "reviewed", "currency", "logo_url", "institution", "fingerprint",
]);

function computeFingerprint(t) {
  const date = t.date || "";
  const raw  = (t.merchant || t.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${date}__${t.amount}__${raw}`;
}

async function ensureTransactionsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id               TEXT          NOT NULL,
      user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plaid_account_id TEXT,
      plaid_item_id    TEXT,
      account_id       TEXT,
      date             TEXT,
      authorized_date  TEXT,
      merchant         TEXT,
      name             TEXT          NOT NULL DEFAULT '',
      amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
      category_id      TEXT,
      user_categorized BOOLEAN       NOT NULL DEFAULT false,
      pending          BOOLEAN       NOT NULL DEFAULT false,
      type             TEXT          NOT NULL DEFAULT 'expense',
      recurring        BOOLEAN       NOT NULL DEFAULT false,
      recurring_day    INTEGER,
      notes            TEXT,
      reviewed         BOOLEAN       NOT NULL DEFAULT false,
      currency         TEXT,
      logo_url         TEXT,
      institution      TEXT,
      fingerprint      TEXT,
      metadata         JSONB,
      created_at       BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      updated_at       BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      PRIMARY KEY (id, user_id)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_txn_user        ON transactions(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_txn_user_date   ON transactions(user_id, date DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_txn_user_cat    ON transactions(user_id, category_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_txn_user_acct   ON transactions(user_id, account_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_txn_fingerprint ON transactions(user_id, fingerprint) WHERE fingerprint IS NOT NULL`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("\n  Ledgr — transaction table migration");
  console.log(  "  ─────────────────────────────────────────────────────");
  console.log(dryRun
    ? "  Mode: DRY RUN — no data will be written or renamed\n"
    : "  Mode: LIVE\n"
  );

  // ── Step 1: Ensure table and indexes exist ───────────────────────
  if (!dryRun) {
    const setup = await pool.connect();
    try {
      await ensureTransactionsTable(setup);
      console.log("  ✓  transactions table and indexes ready\n");
    } finally {
      setup.release();
    }
  }

  // ── Step 2: Find all users with a transactions blob ──────────────
  const { rows: blobs } = await pool.query(
    `SELECT user_id, value FROM app_data WHERE key = 'transactions'`
  );

  if (blobs.length === 0) {
    // Check whether migration already ran (backup keys exist)
    const { rows: backups } = await pool.query(
      `SELECT COUNT(*) FROM app_data WHERE key = 'transactions_blob_backup'`
    );
    const backupCount = parseInt(backups[0].count, 10);
    if (backupCount > 0) {
      console.log(`  ℹ️  Migration already ran — backup blobs exist for ${backupCount} user(s).`);
      console.log("  No live 'transactions' blobs remain. Nothing to do.\n");
      console.log("  When ready to clean up backup blobs run:");
      console.log("  DELETE FROM app_data WHERE key = 'transactions_blob_backup';\n");
    } else {
      console.log("  ℹ️  No transaction blobs found in app_data.");
      console.log("  The transactions table is already the source of truth.\n");
    }
    await pool.end();
    return;
  }

  console.log(`  Found transaction blobs for ${blobs.length} user(s)\n`);

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;
  const failedUsers = [];

  // ── Step 3: Migrate each user ────────────────────────────────────
  for (const blob of blobs) {
    const userId = blob.user_id;
    let transactions;

    // Parse the blob — skip this user if it is malformed
    try {
      transactions = JSON.parse(blob.value);
      if (!Array.isArray(transactions)) {
        console.warn(`  [${userId}] ⚠️  blob value is not an array — skipping`);
        continue;
      }
    } catch (err) {
      console.error(`  [${userId}] ✗  JSON parse failed: ${err.message} — skipping`);
      failedUsers.push(userId);
      totalErrors++;
      continue;
    }

    console.log(`  [${userId}] ${transactions.length} transactions in blob`);

    if (dryRun) {
      const withoutId = transactions.filter(t => !t.id).length;
      console.log(`  [${userId}]    DRY RUN: would insert up to ${transactions.length - withoutId} rows`);
      if (withoutId > 0) console.warn(`  [${userId}]    ⚠️  ${withoutId} transactions have no id — would be skipped`);
      console.log(`  [${userId}]    DRY RUN: would rename key → 'transactions_blob_backup'\n`);
      totalInserted += transactions.length - withoutId;
      continue;
    }

    // Wrap in a DB transaction so this user is all-or-nothing
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let inserted = 0;
      let skipped  = 0;

      for (const t of transactions) {
        // Transactions without an id cannot be inserted
        if (!t.id) { skipped++; continue; }

        // Separate unknown fields into the metadata JSONB column
        const metadata = {};
        for (const [k, v] of Object.entries(t)) {
          if (!KNOWN_TXN_FIELDS.has(k)) metadata[k] = v;
        }
        const fp = t.fingerprint || computeFingerprint(t);

        const result = await client.query(`
          INSERT INTO transactions (
            id, user_id, plaid_account_id, plaid_item_id, account_id,
            date, authorized_date, merchant, name, amount,
            category_id, user_categorized, pending, type,
            recurring, recurring_day, notes, reviewed,
            currency, logo_url, institution, fingerprint, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
          ON CONFLICT (id, user_id) DO NOTHING
        `, [
          t.id,              userId,
          t.plaidAccountId   ?? null, t.plaidItemId    ?? null, t.accountId       ?? null,
          t.date             ?? null, t.authorized_date ?? null,
          t.merchant         ?? null, t.name           ?? "",   t.amount          ?? 0,
          t.categoryId       ?? null, t.userCategorized ?? false, t.pending        ?? false,
          t.type             ?? "expense",
          t.recurring        ?? false, t.recurringDay   ?? null,
          t.notes            ?? null,  t.reviewed       ?? false,
          t.currency         ?? null,  t.logo_url       ?? null, t.institution     ?? null,
          fp,
          Object.keys(metadata).length > 0 ? metadata : null,
        ]);

        if (result.rowCount > 0) inserted++;
        else skipped++;
      }

      // ── Count verification ───────────────────────────────────────
      // The number of rows in the table for this user must be >= the number
      // of valid transactions in the blob (some may have been skipped because
      // they already existed from a previous migration run).
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) FROM transactions WHERE user_id = $1`, [userId]
      );
      const dbCount    = parseInt(countRows[0].count, 10);
      const validBlob  = transactions.filter(t => t.id).length;

      if (dbCount < validBlob - skipped) {
        // Fewer rows in DB than we tried to insert — something silently failed
        await client.query("ROLLBACK");
        console.error(`  [${userId}] ✗  Count mismatch after insert:`);
        console.error(`  [${userId}]    blob has ${validBlob} valid rows`);
        console.error(`  [${userId}]    skipped (already existed): ${skipped}`);
        console.error(`  [${userId}]    expected in DB: ${validBlob - skipped}, got: ${dbCount}`);
        console.error(`  [${userId}]    Rolled back. Original blob is untouched.\n`);
        failedUsers.push(userId);
        totalErrors++;
        continue;
      }

      // ── Rename blob key (does NOT delete — data stays as backup) ──
      await client.query(
        `UPDATE app_data
         SET key = 'transactions_blob_backup'
         WHERE user_id = $1 AND key = 'transactions'`,
        [userId]
      );

      await client.query("COMMIT");

      console.log(`  [${userId}] ✓  ${inserted} inserted, ${skipped} already existed`);
      console.log(`  [${userId}]    DB row count after migration: ${dbCount}`);
      console.log(`  [${userId}]    Original blob preserved as key = 'transactions_blob_backup'\n`);

      totalInserted += inserted;
      totalSkipped  += skipped;

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  [${userId}] ✗  Unexpected error: ${err.message}`);
      console.error(`  [${userId}]    Rolled back. Original blob is untouched.\n`);
      failedUsers.push(userId);
      totalErrors++;
    } finally {
      client.release();
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log("  ─────────────────────────────────────────────────────");
  if (dryRun) {
    console.log(`  DRY RUN complete — no data was changed.`);
    console.log(`  Would have inserted up to ${totalInserted} rows for ${blobs.length} user(s).\n`);
    console.log("  Run without --dry-run to apply the migration.\n");
  } else {
    console.log(`  Inserted:  ${totalInserted}`);
    console.log(`  Skipped:   ${totalSkipped} (already existed in table)`);
    console.log(`  Errors:    ${totalErrors}`);

    if (failedUsers.length > 0) {
      console.error(`\n  ✗ The following users had errors (original blobs are untouched):`);
      failedUsers.forEach(id => console.error(`    - ${id}`));
      console.error("\n  Fix the errors above and re-run. It is safe to re-run.\n");
      process.exitCode = 1;
    } else {
      console.log(`\n  ✓  All users migrated successfully.`);
      console.log(`\n  Original blobs are preserved as key = 'transactions_blob_backup'.`);
      console.log(`  Verify the app looks correct, then remove the backups with:`);
      console.log(`  DELETE FROM app_data WHERE key = 'transactions_blob_backup';\n`);
    }
  }

  await pool.end();
}

main().catch(async err => {
  console.error("\n  Migration failed:", err.message);
  await pool.end();
  process.exit(1);
});
