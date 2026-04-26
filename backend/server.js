/**
 * ledgr – backend/server.js
 * HTTP server only — no cron jobs, no sync logic.
 * All shared DB helpers live in db.js.
 * Scheduled jobs live in worker.js.
 */

"use strict";

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const dotenv     = require("dotenv");
const crypto     = require("crypto");
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const rateLimit  = require("express-rate-limit");
const Stripe     = require("stripe");

dotenv.config();

const {
  pool,
  initDB,
  encrypt,
  decrypt,
  getUserById,
  getUserByEmail,
  getUserByStripeCustomerId,
  createUser,
  getData,
  setData,
  getAccounts,
  upsertAccount,
  deleteAccountById,
  deleteAccountsByPlaidItem,
  deleteAllAccounts,
  getRules,
  upsertRule,
  deleteRuleById,
  deleteAllRules,
  getTransactions,
  upsertTransactionRow,
  upsertTransactionsBatch,
  getItem,
  getItemsForUser,
  saveItem,
  removeItem,
  updateCursor,
  saveSubscription,
  getSubscriptionsForUser,
  removeSubscription,
  sendPushToUser,
  sendEmail,
  emailWelcome,
  emailSubscriptionConfirmed,
  emailPasswordReset,
  plaidClient,
  PLAID_ENV,
  syncItemTransactions,
  applySyncResultsToDB,
  syncItemTransactions,
} = require("./db");

/* ── Config ──────────────────────────────────────────────────────── */
const PORT          = process.env.PORT || 3001;
const FRONTEND_URL  = process.env.FRONTEND_URL   || "http://localhost:5173";
const PRODUCTS      = (process.env.PLAID_PRODUCTS     || "transactions").split(",").map(p => p.trim());
const COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || "US").split(",").map(c => c.trim());
const JWT_SECRET    = process.env.JWT_SECRET;
const ENCRYPT_KEY   = process.env.ENCRYPT_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL;
const BCRYPT_ROUNDS = 12;

const stripe                  = Stripe(process.env.STRIPE_SECRET_KEY || "");
const STRIPE_PRICE_ID         = process.env.STRIPE_PRICE_ID          || "";
const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID  || "";
const STRIPE_WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET    || "";

if (!JWT_SECRET)                    console.warn("⚠  JWT_SECRET not set");
if (!ENCRYPT_KEY)                   console.warn("⚠  ENCRYPT_KEY not set");
if (!OWNER_EMAIL)                   console.warn("⚠  OWNER_EMAIL not set");
if (!process.env.STRIPE_SECRET_KEY) console.warn("⚠  STRIPE_SECRET_KEY not set");
if (!STRIPE_PRICE_ID)               console.warn("⚠  STRIPE_PRICE_ID not set");
if (!STRIPE_WEBHOOK_SECRET)         console.warn("⚠  STRIPE_WEBHOOK_SECRET not set");
if (!process.env.RESEND_API_KEY)    console.warn("⚠  RESEND_API_KEY not set");

const app = express();
app.set("trust proxy", 1);

const IS_PROD = process.env.NODE_ENV === "production";

// Generic error response — never leak internal details in production
function serverError(res, err, fallback = "Internal server error") {
  console.error(err?.message || err);
  return res.status(500).json({ error: IS_PROD ? fallback : (err?.message || fallback) });
}

// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.post("/api/billing/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).json({ error: "Webhook signature failed" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId  = session.metadata?.userId;
          if (userId) {
            // Fetch the subscription to get the price ID
            let priceId = null;
            try {
              if (session.subscription) {
                const sub = await stripe.subscriptions.retrieve(session.subscription);
                priceId = sub.items?.data[0]?.price?.id || null;
              }
            } catch (e) { console.warn("[stripe] could not fetch subscription price:", e.message); }
            await pool.query(
              "UPDATE users SET stripe_customer_id = $1, subscription_status = 'active', stripe_price_id = $2 WHERE id = $3",
              [session.customer, priceId, userId]
            );
            const user = await getUserById(userId);
            if (user) emailSubscriptionConfirmed(user.email).catch(() => {});
            console.log(`[stripe] checkout complete for user ${userId}, price: ${priceId}`);
          }
          break;
        }
        case "customer.subscription.updated": {
          const sub  = event.data.object;
          const user = await getUserByStripeCustomerId(sub.customer);
          if (user) {
            const status  = sub.status === "active"   ? "active"
              : sub.status === "trialing" ? "trialing"
              : sub.status === "past_due"  ? "past_due"
              : "canceled";
            const priceId = sub.items?.data[0]?.price?.id || user.stripe_price_id;
            await pool.query(
              "UPDATE users SET subscription_status = $1, stripe_price_id = $2 WHERE id = $3",
              [status, priceId, user.id]
            );
            console.log(`[stripe] subscription updated for user ${user.id}: ${status}, price: ${priceId}`);
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub  = event.data.object;
          const user = await getUserByStripeCustomerId(sub.customer);
          if (user) {
            await pool.query("UPDATE users SET subscription_status = 'canceled' WHERE id = $1", [user.id]);
            console.log(`[stripe] subscription canceled for user ${user.id}`);
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const user    = await getUserByStripeCustomerId(invoice.customer);
          if (user) {
            await pool.query("UPDATE users SET subscription_status = 'past_due' WHERE id = $1", [user.id]);
            console.log(`[stripe] payment failed for user ${user.id}`);
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("Webhook handler error:", err.message);
    }

    res.json({ received: true });
  }
);

const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  "https://ledgrfinance.app",
  "https://www.ledgrfinance.app",
  "https://app.ledgrfinance.app",
  "https://ledgr-eight-zeta.vercel.app",
  "https://ledgr-landing-omega.vercel.app",
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for Plaid Link iframe
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.plaid.com"],
      frameSrc: ["cdn.plaid.com"],
      connectSrc: ["'self'", "https://production.plaid.com", "https://sandbox.plaid.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(express.json({ limit: "2mb" }));

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { error: "Too many login attempts." } });
const syncLimiter = rateLimit({ windowMs: 60*60*1000, max: 20, message: { error: "Sync rate limit exceeded." } });
app.use(rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false }));

/* ── Observability middleware ─────────────────────────────────────── */
// Logs slow requests (>1s), large payloads (>256KB), and all 5xx errors.
// Keeps noise low — fast, small requests are silent.
const SLOW_MS       = 1000;  // warn if response takes longer than this
const LARGE_BYTES   = 256 * 1024; // warn if request body exceeds this

app.use((req, res, next) => {
  const start       = Date.now();
  const bodyBytes   = parseInt(req.headers["content-length"] || "0", 10);

  if (bodyBytes > LARGE_BYTES) {
    console.warn(`[obs] large payload  ${req.method} ${req.path} — ${(bodyBytes/1024).toFixed(1)}KB  user=${req.user?.id || "anon"}`);
  }

  res.on("finish", () => {
    const ms = Date.now() - start;
    if (ms > SLOW_MS) {
      console.warn(`[obs] slow request   ${req.method} ${req.path} — ${ms}ms  status=${res.statusCode}  user=${req.user?.id || "anon"}`);
    }
    if (res.statusCode >= 500) {
      console.error(`[obs] server error   ${req.method} ${req.path} — ${ms}ms  status=${res.statusCode}  user=${req.user?.id || "anon"}`);
    }
  });

  next();
});

/* ── JWT auth middleware ──────────────────────────────────────────── */
async function requireAuth(req, res, next) {
  if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured — JWT_SECRET not set" });
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user    = await getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    // Token version check — invalidates tokens issued before logout/password change
    if ((payload.tv ?? 0) < (user.token_version ?? 0)) {
      return res.status(401).json({ error: "Token revoked — please log in again" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* ── Subscription status helper ───────────────────────────────────── */
function getAccessLevel(user) {
  if (user.role === "owner") return "full";
  if (user.role === "free")  return "full"; // complimentary full access, not billed
  if (user.subscription_status === "active") return "full";
  if (user.subscription_status === "trialing" && Date.now() < user.trial_ends_at) return "full";
  return "free"; // read-only, no Plaid
}

/* ── Subscription check for write/Plaid routes ────────────────────── */
function requireSubscription(req, res, next) {
  if (getAccessLevel(req.user) === "full") return next();
  return res.status(402).json({ error: "subscription_required" });
}

/* ── Premium (higher tier) check for investment sync ─────────────── */
function requirePremium(req, res, next) {
  const u = req.user;
  if (u.role === "owner") return next();
  if (u.stripe_price_id && u.stripe_price_id === STRIPE_PREMIUM_PRICE_ID) return next();
  return res.status(402).json({ error: "premium_required" });
}

/* ── Owner-only ───────────────────────────────────────────────────── */
function requireOwner(req, res, next) {
  if (req.user?.role !== "owner") return res.status(403).json({ error: "Owner access required" });
  next();
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
═══════════════════════════════════════════════════════════════════ */

app.get("/api/health", (_req, res) => res.json({ ok: true, env: PLAID_ENV, auth: !!JWT_SECRET }));

// Owner-only health check that shows per-user transaction counts and flags large users
app.get("/api/health/users", async (_req, res) => {
  // No auth — only reachable internally or by owner; returns aggregate stats only
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.subscription_status, COUNT(t.id) AS txn_count
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      GROUP BY u.id, u.email, u.subscription_status
      ORDER BY txn_count DESC
    `);
    const users = rows.map(r => ({
      id:     r.id,
      email:  r.email,
      status: r.subscription_status,
      txnCount: parseInt(r.txn_count, 10),
      flag:   parseInt(r.txn_count, 10) > 5000 ? "⚠ high" : "ok",
    }));
    res.json({ users, total: users.length });
  } catch (err) { serverError(res, err); }
});

// POST /api/support — sends a support message from a logged-in user to the owner inbox.
// Rate-limited to 5 messages per hour to prevent spam.
const supportLimiter = rateLimit({ windowMs: 60*60*1000, max: 5, message: { error: "Too many support requests. Please try again later." } });
app.post("/api/support", supportLimiter, async (req, res) => {
  try {
    const uid = req.user.id;
    const { subject, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message is required" });
    if (!OWNER_EMAIL) return res.status(503).json({ error: "Support not configured" });

    const user = await getUserById(uid);
    const subjectLine = subject?.trim() || "Support Request";
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0d1117;color:#e6edf3;border-radius:12px">
        <div style="font-size:20px;font-weight:800;margin-bottom:4px">ledgr<span style="color:#00d4ff">.</span> support</div>
        <div style="font-size:11px;color:#8b949e;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #21262d">
          From: ${user?.email || "unknown"} &nbsp;·&nbsp; User ID: ${uid}
        </div>
        <h2 style="font-size:16px;font-weight:600;margin:0 0 12px;color:#e6edf3">${subjectLine}</h2>
        <div style="font-size:14px;color:#c9d1d9;line-height:1.7;white-space:pre-wrap">${message.trim()}</div>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #21262d;font-size:11px;color:#8b949e">
          Reply directly to this email to respond to the user.
        </div>
      </div>
    `;
    await sendEmail(OWNER_EMAIL, `[ledgr support] ${subjectLine}`, html);
    console.log(`[support] Message from ${user?.email} (${uid}): ${subjectLine}`);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)  return res.status(400).json({ error: "Email and password required" });
  if (password.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (!JWT_SECRET)           return res.status(500).json({ error: "Auth not configured" });
  try {
    if (await getUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });
    const user  = await createUser(email, password);
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: "30d" });
    // Send welcome email (non-blocking)
    if (user.role !== "owner") emailWelcome(user.email).catch(() => {});
    res.json({ token, user: { id: user.id, email: user.email, name: user.name || null, role: user.role, subscription_status: user.subscription_status, trial_ends_at: user.trial_ends_at } });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (!JWT_SECRET)          return res.status(500).json({ error: "Auth not configured" });
  try {
    const user = await getUserByEmail(email);

    // Check account lockout
    if (user?.locked_until && Date.now() < user.locked_until) {
      const minutesLeft = Math.ceil((user.locked_until - Date.now()) / 60000);
      return res.status(429).json({ error: `Account locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.` });
    }

    const valid = user && await bcrypt.compare(password, user.password);

    if (!valid) {
      // Increment failed attempts and lock after 10 failures
      if (user) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockedUntil = attempts >= 10 ? Date.now() + 30 * 60 * 1000 : null; // 30 min lockout
        await pool.query(
          "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3",
          [attempts, lockedUntil, user.id]
        );
      }
      return res.status(401).json({ error: "Incorrect email or password" });
    }

    // Successful login — reset failed attempts and record last login
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = $1 WHERE id = $2",
      [Date.now(), user.id]
    );

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name || null, role: user.role, subscription_status: user.subscription_status, trial_ends_at: user.trial_ends_at } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: IS_PROD ? "Login failed" : err.message });
  }
});

/* ── Logout — invalidates all existing tokens ────────────────────── */
app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1",
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ── Forgot / reset password (public) ────────────────────────────── */
app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  // Always return success to prevent email enumeration
  res.json({ ok: true });
  try {
    const user = await getUserByEmail(email);
    if (!user) return; // silently ignore unknown emails
    // Create reset token
    const token   = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expires]
    );
    const resetUrl = `${FRONTEND_URL}?reset=${token}`;
    await emailPasswordReset(user.email, resetUrl);
  } catch(e) { console.error("[forgot-password]", e.message); }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM password_resets WHERE token = $1 AND used = FALSE AND expires_at > $2`,
      [token, Date.now()]
    );
    if (!rows[0]) return res.status(400).json({ error: "Invalid or expired reset link" });
    const reset = rows[0];
    const hash  = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, reset.user_id]);
    await pool.query("UPDATE password_resets SET used = TRUE WHERE id = $1", [reset.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── All routes below require auth ───────────────────────────────── */
app.use(requireAuth);

// Track last activity — update at most once per 5 minutes to avoid a DB write on every request.
// Uses a simple in-memory map since precision isn't critical — worst case we lose the
// last few minutes of activity on a server restart, which is acceptable.
const lastActivityCache = new Map(); // userId → timestamp of last DB write
const ACTIVITY_THROTTLE = 5 * 60 * 1000; // 5 minutes

app.use((req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next();
  const now  = Date.now();
  const last = lastActivityCache.get(userId) || 0;
  if (now - last > ACTIVITY_THROTTLE) {
    lastActivityCache.set(userId, now);
    pool.query("UPDATE users SET last_activity_at = $1 WHERE id = $2", [now, userId])
      .catch(e => console.warn("[activity] update failed:", e.message));
  }
  next();
});

app.get("/api/auth/me", (req, res) => {
  const { id, email, name, role, subscription_status, trial_ends_at, stripe_price_id } = req.user;
  const access    = getAccessLevel(req.user);
  const isPremium = role === "owner" || (stripe_price_id && stripe_price_id === STRIPE_PREMIUM_PRICE_ID);
  res.json({ id, email, name, role, subscription_status, trial_ends_at, stripe_price_id, access, isPremium });
});

app.patch("/api/auth/profile", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name required" });
  try {
    await pool.query("UPDATE users SET name = $1 WHERE id = $2", [name.trim(), req.user.id]);
    res.json({ ok: true, name: name.trim() });
  } catch (err) { serverError(res, err, "Failed to update profile"); }
});

app.post("/api/auth/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
  try {
    const valid = await bcrypt.compare(currentPassword, req.user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   BILLING
═══════════════════════════════════════════════════════════════════ */

/* Create Stripe checkout session */
app.post("/api/billing/create-checkout", async (req, res) => {
  if (!STRIPE_PRICE_ID) return res.status(500).json({ error: "Stripe not configured" });
  try {
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, req.user.id]);
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${FRONTEND_URL}?subscribed=true`,
      cancel_url:  `${FRONTEND_URL}?canceled=true`,
      metadata: { userId: req.user.id },
      subscription_data: {
        metadata: { userId: req.user.id },
      },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Create checkout error:", err.message);
    serverError(res, err, "Checkout failed");
  }
});

/* Create Stripe customer portal session (manage/cancel) */
app.post("/api/billing/portal", async (req, res) => {
  try {
    const customerId = req.user.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: "No billing account found" });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: FRONTEND_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err.message);
    serverError(res, err, "Portal failed");
  }
});

/* Get billing status */
app.get("/api/billing/status", (req, res) => {
  const { role, subscription_status, trial_ends_at, stripe_customer_id } = req.user;
  const access = getAccessLevel(req.user);
  const daysLeft = trial_ends_at ? Math.max(0, Math.ceil((trial_ends_at - Date.now()) / (1000*60*60*24))) : 0;
  res.json({ role, subscription_status, trial_ends_at, access, daysLeft, hasStripe: !!stripe_customer_id });
});

/* ═══════════════════════════════════════════════════════════════════
   APP DATA — read allowed for all authed users, write requires sub
═══════════════════════════════════════════════════════════════════ */

// GET /api/data — core data only (fast, needed for first render).
// Transactions, portfolio, AI, and analytics are loaded via their own endpoints.
app.get("/api/data", async (req, res) => {
  try {
    const uid = req.user.id;
    const [accts, ruleRows, categories, plaidItems, calendarAccounts,
           aiCatExamples, userProfile, dismissedPairs, scanMemory, goals,
           aiApiKey, plaidItemRows, insightsTodosData, daniData, themeData] = await Promise.all([
      getAccounts(uid),
      getRules(uid),
      getData(uid, "categories"),
      getData(uid, "plaidItems"),
      getData(uid, "calendarAccounts"),
      getData(uid, "aiCatExamples"),
      getData(uid, "userProfile"),
      getData(uid, "dismissedPairs"),
      getData(uid, "scanMemory"),
      getData(uid, "goals"),
      getData(uid, "aiApiKey"),
      // Live item health from plaid_items table — used to seed reauth warnings on load
      pool.query(
        `SELECT item_id, institution, needs_reauth FROM plaid_items WHERE user_id = $1`,
        [uid]
      ),
      getData(uid, "insightsTodos"),  // needed for dashboard Action Items card
      getData(uid, "dani"),              // owner-only Dani page
      getData(uid, "theme"),             // user theme preferences
    ]);

    const reauthItemIds = plaidItemRows.rows
      .filter(r => r.needs_reauth)
      .map(r => r.item_id);

    res.json({
      accounts:         accts            || [],
      rules:            ruleRows         || [],
      categories:       categories       || [],
      plaidItems:       plaidItems       || [],
      reauthItemIds,
      calendarAccounts: calendarAccounts || null,
      aiCatExamples:    aiCatExamples    || [],
      userProfile:      userProfile      || null,
      dismissedPairs:   dismissedPairs   || [],
      scanMemory:       scanMemory       || null,
      goals:            goals            || [],
      hasAiKey:         !!aiApiKey,
      insightsTodos:    insightsTodosData || [],
      dani:             daniData          || null,
      theme:            themeData          || null,
      access:           getAccessLevel(req.user),
    });
  } catch (err) { serverError(res, err); }
});

// GET /api/transactions — paginated transaction list.
// Supports: ?limit=250&offset=0&sort=date_desc&search=&category=&account=&month=YYYY-MM&recurring=true
// Defaults to all transactions sorted by date DESC.
app.get("/api/transactions", async (req, res) => {
  try {
    const uid    = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit  || "1000", 10), 1000);
    const offset = parseInt(req.query.offset || "0", 10);
    const sort   = req.query.sort || "date_desc";
    const search      = (req.query.search   || "").trim().toLowerCase();
    const category    = req.query.category  || null;
    const account     = req.query.account   || null;
    const month       = req.query.month     || null; // "YYYY-MM"
    const recurringOnly = req.query.recurring === "true";

    const orderBy = sort === "date_asc"    ? "date ASC,  created_at ASC"
                  : sort === "amount_desc" ? "amount DESC, date DESC"
                  : sort === "amount_asc"  ? "amount ASC,  date DESC"
                  :                          "date DESC, created_at DESC"; // default

    const conditions = ["user_id = $1"];
    const vals = [uid];
    if (recurringOnly)  { conditions.push(`recurring = true`); }
    if (category) { vals.push(category); conditions.push(`category_id = $${vals.length}`); }
    if (account)  { vals.push(account);  conditions.push(`account_id = $${vals.length}`); }
    if (month)    { vals.push(month + "%"); conditions.push(`date LIKE $${vals.length}`); }
    if (search)   { vals.push("%" + search + "%"); conditions.push(`LOWER(merchant) LIKE $${vals.length}`); }

    const where = conditions.join(" AND ");

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT * FROM transactions WHERE ${where} ORDER BY ${orderBy} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
        [...vals, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM transactions WHERE ${where}`, vals),
    ]);

    const total   = parseInt(countRows[0].count, 10);
    const hasMore = offset + rows.length < total;

    // Guardrail: log when a user has a high transaction count
    if (total > 5000 && !recurringOnly) {
      console.warn(`[guardrail] high transaction count  user=${uid}  count=${total}`);
    }

    res.json({
      transactions: rows.map(r => ({
        id:              r.id,
        plaidAccountId:  r.plaid_account_id,
        plaidItemId:     r.plaid_item_id,
        accountId:       r.account_id,
        date:            r.date,
        authorized_date: r.authorized_date,
        merchant:        r.merchant,
        name:            r.name,
        amount:          parseFloat(r.amount),
        categoryId:      r.category_id,
        userCategorized: r.user_categorized,
        pending:         r.pending,
        type:            r.type,
        recurring:       r.recurring,
        recurringDay:    r.recurring_day,
        recurringFreq:   r.recurring_freq,
        recurringStart:  r.recurring_start,
        notes:           r.notes,
        reviewed:        r.reviewed,
        currency:        r.currency,
        logo_url:        r.logo_url,
        institution:     r.institution,
        ...(r.metadata || {}),
      })),
      total,
      hasMore,
      offset,
      limit,
    });
  } catch (err) { serverError(res, err); }
});

// GET /api/data/portfolio — investment accounts, holdings, net worth snapshots.
// Loaded lazily when the portfolio view is first opened.
app.get("/api/data/portfolio", async (req, res) => {
  try {
    const uid = req.user.id;
    const [investmentAccounts, holdings, netWorthSnapshots] = await Promise.all([
      getData(uid, "investmentAccounts"),
      getData(uid, "holdings"),
      getData(uid, "netWorthSnapshots"),
    ]);
    res.json({
      investmentAccounts: investmentAccounts || [],
      holdings:           holdings           || [],
      netWorthSnapshots:  netWorthSnapshots  || [],
    });
  } catch (err) { serverError(res, err); }
});

// GET /api/data/ai — conversation history.
// Loaded lazily when the AI chat view is first opened.
app.get("/api/data/ai", async (req, res) => {
  try {
    const uid = req.user.id;
    const [aiConversations, aiCurrentConvId, aiMessages] = await Promise.all([
      getData(uid, "aiConversations"),
      getData(uid, "aiCurrentConvId"),
      getData(uid, "aiMessages"),
    ]);
    res.json({
      aiConversations: aiConversations || [],
      aiCurrentConvId: aiCurrentConvId || null,
      aiMessages:      aiMessages      || [],
    });
  } catch (err) { serverError(res, err); }
});

// GET /api/data/analytics — saved insights and to-do items.
// Loaded lazily when the analytics view is first opened.
app.get("/api/data/analytics", async (req, res) => {
  try {
    const uid = req.user.id;
    const [analyticsInsights, insightsTodos] = await Promise.all([
      getData(uid, "analyticsInsights"),
      getData(uid, "insightsTodos"),
    ]);
    res.json({
      analyticsInsights: analyticsInsights || null,
      insightsTodos:     insightsTodos     || [],
    });
  } catch (err) { serverError(res, err); }
});

// GET /api/data/summary?month=YYYY-MM — precomputed dashboard aggregates.
// Returns spending by category, spending by account, total spent, and total income
// for the requested month — all computed in the DB so they are correct regardless
// of how many transactions are loaded client-side.
app.get("/api/data/summary", async (req, res) => {
  try {
    const uid   = req.user.id;
    const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;

    const [catRows, acctRows, incomeRow] = await Promise.all([
      // Spending by category (expenses only, excluding transfer/income/reimbursement)
      pool.query(`
        SELECT category_id, SUM(ABS(amount)) AS total
        FROM transactions
        WHERE user_id = $1
          AND date LIKE $2
          AND amount < 0
          AND category_id IS NOT NULL
          AND type NOT IN ('transfer', 'income', 'reimbursement')
        GROUP BY category_id
      `, [uid, month + "%"]),

      // Spending by account (all outflows)
      pool.query(`
        SELECT account_id, SUM(ABS(amount)) AS total
        FROM transactions
        WHERE user_id = $1
          AND date LIKE $2
          AND amount < 0
          AND account_id IS NOT NULL
        GROUP BY account_id
      `, [uid, month + "%"]),

      // Total income
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE user_id = $1
          AND date LIKE $2
          AND amount > 0
          AND (type = 'income' OR type IS NULL OR type = '')
      `, [uid, month + "%"]),
    ]);

    const spentByCat  = Object.fromEntries(catRows.rows.map(r  => [r.category_id,  parseFloat(r.total)]));
    const spentByAcct = Object.fromEntries(acctRows.rows.map(r => [r.account_id,   parseFloat(r.total)]));
    const totalSpent  = Object.values(spentByCat).reduce((a, b) => a + b, 0);
    const totalIncome = parseFloat(incomeRow.rows[0].total);

    res.json({ spentByCat, spentByAcct, totalSpent, totalIncome, month });
  } catch (err) { serverError(res, err); }
});

// Writes require subscription
app.patch("/api/data", requireSubscription, async (req, res) => {
  try {
    const uid = req.user.id;
    const { categories, plaidItems, dani, theme, calendarAccounts,
            investmentAccounts, holdings, netWorthSnapshots, aiMessages, aiCatExamples,
            userProfile, insightsTodos, analyticsInsights, dismissedPairs, scanMemory,
            aiConversations, aiCurrentConvId, goals } = req.body;
    const ops = [];
    // accounts → POST/PATCH/DELETE /api/accounts/*
    // rules    → POST/PATCH/DELETE /api/rules/*
    // transactions → PATCH/DELETE /api/transactions/*
    if (categories         !== undefined) ops.push(setData(uid, "categories",         categories));
    if (plaidItems         !== undefined) ops.push(setData(uid, "plaidItems",         plaidItems));
    if (Array.isArray(calendarAccounts))   ops.push(setData(uid, "calendarAccounts",   calendarAccounts));
    if (Array.isArray(investmentAccounts)) ops.push(setData(uid, "investmentAccounts", investmentAccounts));
    if (Array.isArray(holdings))           ops.push(setData(uid, "holdings",           holdings));
    if (Array.isArray(netWorthSnapshots))  ops.push(setData(uid, "netWorthSnapshots",  netWorthSnapshots));
    if (Array.isArray(aiMessages))         ops.push(setData(uid, "aiMessages",         aiMessages));
    if (Array.isArray(aiCatExamples))      ops.push(setData(uid, "aiCatExamples",      aiCatExamples));
    if (userProfile !== undefined && userProfile !== null) ops.push(setData(uid, "userProfile", userProfile));
    if (Array.isArray(insightsTodos))      ops.push(setData(uid, "insightsTodos",      insightsTodos));
    if (dani !== undefined)                ops.push(setData(uid, "dani",              dani));
    if (theme !== undefined)               ops.push(setData(uid, "theme",             theme));
    if (analyticsInsights !== undefined)   ops.push(setData(uid, "analyticsInsights",  analyticsInsights));
    if (Array.isArray(dismissedPairs))     ops.push(setData(uid, "dismissedPairs",     dismissedPairs));
    if (scanMemory !== undefined)          ops.push(setData(uid, "scanMemory",         scanMemory));
    if (Array.isArray(aiConversations))    ops.push(setData(uid, "aiConversations",    aiConversations));
    if (aiCurrentConvId !== undefined)     ops.push(setData(uid, "aiCurrentConvId",    aiCurrentConvId));
    if (Array.isArray(goals))              ops.push(setData(uid, "goals",             goals));
    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   ACCOUNTS — incremental endpoints
   Same pattern as /api/transactions — ordered so /all comes before /:id.
═══════════════════════════════════════════════════════════════════ */

// POST /api/accounts — create a manual account
app.post("/api/accounts", requireSubscription, async (req, res) => {
  try {
    const a = req.body;
    if (!a?.id || !a?.name) return res.status(400).json({ error: "id and name required" });
    await upsertAccount(req.user.id, { ...a, isManual: true });
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/accounts/all — wipe all accounts for this user
app.delete("/api/accounts/all", requireSubscription, async (req, res) => {
  try {
    await deleteAllAccounts(req.user.id);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/accounts/plaid-item/:itemId — remove all accounts for a disconnected Plaid item
app.delete("/api/accounts/plaid-item/:itemId", requireSubscription, async (req, res) => {
  try {
    await deleteAccountsByPlaidItem(req.user.id, req.params.itemId);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// PATCH /api/accounts/:id — update a manual account's name, balance, or type
app.patch("/api/accounts/:id", requireSubscription, async (req, res) => {
  try {
    const { name, balance, type } = req.body;
    const sets = [], vals = [req.user.id, req.params.id];
    if (name    !== undefined) { vals.push(name);             sets.push(`name    = $${vals.length}`); }
    if (balance !== undefined) { vals.push(balance);          sets.push(`balance = $${vals.length}`); }
    if (type    !== undefined) { vals.push(type);             sets.push(`type    = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(Date.now());
    sets.push(`updated_at = $${vals.length}`);
    const { rowCount } = await pool.query(
      `UPDATE accounts SET ${sets.join(", ")} WHERE user_id = $1 AND id = $2`, vals
    );
    if (!rowCount) return res.status(404).json({ error: "Account not found" });
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/accounts/:id — delete one account
app.delete("/api/accounts/:id", requireSubscription, async (req, res) => {
  try {
    await deleteAccountById(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   RULES — incremental endpoints
   Ordered so /all comes before /:id.
═══════════════════════════════════════════════════════════════════ */

// POST /api/rules — create or upsert a rule
app.post("/api/rules", requireSubscription, async (req, res) => {
  try {
    const r = req.body;
    if (!r?.id || !r?.pattern) return res.status(400).json({ error: "id and pattern required" });
    await upsertRule(req.user.id, r);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/rules/all — wipe all rules for this user
app.delete("/api/rules/all", requireSubscription, async (req, res) => {
  try {
    await deleteAllRules(req.user.id);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// PATCH /api/rules/:id — update a rule
app.patch("/api/rules/:id", requireSubscription, async (req, res) => {
  try {
    const { pattern, matchType, categoryId, typeOverride, enabled } = req.body;
    const sets = [], vals = [req.user.id, req.params.id];
    if (pattern      !== undefined) { vals.push(pattern);      sets.push(`pattern       = $${vals.length}`); }
    if (matchType    !== undefined) { vals.push(matchType);    sets.push(`match_type    = $${vals.length}`); }
    if (categoryId   !== undefined) { vals.push(categoryId);   sets.push(`category_id   = $${vals.length}`); }
    if (typeOverride !== undefined) { vals.push(typeOverride);  sets.push(`type_override = $${vals.length}`); }
    if (enabled      !== undefined) { vals.push(enabled);      sets.push(`enabled       = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
    const { rowCount } = await pool.query(
      `UPDATE rules SET ${sets.join(", ")} WHERE user_id = $1 AND id = $2`, vals
    );
    if (!rowCount) return res.status(404).json({ error: "Rule not found" });
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/rules/:id — delete one rule
app.delete("/api/rules/:id", requireSubscription, async (req, res) => {
  try {
    await deleteRuleById(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   PLAID — requires subscription
═══════════════════════════════════════════════════════════════════ */
app.use("/api/plaid", requireSubscription);

app.post("/api/plaid/create_link_token", async (req, res) => {
  try {
    const requestedProducts = (req.body?.products && Array.isArray(req.body.products))
      ? req.body.products
      : PRODUCTS;

    // Investment connections require premium tier
    if (requestedProducts.includes("investments")) {
      const isPremium = req.user.role === "owner" ||
        (req.user.stripe_price_id && req.user.stripe_price_id === STRIPE_PREMIUM_PRICE_ID);
      if (!isPremium) return res.status(402).json({ error: "premium_required" });
    }

    const params = {
      user: { client_user_id: req.user.id },
      client_name: "Ledgr Finance",
      country_codes: COUNTRY_CODES, language: "en",
      redirect_uri: process.env.FRONTEND_URL,
      webhook: `${process.env.BACKEND_URL || "https://ledgr-production-9e35.up.railway.app"}/api/plaid/webhook`,
    };

    // Update mode — re-authenticate an existing item without creating a new one
    if (req.body?.item_id) {
      const item = await getItem(req.body.item_id);
      if (!item || item.user_id !== req.user.id) return res.status(404).json({ error: "Item not found" });
      params.access_token = item.access_token;
      // No products needed for update mode
    } else {
      params.products = requestedProducts;
    }

    const response = await plaidClient.linkTokenCreate(params);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("create_link_token error:", err.response?.data || err.message);
    serverError(res, err, "Failed to create link token");
  }
});

// Plaid webhook — handles token expiry and login required notifications
app.post("/api/plaid/webhook", express.json(), async (req, res) => {
  try {
    // Verify the webhook came from Plaid using the verification header
    const plaidVerificationHeader = req.headers["plaid-verification"];
    if (plaidVerificationHeader && process.env.PLAID_WEBHOOK_SECRET) {
      try {
        await plaidClient.webhookVerificationKeyGet({ key_id: plaidVerificationHeader });
      } catch (verifyErr) {
        console.error("Plaid webhook verification failed:", verifyErr.message);
        return res.status(401).json({ error: "Webhook verification failed" });
      }
    }

    const { webhook_type, webhook_code, item_id, error: plaidError } = req.body;
    console.log("Plaid webhook:", webhook_type, webhook_code, item_id);

    // Auto-sync when Plaid signals new transactions are available
    if (webhook_type === "TRANSACTIONS" && [
      "SYNC_UPDATES_AVAILABLE", "DEFAULT_UPDATE",
      "INITIAL_UPDATE", "HISTORICAL_UPDATE"
    ].includes(webhook_code)) {
      try {
        const { rows } = await pool.query(
          "SELECT user_id FROM plaid_items WHERE item_id = $1", [item_id]
        );
        if (rows.length > 0) {
          const uid = rows[0].user_id;
          const result = await syncItemTransactions(uid, item_id);
          await applySyncResultsToDB(uid, result.added, result.modified, result.removed);
          console.log(`Webhook auto-sync ${item_id}: +${result.added.length} ~${result.modified.length} -${result.removed.length}`);
        }
      } catch (e) {
        console.error(`Webhook auto-sync failed for ${item_id}:`, e.message);
      }
    }

    if (webhook_type === "ITEM") {
      if (webhook_code === "ERROR" && plaidError?.error_code === "ITEM_LOGIN_REQUIRED") {
        await pool.query("UPDATE plaid_items SET needs_reauth = true WHERE item_id = $1", [item_id]);
        console.log(`Item ${item_id} marked needs_reauth via webhook`);
      }
      if (["PENDING_EXPIRATION", "USER_PERMISSION_REVOKED", "ACCESS_CONSENT_EXPIRING", "ACCESS_CONSENT_EXPIRED"].includes(webhook_code)) {
        await pool.query("UPDATE plaid_items SET needs_reauth = true WHERE item_id = $1", [item_id]);
        console.log(`Item ${item_id} ${webhook_code} — marked needs_reauth`);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Plaid webhook error:", err.message);
    res.json({ ok: true }); // Always 200 to Plaid
  }
});

app.post("/api/plaid/exchange_public_token", async (req, res) => {
  const { public_token, institution_name } = req.body;
  if (!public_token) return res.status(400).json({ error: "public_token required" });
  try {
    const { data } = await plaidClient.itemPublicTokenExchange({ public_token });
    await saveItem(req.user.id, data.item_id, { access_token: data.access_token, institution: institution_name || "Unknown Bank", created_at: Date.now() });
    // Clear needs_reauth flag — this item is now healthy
    await pool.query("UPDATE plaid_items SET needs_reauth = false WHERE item_id = $1", [data.item_id]);
    res.json({ item_id: data.item_id, institution: institution_name });
  } catch (err) {
    console.error("exchange_public_token error:", err.response?.data || err.message);
    serverError(res, err, "Failed to connect bank");
  }
});

app.get("/api/plaid/items", async (req, res) => {
  try {
    const items = (await getItemsForUser(req.user.id)).map(({ item_id, institution, created_at, needs_reauth }) => ({ item_id, institution, created_at, needs_reauth: !!needs_reauth }));
    res.json({ items });
  } catch (err) { serverError(res, err); }
});

app.delete("/api/plaid/items/:itemId", async (req, res) => {
  try {
    const item = await getItem(req.params.itemId);
    if (!item) return res.json({ ok: true }); // already gone, treat as success
    if (item.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    try { await plaidClient.itemRemove({ access_token: item.access_token }); }
    catch (e) { console.warn("Plaid itemRemove failed:", e.message); }
    await removeItem(req.params.itemId);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});
app.get("/api/plaid/accounts", async (req, res) => {
  try {
    const items = await getItemsForUser(req.user.id);
    const allAccounts = [];
    for (const item of items) {
      try {
        const r = await plaidClient.accountsGet({ access_token: item.access_token });
        allAccounts.push(...r.data.accounts.map(a => ({
          account_id: a.account_id, item_id: item.item_id, institution: item.institution,
          name: a.name, official: a.official_name, type: a.type, subtype: a.subtype,
          mask: a.mask,
          balance: a.balances.current, available: a.balances.available, currency: a.balances.iso_currency_code,
        })));
      } catch (err) { console.error(`accountsGet error for ${item.item_id}:`, err.response?.data || err.message); }
    }
    // Deduplicate by account_id
    const seen = new Set();
    const deduped = allAccounts.filter(a => {
      if (seen.has(a.account_id)) return false;
      seen.add(a.account_id);
      return true;
    });

    // Apply user-defined name overrides stored in the accounts table
    // (upsertAccountFromPlaid preserves custom names set via PATCH /api/accounts/:id)
    const { rows: dbAccounts } = await pool.query(
      `SELECT plaid_id, name FROM accounts WHERE user_id = $1 AND plaid_id IS NOT NULL`,
      [req.user.id]
    );
    const nameOverrides = {};
    dbAccounts.forEach(row => { nameOverrides[row.plaid_id] = row.name; });
    deduped.forEach(a => {
      if (nameOverrides[a.account_id]) a.name = nameOverrides[a.account_id];
    });

    res.json({ accounts: deduped });
  } catch (err) { serverError(res, err); }
});

app.post("/api/plaid/investments/sync", requirePremium, async (req, res) => {
  try {
    const items = await getItemsForUser(req.user.id);
    const allAccounts = [];
    const allHoldings = [];

    for (const item of items) {
      try {
        // Get investment holdings (includes securities and account info)
        const r = await plaidClient.investmentsHoldingsGet({ access_token: item.access_token });

        // Build a map of security_id -> security details
        const secMap = {};
        (r.data.securities || []).forEach(s => { secMap[s.security_id] = s; });

        // Investment accounts from this item
        (r.data.accounts || []).filter(a => a.type === "investment").forEach(a => {
          allAccounts.push({
            plaidAccountId: a.account_id,
            plaidItemId:    item.item_id,
            institution:    item.institution,
            name:           a.name,
            type:           a.subtype || "Brokerage",
            subtype:        a.subtype || "",
            balance:        a.balances.current || 0,
            currency:       a.balances.iso_currency_code || "USD",
          });
        });

        // Holdings
        (r.data.holdings || []).forEach(h => {
          const sec = secMap[h.security_id] || {};
          const acct = allAccounts.find(a => a.plaidAccountId === h.account_id);
          if (!acct) return;
          allHoldings.push({
            accountId:    acct.plaidAccountId, // will be matched in frontend
            ticker:       sec.ticker_symbol || sec.name?.slice(0,6) || "N/A",
            name:         sec.name || sec.ticker_symbol || "Unknown",
            quantity:     h.quantity || 0,
            currentPrice: h.institution_price || 0,
            currentValue: h.institution_value || 0,
            costBasis:    h.cost_basis || 0,
            fromPlaid:    true,
          });
        });
      } catch (err) {
        // Item may not have investment products — skip silently
        const code = err.response?.data?.error_code;
        if (code !== "PRODUCTS_NOT_SUPPORTED" && code !== "ITEM_NOT_SUPPORTED") {
          console.warn(`investments sync error for ${item.item_id}:`, code || err.message);
        }
      }
    }

    res.json({ accounts: allAccounts, holdings: allHoldings });
  } catch (err) { serverError(res, err); }
});

app.post("/api/plaid/transactions/sync", syncLimiter, async (req, res) => {
  const { item_id: targetItemId } = req.body;
  if (targetItemId) {
    const item = await getItem(targetItemId);
    if (!item || item.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await syncItemTransactions(req.user.id, targetItemId || null);
    res.json(result);
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   TRANSACTIONS — incremental endpoints
   These replace the full-array save via PATCH /api/data.
   Ordering matters: /bulk and /all must come before /:id so Express
   doesn't treat "bulk" or "all" as a transaction ID.
═══════════════════════════════════════════════════════════════════ */

// camelCase → snake_case map for every user-editable field
const TXN_FIELD_MAP = {
  name:            "name",
  merchant:        "merchant",
  categoryId:      "category_id",
  userCategorized: "user_categorized",
  reviewed:        "reviewed",
  type:            "type",
  notes:           "notes",
  accountId:       "account_id",
  recurring:       "recurring",
  recurringDay:    "recurring_day",
  recurringFreq:   "recurring_freq",
  recurringStart:  "recurring_start",
  pending:         "pending",
  amount:          "amount",
  date:            "date",
};

// POST /api/transactions — create a manual transaction (or restore an undo)
app.post("/api/transactions", requireSubscription, async (req, res) => {
  try {
    const t = req.body;
    if (!t?.id) return res.status(400).json({ error: "id required" });
    await upsertTransactionRow(req.user.id, t);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// PATCH /api/transactions/bulk — update one field set across many transactions
app.patch("/api/transactions/bulk", requireSubscription, async (req, res) => {
  try {
    const { ids, patch } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array required" });
    if (!patch || typeof patch !== "object")  return res.status(400).json({ error: "patch object required" });
    const sets = [], vals = [req.user.id, ids];
    for (const [camel, snake] of Object.entries(TXN_FIELD_MAP)) {
      if (patch[camel] !== undefined) {
        vals.push(patch[camel] === "" ? null : patch[camel]);
        sets.push(`${snake} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(Date.now());
    sets.push(`updated_at = $${vals.length}`);
    await pool.query(
      `UPDATE transactions SET ${sets.join(", ")} WHERE user_id = $1 AND id = ANY($2::text[])`,
      vals
    );
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/transactions/bulk — delete a specific set of transactions
app.delete("/api/transactions/bulk", requireSubscription, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array required" });
    await pool.query(
      `DELETE FROM transactions WHERE user_id = $1 AND id = ANY($2::text[])`,
      [req.user.id, ids]
    );
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/transactions/all — wipe all transactions, or just those for one Plaid item
app.delete("/api/transactions/all", requireSubscription, async (req, res) => {
  try {
    const { plaidItemId } = req.body || {};
    if (plaidItemId) {
      await pool.query(
        `DELETE FROM transactions WHERE user_id = $1 AND plaid_item_id = $2`,
        [req.user.id, plaidItemId]
      );
    } else {
      await pool.query(`DELETE FROM transactions WHERE user_id = $1`, [req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// PATCH /api/transactions/:id — update any user-editable fields on one transaction
app.patch("/api/transactions/:id", requireSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const sets = [], vals = [req.user.id, id];
    for (const [camel, snake] of Object.entries(TXN_FIELD_MAP)) {
      if (req.body[camel] !== undefined) {
        vals.push(req.body[camel] === "" ? null : req.body[camel]);
        sets.push(`${snake} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(Date.now());
    sets.push(`updated_at = $${vals.length}`);
    const { rowCount } = await pool.query(
      `UPDATE transactions SET ${sets.join(", ")} WHERE user_id = $1 AND id = $2`,
      vals
    );
    if (!rowCount) return res.status(404).json({ error: "Transaction not found" });
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/transactions/:id — delete one transaction
app.delete("/api/transactions/:id", requireSubscription, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM transactions WHERE user_id = $1 AND id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   PUSH
═══════════════════════════════════════════════════════════════════ */
app.post("/api/push/subscribe", async (req, res) => {
  try {
    if (!req.body?.endpoint) return res.status(400).json({ error: "Invalid subscription" });
    await saveSubscription(req.user.id, req.body);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  try {
    if (req.body?.endpoint) await removeSubscription(req.user.id, req.body.endpoint);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/push/test", async (req, res) => {
  try {
    await sendPushToUser(req.user.id, { title: "ledgr. test", body: "Push notifications are working!", url: "/" });
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   AI ASSISTANT
═══════════════════════════════════════════════════════════════════ */

// Get whether user has an API key (never return the raw key)
app.get("/api/ai/key", async (req, res) => {
  try {
    const row = await getData(req.user.id, "aiApiKey");
    res.json({ hasKey: !!row });
  } catch (err) { serverError(res, err); }
});

// Save encrypted API key
app.patch("/api/ai/key", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      // Allow clearing the key
      await setData(req.user.id, "aiApiKey", null);
      return res.json({ ok: true });
    }
    if (!key.startsWith("sk-ant-")) {
      return res.status(400).json({ error: "Invalid Anthropic API key format" });
    }
    await setData(req.user.id, "aiApiKey", encrypt(key));
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// Chat endpoint — streams Claude's response
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    // Get user's encrypted API key
    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // Build system prompt with user's financial context
    const { categories = [], accounts = [], thisMonthTransactions = [],
            lastMonthTransactions = [], recentTransactions = [],
            currentMonth = "", totalTransactions = 0 } = context;

    const systemPrompt = `You are a helpful personal finance assistant for a user of Ledgr, a budgeting app.

You have access to the user's financial data for this conversation. Be concise, specific, and use actual numbers from their data. Format currency as dollars. When referencing transactions, use merchant names. Keep responses focused and practical.

Current month: ${currentMonth}
Total transactions on record: ${totalTransactions}

Budget categories:
${categories.map(c => `- ${c.name}: $${c.spent.toFixed(2)} spent of $${(c.limit || 0).toFixed(2)} budget`).join("\n") || "None set up yet"}

Accounts:
${accounts.map(a => `- ${a.name} (${a.type}): $${(a.balance || 0).toFixed(2)}`).join("\n") || "None connected"}

This month's transactions (${thisMonthTransactions.length}):
${thisMonthTransactions.slice(0, 50).map(t =>
  `${t.date} | ${t.merchant} | $${Math.abs(t.amount).toFixed(2)} ${t.amount < 0 ? "expense" : "income"}${t.category ? ` | ${t.category}` : ""}${t.pending ? " (pending)" : ""}`
).join("\n") || "None yet this month"}

Last month's transactions (sample of ${lastMonthTransactions.length}):
${lastMonthTransactions.slice(0, 30).map(t =>
  `${t.date} | ${t.merchant} | $${Math.abs(t.amount).toFixed(2)} ${t.amount < 0 ? "expense" : "income"}${t.category ? ` | ${t.category}` : ""}`
).join("\n") || "None"}`;

    // Build message history for Claude
    const claudeMessages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // Call Claude API with streaming
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", // sonnet: better cost/latency balance for chat; opus is overkill here
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      const msg = err.error?.message || `Claude API error: ${claudeRes.status}`;
      return res.status(claudeRes.status).json({ error: msg });
    }

    // Stream response back to client as SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = claudeRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
            } else if (parsed.type === "message_stop") {
              res.write("data: [DONE]\n\n");
            }
          } catch { /* skip */ }
        }
      }
    }

    res.end();
  } catch (err) {
    console.error("AI chat error:", err.message);
    if (!res.headersSent) serverError(res, err);
    else res.end();
  }
});

// Auto-categorize uncategorized transactions using Claude
app.post("/api/ai/categorize", async (req, res) => {
  try {
    const { transactions = [], categories = [], examples = [] } = req.body;

    if (!transactions.length) return res.json({ assignments: {} });

    // Get user's encrypted API key
    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // Build compact prompt
    const catList = categories.map(c => `${c.id}: ${c.name}`).join("\n");
    const exampleList = examples.slice(-60).map(e =>
      `"${e.merchant}" → ${e.categoryId}`
    ).join("\n");

    const txnList = transactions.map(t =>
      `id:${t.id} merchant:"${t.merchant}" amount:${t.amount}`
    ).join("\n");

    const prompt = `You are categorizing financial transactions. Return ONLY valid JSON, no other text.

Categories available (id: name):
${catList}

Past categorizations to learn from (merchant → categoryId):
${exampleList || "None yet"}

Transactions to categorize:
${txnList}

Return a JSON object mapping transaction id to the best matching category id.
Only include transactions you can confidently categorize. Skip if unsure.
Example: {"txn123": "cat456", "txn789": "cat101"}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // fast + cheap for categorization
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";

    // Parse JSON from response, strip any markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    let assignments = {};
    try { assignments = JSON.parse(clean); } catch { assignments = {}; }

    // Validate — only keep assignments where categoryId exists in our list
    const validCatIds = new Set(categories.map(c => c.id));
    const validAssignments = {};
    for (const [txnId, catId] of Object.entries(assignments)) {
      if (validCatIds.has(catId)) validAssignments[txnId] = catId;
    }

    res.json({ assignments: validAssignments });
  } catch (err) {
    console.error("AI categorize error:", err.message);
    serverError(res, err);
  }
});

// POST /api/ai/suggest-categories — when user has no categories, suggest a full
// category set based on their transaction history.
app.post("/api/ai/suggest-categories", async (req, res) => {
  try {
    const { transactions = [] } = req.body;
    if (!transactions.length) return res.json({ suggestions: [] });

    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    const txnList = transactions.slice(0, 100).map(t =>
      `id:${t.id} merchant:"${t.merchant}" amount:$${Math.abs(t.amount).toFixed(2)}`
    ).join("\n");

    const prompt = `You are a personal finance assistant. Analyze these expense transactions and suggest a minimal, practical set of budget categories that covers them well.

Transactions:
${txnList}

Return ONLY valid JSON with this structure — no markdown, no explanation:
{
  "categories": [
    {
      "name": "Groceries",
      "color": "#22c55e",
      "suggestedLimit": 400,
      "transactions": ["txn-id-1", "txn-id-2"]
    }
  ]
}

Rules:
- Suggest 5-12 categories max. Be practical, not overly granular.
- Each category needs a name, a hex color, a suggested monthly limit (based on transaction amounts), and an array of transaction IDs that belong to it.
- Use distinct, visually different colors.
- suggestedLimit should be a round number reflecting realistic monthly spending for that category.
- Every transaction should belong to exactly one category. Uncategorizable transactions can be omitted.
- Common good categories: Groceries, Dining, Gas, Subscriptions, Shopping, Utilities, Healthcare, Entertainment, Travel, Personal Care.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    let result = { categories: [] };
    try { result = JSON.parse(clean); } catch { result = { categories: [] }; }

    res.json({ suggestions: result.categories || [] });
  } catch (err) {
    console.error("AI suggest-categories error:", err.message);
    serverError(res, err);
  }
});

// Suggest budget limits based on historical spending
app.post("/api/ai/suggest-limits", async (req, res) => {
  try {
    const { categories = [], monthlySpending = [], avgMonthlyIncome = 0 } = req.body;
    if (!categories.length) return res.json({ suggestions: [] });

    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // Build spending summary per category across months
    const catSummary = categories.map(c => {
      const monthly = monthlySpending.map(m => ({
        month: m.month,
        spent: m.byCategory[c.id] || 0,
      }));
      const months  = monthly.filter(m => m.spent > 0);
      const avg     = months.length ? months.reduce((s, m) => s + m.spent, 0) / months.length : 0;
      const max     = months.length ? Math.max(...months.map(m => m.spent)) : 0;
      return {
        id:           c.id,
        name:         c.name,
        currentLimit: c.limit || 0,
        avgSpending:  Math.round(avg * 100) / 100,
        maxSpending:  Math.round(max * 100) / 100,
        monthsOfData: months.length,
        monthlyDetail: monthly.map(m => `${m.month}: $${m.spent.toFixed(2)}`).join(", "),
      };
    }).filter(c => c.monthsOfData > 0);

    if (!catSummary.length) return res.json({ suggestions: [] });

    const prompt = `You are a personal finance advisor analyzing a user's spending habits to suggest monthly budget limits.

${avgMonthlyIncome > 0 ? `Average monthly income: $${avgMonthlyIncome.toFixed(2)}` : ""}

Spending history by category (last 3 months):
${catSummary.map(c => `
Category: ${c.name} (id: ${c.id})
Current limit: $${c.currentLimit.toFixed(2)}
Average monthly spending: $${c.avgSpending.toFixed(2)}
Highest month: $${c.maxSpending.toFixed(2)}
Monthly detail: ${c.monthlyDetail}`).join("\n")}

Suggest a realistic monthly budget limit for each category. Consider:
- Slightly above average spending (10-15%) to be achievable but not too loose
- Round to nearest $5 or $10 for clean numbers
- If current limit is already sensible, you can keep it
- Skip categories with less than 2 months of data

Return ONLY valid JSON, no other text:
{
  "suggestions": [
    {
      "categoryId": "string",
      "suggestedLimit": number,
      "reasoning": "one short sentence explaining why"
    }
  ]
}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    let parsed = { suggestions: [] };
    try { parsed = JSON.parse(clean); } catch { parsed = { suggestions: [] }; }

    // Validate
    const validCatIds = new Set(categories.map(c => c.id));
    const suggestions = (parsed.suggestions || []).filter(s =>
      validCatIds.has(s.categoryId) &&
      typeof s.suggestedLimit === "number" &&
      s.suggestedLimit > 0
    );

    res.json({ suggestions });
  } catch (err) {
    console.error("AI suggest-limits error:", err.message);
    serverError(res, err);
  }
});

// Financial insights summary — non-streaming JSON response
app.post("/api/ai/insights", async (req, res) => {
  try {
    const { context = {} } = req.body;

    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // If user provided corrections, mark income as user-corrected so Claude doesn't flag it as approximate
    const enrichedContext = { ...context };
    if (context.userCorrections) {
      enrichedContext.incomeSource = "user-corrected — treat userCorrections as ground truth, do not question income figures";
    }

    const correctionsBlock = context.userCorrections
      ? `\nUSER CORRECTIONS (highest priority — override anything in the data below):\n${context.userCorrections}\n`
      : "";

    const prompt = `You are a personal finance advisor. Write a concise honest financial health summary.

RULES (follow strictly):
- USER CORRECTIONS override all computed data. If corrections state an income figure, use it without question and do NOT generate an insight telling the user to verify it.
- Use categoryBreakdown to verify spending numbers — do your own math.
- Cross-check subscriptions against categoryBreakdown before calling anything a subscription. Large recurring items like rent are NOT subscriptions.
- Only flag income as approximate if incomeSource says "estimated" AND no userCorrections were provided.
- Never invent numbers not present in the data.
${correctionsBlock}
Financial data:
${JSON.stringify(enrichedContext, null, 2)}

Return ONLY valid JSON (no markdown fences):
{"headline":"one sentence summary","score":75,"scoreLabel":"Good","insights":[{"type":"positive|warning|neutral","title":"short title","body":"1-2 sentences with specific numbers","suggestion":"one concrete action — omit entirely if type is positive"}],"recommendation":"one concrete action for this month"}
Include 3-5 insights. Be specific with dollar amounts. Only include suggestion for warning/neutral insights.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    let insights = {};
    try { insights = JSON.parse(clean); } catch { insights = {}; }

    res.json(insights);
  } catch (err) {
    console.error("AI insights error:", err.message);
    serverError(res, err);
  }
});




app.get("/api/admin/users", requireOwner, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, email, role, subscription_status, trial_ends_at, stripe_customer_id, last_activity_at, created_at FROM users ORDER BY created_at ASC");
    // Convert BIGINT strings to numbers for JSON serialization
    const users = rows.map(u => ({
      ...u,
      trial_ends_at:  u.trial_ends_at  ? Number(u.trial_ends_at)  : null,
      last_activity_at: u.last_activity_at ? Number(u.last_activity_at) : null,
      created_at:     u.created_at     ? Number(u.created_at)     : null,
    }));
    res.json({ users });
  } catch (err) { serverError(res, err); }
});

app.patch("/api/admin/users/:userId", requireOwner, async (req, res) => {
  const { subscription_status, role, trial_ends_at } = req.body;
  const validStatuses = ["active", "trialing", "canceled", "past_due", "expired"];
  const validRoles    = ["owner", "subscriber", "free"];
  if (subscription_status && !validStatuses.includes(subscription_status))
    return res.status(400).json({ error: "Invalid subscription_status" });
  if (role && !validRoles.includes(role))
    return res.status(400).json({ error: "Invalid role" });
  try {
    const fields = [], vals = [];
    if (subscription_status) { fields.push(`subscription_status = $${fields.length+1}`); vals.push(subscription_status); }
    if (role)                 { fields.push(`role = $${fields.length+1}`);                vals.push(role); }
    if (trial_ends_at)        { fields.push(`trial_ends_at = $${fields.length+1}`);       vals.push(Number(trial_ends_at)); }
    if (!fields.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.userId);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${vals.length}`, vals);
    res.json({ ok: true });
  } catch (err) { serverError(res, err, "Failed to update user"); }
});

app.delete("/api/admin/users/:userId", requireOwner, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: "Cannot delete your own account" });
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/admin/encrypt-tokens", requireOwner, async (_req, res) => {
  if (!ENCRYPT_KEY) return res.status(500).json({ error: "ENCRYPT_KEY not set" });
  try {
    const { rows } = await pool.query("SELECT item_id, access_token FROM plaid_items");
    let migrated = 0, skipped = 0;
    for (const row of rows) {
      if (row.access_token.includes(":")) { skipped++; continue; }
      await pool.query("UPDATE plaid_items SET access_token = $1 WHERE item_id = $2", [encrypt(row.access_token), row.item_id]);
      migrated++;
    }
    res.json({ ok: true, migrated, skipped });
  } catch (err) { serverError(res, err); }
});

/* ── Start ────────────────────────────────────────────────────────── */
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  🏦  Ledgr backend (multi-user + Stripe)`);
    console.log(`  =>  http://localhost:${PORT}/api/health`);
    console.log(`  =>  Plaid:      ${PLAID_ENV}`);
    console.log(`  =>  Stripe:     ${process.env.STRIPE_SECRET_KEY ? "enabled" : "DISABLED"}`);
    console.log(`  =>  Auth:       ${JWT_SECRET ? "enabled" : "DISABLED"}`);
    console.log(`  =>  Owner:      ${OWNER_EMAIL || "(first registered user)"}\n`);
  });
}).catch(err => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
