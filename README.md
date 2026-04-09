# ledgr.

Personal finance budgeting app with real Plaid bank integration. Dark UI, built with React + Vite (frontend) and Express + SQLite (backend).

---

## Features

- 🏦 **Real Plaid integration** — connect any US bank account via Plaid Link
- 📊 **Budget categories** — create categories with monthly limits and colour codes
- 📈 **Progress bars** — live spend vs. budget, warnings at 80% / 100%
- 💳 **Account tracking** — per-account spending, daily rate, and end-of-month projection
- 🔄 **Incremental sync** — cursor-based Plaid transaction sync (only fetches new data)
- ✏️ **Rename transactions** — give any transaction a custom label
- ➕ **Manual transactions** — add cash or non-Plaid entries
- 💾 **Persistent** — localStorage on the frontend; SQLite on the backend

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 + |
| npm | 9 + |

---

## 1 — Get Plaid API Keys

1. Go to [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup) and create a free account.
2. In the dashboard, navigate to **Team Settings → Keys**.
3. Copy your **Client ID** and **Sandbox secret** (use Sandbox for development — it's free and includes test banks).

---

## 2 — Clone & Install

```bash
git clone <your-repo-url> ledgr
cd ledgr

# Install all dependencies (root + backend + frontend)
npm run install:all
```

---

## 3 — Configure the Backend

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

## 4 — Run Locally

```bash
# Start both backend and frontend with one command
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend:  [http://localhost:3001/api/health](http://localhost:3001/api/health)

The Vite dev server proxies all `/api` requests to the Express backend automatically.

---

## 5 — Connect a Bank (Sandbox)

1. Open the app and click **Connect a Bank**.
2. Plaid Link will open. In Sandbox mode, use these test credentials:
   - **Username:** `user_good`
   - **Password:** `pass_good`
3. Select any institution and complete the flow.
4. Transactions will sync automatically.

---

## Project Structure

```
ledgr/
├── backend/
│   ├── server.js          # Express + Plaid API routes
│   ├── package.json
│   ├── .env.example       # Copy to .env and fill in your keys
│   └── ledgr.db           # Auto-created SQLite DB (gitignored)
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx       # React entry point
│   │   ├── App.jsx        # Full app (all screens + UI)
│   │   ├── api.js         # Backend API client
│   │   └── index.css      # Global styles + CSS variables
│   ├── index.html
│   ├── vite.config.js     # Dev proxy config
│   └── package.json
│
├── package.json           # Root — runs both servers together
└── .gitignore
```

---

## Backend API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/plaid/create_link_token` | Get link token for Plaid Link |
| `POST` | `/api/plaid/exchange_public_token` | Exchange public token → access token |
| `GET`  | `/api/plaid/items` | List connected banks |
| `DELETE` | `/api/plaid/items/:itemId` | Disconnect a bank |
| `GET`  | `/api/plaid/accounts` | Fetch all accounts |
| `POST` | `/api/plaid/transactions/sync` | Incremental transaction sync |

---

## Deploying to Production

### Backend (Railway / Render / Fly.io)

1. Push the `backend/` folder as a Node service.
2. Set environment variables in the platform dashboard (same as `.env`).
3. Change `PLAID_ENV=production` and use your **Production secret** (requires Plaid approval).
4. Update `FRONTEND_URL` to your deployed frontend URL.

### Frontend (Vercel / Netlify / Cloudflare Pages)

1. Build: `npm run build` inside `frontend/`.
2. Deploy the `frontend/dist/` folder.
3. Set the environment variable `VITE_API_URL` to your backend URL.
4. Update `src/api.js` — change `const BASE = "/api"` to `const BASE = import.meta.env.VITE_API_URL + "/api"`.

---

## Moving to Production Plaid

When you're ready to connect real bank accounts:

1. Complete Plaid's **application review** at dashboard.plaid.com.
2. Switch `PLAID_ENV=production` and use your Production secret.
3. Ensure your backend is on HTTPS (Plaid requires it for production).
4. Add proper user authentication — right now the app uses a single `client_user_id`. In production, tie each item to a real user ID.

---

## Upgrade Ideas

- [ ] Add user authentication (e.g. Clerk, Auth.js, or Supabase Auth)
- [ ] Store transactions in a real DB (PostgreSQL via Prisma or Supabase)
- [ ] Add Plaid Webhooks for real-time updates (`TRANSACTIONS_DEFAULT_UPDATE`)
- [ ] Export to CSV
- [ ] Recurring transaction detection
- [ ] Email / push budget alerts when approaching limits
