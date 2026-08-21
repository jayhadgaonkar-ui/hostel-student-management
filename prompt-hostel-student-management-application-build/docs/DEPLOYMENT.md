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
