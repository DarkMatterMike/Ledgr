"use strict";

/**
 * migrate-accounts.js
 *
 * Moves existing accounts out of the JSON blob in app_data and into
 * the new accounts table.
 *
 * Safety guarantees (same as migrate-transactions.js):
 *   - Dry-run mode: pass --dry-run to preview with no changes.
 *   - Per-user DB transactions: failure for one user rolls back only that user.
 *   - Count verification before the blob key is renamed.
 *   - Non-destructive: original blob renamed to 'accounts_blob_backup', NOT deleted.
 *   - Idempotent: ON CONFLICT DO NOTHING — safe to re-run.
 *
 * Usage:
 *   node migrate-accounts.js --dry-run
 *   node migrate-accounts.js
 *
 * After verifying the app looks correct, clean up backup blobs with:
 *   DELETE FROM app_data WHERE key = 'accounts_blob_backup';
 */

const { Pool } = require("pg");
const dotenv   = require("dotenv");
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureAccountsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            TEXT          NOT NULL,
      user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plaid_id      TEXT,
      plaid_item_id TEXT,
      name          TEXT          NOT NULL,
      balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
      available     NUMERIC(12,2),
      type          TEXT,
      institution   TEXT,
      is_manual     BOOLEAN       NOT NULL DEFAULT false,
      created_at    BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      updated_at    BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      PRIMARY KEY (id, user_id)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_acct_user       ON accounts(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_acct_plaid_id   ON accounts(user_id, plaid_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_acct_plaid_item ON accounts(user_id, plaid_item_id)`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("\n  Ledgr — accounts table migration");
  console.log("  ─────────────────────────────────────────────────────");
  console.log(dryRun
    ? "  Mode: DRY RUN — no data will be written or renamed\n"
    : "  Mode: LIVE\n"
  );

  if (!dryRun) {
    const setup = await pool.connect();
    try {
      await ensureAccountsTable(setup);
      console.log("  ✓  accounts table and indexes ready\n");
    } finally {
      setup.release();
    }
  }

  // Find all users with an accounts blob
  const { rows: blobs } = await pool.query(
    `SELECT user_id, value FROM app_data WHERE key = 'accounts'`
  );

  if (blobs.length === 0) {
    const { rows: backups } = await pool.query(
      `SELECT COUNT(*) FROM app_data WHERE key = 'accounts_blob_backup'`
    );
    if (parseInt(backups[0].count, 10) > 0) {
      console.log("  ℹ️  Migration already ran — backup blobs exist. Nothing to do.\n");
    } else {
      console.log("  ℹ️  No account blobs found. Accounts table is already the source of truth.\n");
    }
    await pool.end();
    return;
  }

  console.log(`  Found account blobs for ${blobs.length} user(s)\n`);

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;
  const failedUsers = [];

  for (const blob of blobs) {
    const userId = blob.user_id;
    let accounts;

    try {
      accounts = JSON.parse(blob.value);
      if (!Array.isArray(accounts)) {
        console.warn(`  [${userId}] ⚠️  blob value is not an array — skipping`);
        continue;
      }
    } catch (err) {
      console.error(`  [${userId}] ✗  JSON parse failed: ${err.message}`);
      failedUsers.push(userId);
      totalErrors++;
      continue;
    }

    console.log(`  [${userId}] ${accounts.length} accounts in blob`);

    if (dryRun) {
      const noId = accounts.filter(a => !a.id).length;
      console.log(`  [${userId}]    DRY RUN: would insert up to ${accounts.length - noId} rows`);
      if (noId > 0) console.warn(`  [${userId}]    ⚠️  ${noId} accounts have no id — would be skipped`);
      console.log(`  [${userId}]    DRY RUN: would rename key → 'accounts_blob_backup'\n`);
      totalInserted += accounts.length - noId;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let inserted = 0;
      let skipped  = 0;

      for (const a of accounts) {
        if (!a.id) { skipped++; continue; }

        const result = await client.query(`
          INSERT INTO accounts (
            id, user_id, plaid_id, plaid_item_id, name,
            balance, available, type, institution, is_manual
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id, user_id) DO NOTHING
        `, [
          a.id,         userId,
          a.plaidId     ?? null,
          a.plaidItemId ?? null,
          a.name        || "Unnamed Account",
          a.balance     ?? 0,
          a.available   ?? null,
          a.type        ?? null,
          a.institution ?? null,
          !a.plaidId,   // is_manual: true if no plaidId
        ]);

        if (result.rowCount > 0) inserted++;
        else skipped++;
      }

      // Count verification
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) FROM accounts WHERE user_id = $1`, [userId]
      );
      const dbCount   = parseInt(countRows[0].count, 10);
      const validBlob = accounts.filter(a => a.id).length;

      if (dbCount < validBlob - skipped) {
        await client.query("ROLLBACK");
        console.error(`  [${userId}] ✗  Count mismatch: blob=${validBlob}, db=${dbCount} — rolled back`);
        failedUsers.push(userId);
        totalErrors++;
        continue;
      }

      // Rename blob key — preserves original data as backup
      await client.query(
        `UPDATE app_data SET key = 'accounts_blob_backup' WHERE user_id = $1 AND key = 'accounts'`,
        [userId]
      );

      await client.query("COMMIT");

      console.log(`  [${userId}] ✓  ${inserted} inserted, ${skipped} already existed`);
      console.log(`  [${userId}]    DB count: ${dbCount}`);
      console.log(`  [${userId}]    Original blob preserved as 'accounts_blob_backup'\n`);

      totalInserted += inserted;
      totalSkipped  += skipped;

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  [${userId}] ✗  Error: ${err.message} — rolled back\n`);
      failedUsers.push(userId);
      totalErrors++;
    } finally {
      client.release();
    }
  }

  console.log("  ─────────────────────────────────────────────────────");
  if (dryRun) {
    console.log(`  DRY RUN complete. Would have inserted up to ${totalInserted} rows.\n`);
    console.log("  Run without --dry-run to apply.\n");
  } else {
    console.log(`  Inserted:  ${totalInserted}`);
    console.log(`  Skipped:   ${totalSkipped} (already existed)`);
    console.log(`  Errors:    ${totalErrors}`);
    if (failedUsers.length > 0) {
      console.error(`\n  ✗ Failed users (original blobs untouched):`);
      failedUsers.forEach(id => console.error(`    - ${id}`));
      console.error("\n  Fix errors above and re-run. It is safe to re-run.\n");
      process.exitCode = 1;
    } else {
      console.log(`\n  ✓  All users migrated successfully.`);
      console.log(`  Backup blobs preserved as key = 'accounts_blob_backup'`);
      console.log(`  Once verified, clean up with:`);
      console.log(`  DELETE FROM app_data WHERE key = 'accounts_blob_backup';\n`);
    }
  }

  await pool.end();
}

main().catch(async err => {
  console.error("\n  Migration failed:", err.message);
  await pool.end();
  process.exit(1);
});
