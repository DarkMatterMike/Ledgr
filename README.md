# Ledgr

A personal finance app with bank syncing, budget tracking, AI categorization, and recurring transaction management.

---

## Stack

| Layer     | Technology                                     |
|-----------|------------------------------------------------|
| Frontend  | React + Vite, deployed on Vercel               |
| Backend   | Node.js + Express, deployed on Railway         |
| Database  | Neon (PostgreSQL)                              |
| Auth      | JWT (email/password) + Google OAuth            |
| Banking   | Plaid (transactions, accounts, webhooks)       |
| Payments  | Stripe (subscriptions, billing portal)         |
| Email     | Resend                                         |
| Push      | Web Push API + VAPID                           |

---

## Repository Structure

```
ledgr/
├── backend/
│   ├── server.js          # Express HTTP server — routes only, no cron
│   ├── db.js              # All DB logic: queries, email, Plaid sync, push
│   ├── worker.js          # Background cron jobs (trial emails, Plaid sync)
│   └── scripts/           # One-off migration scripts
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Root orchestrator — owns all shared state
│   │   ├── api.js                   # All API calls + auth token management
│   │   ├── constants.js             # CAT_COLORS, NAV config, utility fns
│   │   ├── demoData.js              # Fake data for ?demo=true mode
│   │   │
│   │   ├── auth/
│   │   │   ├── Legal.jsx            # Privacy Policy + Terms of Service
│   │   │   └── SecurityBadges.jsx   # Trust badges shown on register
│   │   │
│   │   ├── components/
│   │   │   ├── MerchantIcon.jsx     # Google favicon with fallback
│   │   │   ├── TxnRow.jsx           # Transaction list row + expand panel
│   │   │   ├── ui/index.jsx         # Modal, Toast, CustomSelect, CategoryBadge, PageLayout
│   │   │   └── layout/
│   │   │       ├── Sidebar.jsx      # Desktop sidebar nav
│   │   │       ├── BottomNav.jsx    # Mobile bottom navigation
│   │   │       └── InstallPrompt.jsx # PWA install prompt
│   │   │
│   │   ├── context/
│   │   │   └── AppContext.js        # React context — eliminates prop drilling (Phase 3)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAppData.js        # Server load/save/scheduleSave logic
│   │   │   ├── useAiChat.js         # AI chat state management
│   │   │   ├── useDuplicateScan.js  # Transaction duplicate detection
│   │   │   └── usePortfolio.js      # Portfolio/investments state
│   │   │
│   │   ├── theme/
│   │   │   └── index.js             # S style object, applyTheme, applyGlobalOpacity
│   │   │
│   │   ├── Analytics.jsx            # Analytics page (separate for code splitting)
│   │   ├── AiChat.jsx               # AI assistant page
│   │   ├── DaniPage.jsx             # Dani wishlist page
│   │   └── PortfolioView.jsx        # Portfolio tracking page
│   │
│   ├── index.html
│   ├── index.css          # CSS custom properties (design tokens)
│   └── vercel.json        # SPA routing rewrites
│
└── ledgr-landing/         # Separate repo — marketing landing page
```

---

## Architecture

### State Management

All shared application state lives in `AppInner` (inside `App.jsx`). Pages are defined as inline variables within `AppInner` so they share state via closure — no prop drilling needed for most things. Extracted standalone components (in `/components`) receive data via props.

`AppContext.js` is prepared for Phase 3 migration, which will move shared state into context so extracted page components don't need props passed through.

### Data Flow

```
Plaid API → server.js (webhook / manual sync)
          → db.js (applySyncResultsToDB)
          → PostgreSQL (Neon)
          ← api.js (loadTransactions, loadData)
          ← useAppData.js (scheduleSave / debounced patch)
          ← AppInner state (React)
          ← Pages / Components (render)
```

### Saving Strategy

User changes are **immediately reflected in local state** then debounced to the server via `scheduleSave()` in `useAppData`. Transactions use dedicated `PATCH /api/transactions/:id` endpoints rather than the bulk save, so individual updates are atomic.

### Auth

JWT tokens embed `userId`, `role`, and `tv` (token version). On logout, the server increments `token_version` in the DB — any previously issued tokens with a lower `tv` are rejected, invalidating all sessions.

### Plaid Reconnect

When a bank reconnects after expiry, `exchange_public_token` removes existing items for the same institution before saving the new one. After syncing, `relinkTransactionsToNewAccounts()` re-links orphaned transactions to new account IDs by matching on account mask (last 4 digits).

---

## Environment Variables

### Backend (Railway)

| Variable                  | Description                              |
|---------------------------|------------------------------------------|
| `DATABASE_URL`            | Neon PostgreSQL connection string        |
| `JWT_SECRET`              | Token signing secret (required)          |
| `ENCRYPT_KEY`             | AES-256 key for Plaid access tokens      |
| `OWNER_EMAIL`             | Your email — grants owner role on login  |
| `PLAID_CLIENT_ID`         | Plaid app client ID                      |
| `PLAID_SECRET`            | Plaid secret key                         |
| `PLAID_ENV`               | `sandbox` or `production`                |
| `STRIPE_SECRET_KEY`       | Stripe secret key                        |
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook signing secret            |
| `STRIPE_PRICE_ID`         | Stripe price ID for subscription         |
| `RESEND_API_KEY`          | Resend email API key                     |
| `VAPID_PUBLIC_KEY`        | Web push public key                      |
| `VAPID_PRIVATE_KEY`       | Web push private key                     |
| `FRONTEND_URL`            | `https://app.ledgrfinance.app`           |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID                   |

### Frontend (Vercel)

| Variable        | Description                                        |
|-----------------|----------------------------------------------------|
| `VITE_API_URL`  | Backend URL (e.g. `https://ledgr-production...`)   |

---

## Development

```bash
# Backend
cd backend
npm install
npm run dev       # nodemon server.js on port 3001

# Frontend
cd frontend
npm install
npm run dev       # Vite dev server on port 5173
```

### Demo Mode

Visit `?demo=true` to load the app with fake data. No API calls are made, nothing is saved. Useful for testing UI changes without a backend.

---

## Deployment

- **Frontend** — push to `main` → Vercel auto-deploys from `frontend/` root directory
- **Backend** — push to `main` → Railway auto-deploys `backend/server.js`
- **Worker** — separate Railway service running `backend/worker.js` (cron jobs)

---

## Roadmap

- **Phase 3** — Migrate remaining pages out of `App.jsx` into `/pages` using `AppContext`
- **Staging** — `dev` branch → separate Railway + Neon + Vercel project with `PLAID_ENV=sandbox`
- **TypeScript** — Incremental migration starting with `/components` and `/hooks`
