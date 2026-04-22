"use strict";

/**
 * migrate-rules.js
 *
 * Moves existing rules out of the JSON blob in app_data into the new rules table.
 *
 * Safety guarantees — same as migrate-transactions.js and migrate-accounts.js:
 *   - Dry-run mode: pass --dry-run to preview without changing anything.
 *   - Per-user DB transactions: failure for one user rolls back only that user.
 *   - Count verification: DB count checked before renaming the blob key.
 *   - Non-destructive: original blob renamed to 'rules_blob_backup', not deleted.
 *   - Idempotent: ON CONFLICT DO NOTHING means re-running is safe.
 *
 * Usage:
 *   node migrate-rules.js --dry-run   # preview only
 *   node migrate-rules.js             # live migration
 *
 * After verifying the app looks correct, remove backup blobs with:
 *   DELETE FROM app_data WHERE key = 'rules_blob_backup';
 */

const { Pool } = require("pg");
const dotenv   = require("dotenv");

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureRulesTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS rules (
      id            TEXT    NOT NULL,
      user_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pattern       TEXT    NOT NULL,
      match_type    TEXT    NOT NULL DEFAULT 'contains',
      category_id   TEXT,
      type_override TEXT,
      enabled       BOOLEAN NOT NULL DEFAULT true,
      created_at    BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      PRIMARY KEY (id, user_id)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_rules_user ON rules(user_id)`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("\n  Ledgr — rules table migration");
  console.log(  "  ─────────────────────────────────────────────────────");
  console.log(dryRun
    ? "  Mode: DRY RUN — no data will be written or renamed\n"
    : "  Mode: LIVE\n"
  );

  if (!dryRun) {
    const setup = await pool.connect();
    try {
      await ensureRulesTable(setup);
      console.log("  ✓  rules table and index ready\n");
    } finally {
      setup.release();
    }
  }

  const { rows: blobs } = await pool.query(
    `SELECT user_id, value FROM app_data WHERE key = 'rules'`
  );

  if (blobs.length === 0) {
    const { rows: backups } = await pool.query(
      `SELECT COUNT(*) FROM app_data WHERE key = 'rules_blob_backup'`
    );
    const backupCount = parseInt(backups[0].count, 10);
    if (backupCount > 0) {
      console.log(`  ℹ️  Migration already ran — backup blobs exist for ${backupCount} user(s).`);
      console.log("  When ready to clean up:\n  DELETE FROM app_data WHERE key = 'rules_blob_backup';\n");
    } else {
      console.log("  ℹ️  No rules blobs found. The rules table is already the source of truth.\n");
    }
    await pool.end();
    return;
  }

  console.log(`  Found rules blobs for ${blobs.length} user(s)\n`);

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;
  const failedUsers = [];

  for (const blob of blobs) {
    const userId = blob.user_id;
    let rules;

    try {
      rules = JSON.parse(blob.value);
      if (!Array.isArray(rules)) {
        console.warn(`  [${userId}] ⚠️  blob is not an array — skipping`);
        continue;
      }
    } catch (err) {
      console.error(`  [${userId}] ✗  JSON parse failed: ${err.message} — skipping`);
      failedUsers.push(userId);
      totalErrors++;
      continue;
    }

    console.log(`  [${userId}] ${rules.length} rules in blob`);

    if (dryRun) {
      const withoutId = rules.filter(r => !r.id).length;
      console.log(`  [${userId}]    DRY RUN: would insert up to ${rules.length - withoutId} rows`);
      if (withoutId > 0) console.warn(`  [${userId}]    ⚠️  ${withoutId} rules have no id — would be skipped`);
      console.log(`  [${userId}]    DRY RUN: would rename key → 'rules_blob_backup'\n`);
      totalInserted += rules.length - withoutId;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let inserted = 0;
      let skipped  = 0;

      for (const r of rules) {
        if (!r.id) { skipped++; continue; }

        const result = await client.query(`
          INSERT INTO rules (id, user_id, pattern, match_type, category_id, type_override, enabled, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id, user_id) DO NOTHING
        `, [
          r.id,           userId,
          r.pattern       || "",
          r.matchType     || "contains",
          r.categoryId    ?? null,
          r.typeOverride  ?? null,
          r.enabled       !== false,
          r.createdAt     || Date.now(),
        ]);

        if (result.rowCount > 0) inserted++;
        else skipped++;
      }

      // Count verification
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) FROM rules WHERE user_id = $1`, [userId]
      );
      const dbCount   = parseInt(countRows[0].count, 10);
      const validBlob = rules.filter(r => r.id).length;

      if (dbCount < validBlob - skipped) {
        await client.query("ROLLBACK");
        console.error(`  [${userId}] ✗  Count mismatch: blob=${validBlob}, expected=${validBlob - skipped}, got=${dbCount} — rolled back\n`);
        failedUsers.push(userId);
        totalErrors++;
        continue;
      }

      await client.query(
        `UPDATE app_data SET key = 'rules_blob_backup' WHERE user_id = $1 AND key = 'rules'`,
        [userId]
      );

      await client.query("COMMIT");

      console.log(`  [${userId}] ✓  ${inserted} inserted, ${skipped} already existed`);
      console.log(`  [${userId}]    DB count: ${dbCount}`);
      console.log(`  [${userId}]    Original blob preserved as 'rules_blob_backup'\n`);

      totalInserted += inserted;
      totalSkipped  += skipped;

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  [${userId}] ✗  ${err.message} — rolled back\n`);
      failedUsers.push(userId);
      totalErrors++;
    } finally {
      client.release();
    }
  }

  console.log("  ─────────────────────────────────────────────────────");
  if (dryRun) {
    console.log(`  DRY RUN complete. Would insert up to ${totalInserted} rows for ${blobs.length} user(s).`);
    console.log("  Run without --dry-run to apply.\n");
  } else {
    console.log(`  Inserted:  ${totalInserted}`);
    console.log(`  Skipped:   ${totalSkipped}`);
    console.log(`  Errors:    ${totalErrors}`);

    if (failedUsers.length > 0) {
      console.error(`\n  ✗ Failed users (original blobs untouched):`);
      failedUsers.forEach(id => console.error(`    - ${id}`));
      console.error("\n  Re-run after fixing errors — it is safe to re-run.\n");
      process.exitCode = 1;
    } else {
      console.log(`\n  ✓  All users migrated successfully.`);
      console.log(`  Remove backups when ready:`);
      console.log(`  DELETE FROM app_data WHERE key = 'rules_blob_backup';\n`);
    }
  }

  await pool.end();
}

main().catch(async err => {
  console.error("\n  Migration failed:", err.message);
  await pool.end();
  process.exit(1);
});
