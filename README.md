# Ledgr — Personal Finance Platform

A full-stack personal finance application with bank sync, budgeting, recurring transaction tracking, AI-powered insights, and goal management.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon) |
| Auth | JWT + Google OAuth |
| Banking | Plaid API |
| Payments | Stripe |
| Email | Resend |
| Push Notifications | Web Push (VAPID) |
| Hosting | Vercel (frontend), Railway (backend) |

## Project Structure

```
ledgr/
├── frontend/               # React/Vite application
│   ├── src/
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useAppData.js       # Data loading / saving
│   │   │   ├── useAiChat.js        # AI chat state
│   │   │   ├── useDuplicateScan.js # Duplicate detection
│   │   │   └── usePortfolio.js     # Portfolio data
│   │   ├── App.jsx         # Main application
│   │   ├── Analytics.jsx   # Analytics views
│   │   ├── AiChat.jsx      # AI chat component
│   │   ├── DaniPage.jsx    # Internal page
│   │   ├── PortfolioView.jsx
│   │   ├── api.js          # API client
│   │   ├── demoData.js     # Demo mode data
│   │   └── index.css       # Global styles / design tokens
│   ├── .env.example        # Required environment variables
│   └── vercel.json
├── backend/                # Express API server
│   ├── scripts/            # One-time migration scripts
│   ├── server.js           # Express app, routes
│   ├── db.js               # PostgreSQL helpers
│   ├── worker.js           # Background jobs
│   └── .env.example        # Required environment variables
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Plaid developer account
- Stripe account

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in .env.local with your values
npm install
npm run dev
```

### Backend

```bash
cd backend
cp .env.example .env
# Fill in .env with your values
npm install
npm start
```

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` for all required variables.

## Features

- **Bank Sync** — Connect accounts via Plaid, auto-sync transactions
- **Budgeting** — Category budgets with visual progress tracking
- **Recurring Tracking** — Detect and manage recurring charges
- **Calendar View** — Monthly transaction calendar with split-period view
- **AI Insights** — Spending analysis, budget suggestions, anomaly detection
- **Goals** — Savings goals with progress tracking
- **Rules Engine** — Auto-categorize transactions by merchant/type
- **Portfolio** — Investment account tracking
- **Themes** — Fully customizable color themes with 20 presets
- **PWA** — Installable on iOS and Android with push notifications

## Security

- JWT authentication with secure httpOnly considerations
- Passwords hashed with bcrypt
- Plaid access tokens AES-256 encrypted at rest
- Helmet.js security headers
- Rate limiting on all auth endpoints
- CORS restricted to known origins
