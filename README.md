# DocVault

Secure document management application.

## Project layout

```text
frontend/                 React application and Vite entry point
  src/                    Pages, components, contexts, services and UI utilities
  index.html              Frontend HTML entry
  tsconfig.json           Frontend TypeScript configuration
backend/                  Express API and HTTP routes
  index.ts                API server entry point
  routes/                 Authentication, documents and administration routes
  tsconfig.json           Backend TypeScript configuration
database/                 SQLite schema, migrations and row mappers
  db.ts
  data/                   Local SQLite database files (ignored by Git)
security/                 Encryption and key migration code
  crypto.ts
  migrateEncryption.ts
  docs/                   Security and encryption operational guidance
vite.config.ts             Frontend build, dev server and API proxy
```

## Local development

1. Create `.env` from `.env.example` and set `DOCVAULT_MASTER_KEY` to 64 hexadecimal characters. Keep the real key out of Git.
2. Install dependencies with `npm install`.
3. Start the frontend and API together with `npm run dev`.
4. Open `http://localhost:3000`. Vite proxies `/api` requests to the API on port `3001`.

Useful commands:

- `npm run dev:web` starts only the frontend.
- `npm run server` starts only the API.
- `npm run lint` type-checks frontend and backend code.
- `npm run build` builds the frontend into `dist/`.
- `npm run migrate:encryption` migrates or rewraps stored document keys.

The database defaults to `database/data/docvault.db`. Set `DOCVAULT_DB_PATH` to use another SQLite file.

## Security operations

Read [the access-control and encryption guide](security/docs/ACCESS_CONTROL_AND_ENCRYPTION.md) before migrating document blobs or rotating the master key.
