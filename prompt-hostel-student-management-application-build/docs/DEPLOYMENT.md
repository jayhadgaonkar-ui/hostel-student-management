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

## Phase 3A: database denial and single-owner authentication

> **STOP:** Do not configure or deploy `VITE_SUPABASE_URL` and
> `VITE_SUPABASE_ANON_KEY` until the RLS/privilege migration has been
> successfully applied and verified.

The browser uses Supabase only to authenticate. All application-data access
must pass through the Express API, which uses the server-only service-role key.
Repository inspection found four Supabase application tables: `students`,
`payments`, `archived_students`, and `archived_payments`. No Supabase views,
RPC functions, or explicitly named sequences are used by the application. The
migration also revokes access to sequences owned by those tables, views that
directly depend on them, and any user-defined function in the `public` schema
if such objects exist in the deployed schema.

### Mandatory deployment order

1. Merge the reviewed code.
2. Apply `supabase/migrations/20260903000100_deny_direct_application_data_access.sql` in the Supabase SQL Editor. Run it as a project administrator; do not edit it to add credentials.
3. Run `supabase/verification/phase_3a_verify_data_api_denied.sql` in the SQL Editor. It reads PostgreSQL metadata only, not student records.
4. Confirm every required table is present, both RLS columns are `true`, `anon_and_authenticated_privileges_absent` is `true`, and the policy query returns zero rows. Optionally test Data API table requests with anon and ordinary authenticated credentials and confirm they cannot read or write rows; never include record contents in test output.
5. Disable public Supabase sign-up.
6. Create the single owner.
7. Configure the Vercel environment variables described below.
8. Redeploy and test missing, expired, non-owner, and owner authentication flows.

The migration is transactional and repeatable. It validates the required
tables, enables and forces RLS, and revokes browser-role privileges without
creating policies or changing application rows. Supabase's `service_role` has
the PostgreSQL `BYPASSRLS` attribute and remains the backend access path. Do
not run either SQL file from this repository against a project until it has
been reviewed for that project.

### Single-owner setup

The dashboard and every data API require a verified Supabase email/password session whose user UUID exactly matches `OWNER_USER_ID`. There is no registration UI. Keep public sign-up disabled in Supabase.

### Create the owner

1. In the Supabase project, open **Authentication → Users**.
2. Select **Add user → Create new user**, enter the owner's email and a strong password, and mark the email confirmed if appropriate. Do not put the password in this repository or Vercel.
3. Copy the new user's UUID from the Users table (not the email) into the server variable `OWNER_USER_ID`.
4. Open **Authentication → Providers → Email** and disable **Allow new users to sign up**. Keep email/password sign-in enabled.

### Local variables

Copy `.env.example` to `.env` and fill it locally only after database denial is
verified. The browser variables are `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Server configuration is `SUPABASE_URL`; server-only
secrets currently required are `SUPABASE_SERVICE_ROLE_KEY` and
`OWNER_USER_ID`. `AADHAAR_HMAC_SECRET` and `AADHAAR_ENCRYPTION_KEY` are reserved
for the later Aadhaar-protection phase and are **not required yet**. Never
prefix a server secret with `VITE_` and never commit `.env`.

### Vercel variables

In **Project Settings → Environment Variables**, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` for the Vite build. Add `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `OWNER_USER_ID` for server functions. Select
the intended Preview/Production environments, save, and redeploy. Values must
come from the matching Supabase project; do not expose or log them.

The anon key and URL are public browser configuration. The service-role key,
owner UUID, and future Aadhaar secrets are server-only. Phase 3A RLS and
privilege denial is mandatory defense in depth; later storage, Aadhaar
cryptography, and rate-limiting phases remain separate work.
