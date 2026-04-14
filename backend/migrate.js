"use strict";

const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ENCRYPT_KEY = process.env.ENCRYPT_KEY;
const BCRYPT_ROUNDS = 12;

function encrypt(text) {
  if (!ENCRYPT_KEY || !text) return text;
  if (text.includes(":")) return text; // already encrypted
  const key = Buffer.from(ENCRYPT_KEY, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const email = getArg("--email");
  const password = getArg("--password");

  if (!email || !password) {
    console.error("Usage: node migrate.js --email you@example.com --password yourpassword");
    process.exit(1);
  }

  console.log("\n Ledgr data migration starting...\n");

  // Step 1: Create new tables
  console.log("Step 1: Creating new schema tables...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'subscriber',
      stripe_customer_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'trialing',
      trial_ends_at BIGINT,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
  `);
  await pool.query(`ALTER TABLE app_data ADD COLUMN IF NOT EXISTS user_id UUID;`).catch(() => {});
  await pool.query(`ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS user_id UUID;`).catch(() => {});
  await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID;`).catch(() => {});
  console.log("  OK: Schema ready\n");

  // Step 2: Create owner user
  console.log("Step 2: Creating owner account for " + email + "...");
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
  let userId;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query(
      "UPDATE users SET password = $1, role = 'owner', subscription_status = 'active' WHERE id = $2",
      [hash, userId]
    );
    console.log("  OK: Existing user updated to owner (" + userId + ")\n");
  } else {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const res = await pool.query(
      "INSERT INTO users (email, password, role, subscription_status) VALUES ($1, $2, 'owner', 'active') RETURNING id",
      [email.toLowerCase().trim(), hash]
    );
    userId = res.rows[0].id;
    console.log("  OK: Owner created: " + userId + "\n");
  }

  // Step 3: Migrate app_data
  console.log("Step 3: Migrating app_data...");
  const { rows: dataRows } = await pool.query("SELECT key, value FROM app_data WHERE user_id IS NULL");
  if (dataRows.length === 0) {
    console.log("  OK: No legacy rows to migrate\n");
  } else {
    for (const row of dataRows) {
      await pool.query(
        `INSERT INTO app_data (user_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, row.key, row.value]
      );
      let count = "?";
      try { count = JSON.parse(row.value)?.length ?? "n/a"; } catch {}
      console.log("  OK: Migrated \"" + row.key + "\" (" + count + " items)");
    }
    await pool.query("DELETE FROM app_data WHERE user_id IS NULL");
    console.log("  OK: Cleaned up " + dataRows.length + " legacy rows\n");
  }

  // Step 4: Migrate plaid_items
  console.log("Step 4: Migrating plaid_items...");
  const { rows: itemRows } = await pool.query(
    "SELECT item_id, access_token, institution FROM plaid_items WHERE user_id IS NULL"
  );
  if (itemRows.length === 0) {
    console.log("  OK: No legacy Plaid items to migrate\n");
  } else {
    for (const item of itemRows) {
      const token = ENCRYPT_KEY ? encrypt(item.access_token) : item.access_token;
      await pool.query(
        "UPDATE plaid_items SET user_id = $1, access_token = $2 WHERE item_id = $3",
        [userId, token, item.item_id]
      );
      console.log("  OK: Migrated Plaid item: " + (item.institution || item.item_id));
    }
    console.log("");
  }

  // Step 5: Migrate push_subscriptions
  console.log("Step 5: Migrating push_subscriptions...");
  const { rows: pushRows } = await pool.query(
    "SELECT endpoint FROM push_subscriptions WHERE user_id IS NULL"
  );
  if (pushRows.length === 0) {
    console.log("  OK: No legacy push subscriptions\n");
  } else {
    await pool.query("UPDATE push_subscriptions SET user_id = $1 WHERE user_id IS NULL", [userId]);
    console.log("  OK: Migrated " + pushRows.length + " push subscription(s)\n");
  }

  // Step 6: Enforce NOT NULL
  console.log("Step 6: Enforcing constraints...");
  try {
    await pool.query("ALTER TABLE app_data ALTER COLUMN user_id SET NOT NULL");
    console.log("  OK: app_data.user_id NOT NULL");
  } catch { console.log("  --: app_data.user_id already constrained"); }

  try {
    await pool.query("ALTER TABLE plaid_items ALTER COLUMN user_id SET NOT NULL");
    console.log("  OK: plaid_items.user_id NOT NULL");
  } catch { console.log("  --: plaid_items.user_id already constrained"); }

  console.log("\n Migration complete!\n");
  console.log("   Email:   " + email);
  console.log("   Role:    owner (no subscription required)");
  console.log("   User ID: " + userId);
  console.log("\n   Deploy new server.js and log in with these credentials.\n");

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n Migration failed:", err.message);
  await pool.end();
  process.exit(1);
});
