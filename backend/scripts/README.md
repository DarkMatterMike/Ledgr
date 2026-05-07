# Backend Migration Scripts

These are one-time data migration scripts. Run manually via Node when needed.
**Do not run in production without understanding what each script does.**

| Script | Purpose |
|---|---|
| `migrate.js` | Initial schema setup / seed |
| `migrate-accounts.js` | Account data migration |
| `migrate-rules.js` | Rules data migration |
| `migrate-transactions.js` | Transaction data migration |

## Usage
```bash
cd backend
node scripts/migrate.js
```
