# Deployment Guide

This project is ready to push to GitHub as a local full-stack hostel management app.

Vercel can deploy the React frontend from this repository, but the current backend is designed for a Windows/local server because it uses:

- SQLite files in `data/`
- Aadhar document uploads in `uploads/`
- Windows OCR through PowerShell for image extraction
- Local Excel workbook generation

Vercel does not provide permanent filesystem storage for SQLite databases or uploaded documents. For a production Vercel deployment, migrate these services first:

| Current local feature | Vercel-ready replacement |
| --- | --- |
| SQLite file database | Neon Postgres, Supabase Postgres, or Turso |
| `uploads/` folder | Vercel Blob, Supabase Storage, S3, or Cloudinary |
| Windows OCR scripts | Manual entry, browser OCR, or a cloud OCR provider |
| Local Excel workbook file | Generate workbook on-demand from the external database |

## GitHub Push

From the project folder:

```bash
git init
git add .
git commit -m "Initial SWAMI hostel ledger app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## Vercel Frontend Preview

The included `vercel.json` deploys the Vite frontend:

```bash
pnpm install
pnpm build
```

In Vercel:

1. Import the GitHub repository.
2. Keep framework preset as `Vite`.
3. Use `pnpm build` as the build command.
4. Use `dist` as the output directory.

The frontend preview will build, but API actions need the backend migration described above before the hosted app can store real hostel data reliably.

## Recommended Production Path

For a real hosted version:

1. Keep this repository as the main app.
2. Replace SQLite with a hosted Postgres database.
3. Replace local uploads with hosted object storage.
4. Convert Express routes to Vercel serverless API routes or host the Express backend on Render, Railway, Fly.io, or a VPS.
5. Deploy the frontend on Vercel.

## Phase 2: single-owner authentication

The dashboard and every data API require a verified Supabase email/password session whose user UUID exactly matches `OWNER_USER_ID`. There is no registration UI. Keep public sign-up disabled in Supabase.

### Create the owner

1. In the Supabase project, open **Authentication → Users**.
2. Select **Add user → Create new user**, enter the owner's email and a strong password, and mark the email confirmed if appropriate. Do not put the password in this repository or Vercel.
3. Copy the new user's UUID from the Users table (not the email) into the server variable `OWNER_USER_ID`.
4. Open **Authentication → Providers → Email** and disable **Allow new users to sign up**. Keep email/password sign-in enabled.

### Local variables

Copy `.env.example` to `.env` and fill it locally. The browser variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Server configuration is `SUPABASE_URL`; server-only secrets are `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `AADHAAR_HMAC_SECRET`, and `AADHAAR_ENCRYPTION_KEY`. Never prefix a server secret with `VITE_` and never commit `.env`.

### Vercel variables

In **Project Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the Vite build. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `AADHAAR_HMAC_SECRET`, and `AADHAAR_ENCRYPTION_KEY` for server functions. Select the intended Preview/Production environments, save, and redeploy. Values must come from the matching Supabase project; do not expose or log them.

The anon key and URL are public browser configuration. The service-role key, owner UUID, and Aadhaar secrets are server-only. Authentication protects application access but does not replace the future RLS, storage, Aadhaar cryptography, or rate-limiting phases.
