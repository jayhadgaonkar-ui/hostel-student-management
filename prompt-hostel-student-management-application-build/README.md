# SWAMI Hostel Ledger

A full-stack hostel student management website for maintaining resident records, tracking fee payments, storing Aadhar documents, managing security deposits, and exporting current data to Excel.

## Features

- Add, view, edit, search, and remove active students
- Store class/year, admission date, mobile number, address, Aadhar number, and total fees
- Begin fee history from each student's admission date
- Validate Indian 10-digit mobile and 12-digit Aadhar numbers
- Upload and view Aadhar documents as PDF, JPG, PNG, or WebP files, up to 5 MB
- Read Aadhar PDFs and images locally and prefill name, Aadhar number, and address
- Record monthly rent payments with date, amount, month, and payment mode
- Track advance rent due from the 1st day of each month
- Calculate collected and pending fees automatically
- Track security deposit amount, status, received date, and refund date
- Show month-wise paid and pending status
- Prepare editable WhatsApp reminders for students with pending rent
- Archive student and payment history before deleting active records
- Generate a formatted Excel workbook on every data change

The workbook contains Students, Payments, Pending Summary, and Security Deposits worksheets.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Lucide React |
| Backend | Node.js, Express 5 |
| Database | SQLite with Better SQLite3 |
| Excel export | ExcelJS |
| File uploads | Multer |
| OCR helpers | Python, pypdf, Pillow, Windows OCR |

## Project Structure

```text
.
|-- server/
|   |-- db.js                  # SQLite schema and queries
|   |-- excel.js               # Excel workbook generation
|   |-- extract_aadhar.py      # PDF/text Aadhar extraction
|   |-- ocr_image.ps1          # Windows OCR helper for images
|   |-- prepare_aadhar_image.py
|   |-- index.js               # Express API and uploads
|   `-- serve.js               # Local one-port production server
|-- src/
|   |-- App.jsx                # Dashboard, forms, and profiles
|   |-- main.jsx               # React entry point
|   `-- *.css                  # Application styling
|-- data/                      # Local generated database/workbook
|-- uploads/                   # Local Aadhar files
|-- docs/
|   `-- DEPLOYMENT.md          # GitHub and Vercel notes
|-- .env.example
|-- vercel.json
|-- package.json
`-- vite.config.js
```

## Requirements

- Node.js 20 or later
- pnpm
- Python with `pypdf` and Pillow
- Windows OCR for automatic Aadhar image extraction

## Installation

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The Express API runs on port `4000`, and Vite forwards API and upload requests to it.

## One-Click Windows Launcher

After installing and building once, double-click `Open SWAMI Website.cmd` in the project folder. It starts the server and opens the website automatically.

## Production

```bash
pnpm build
pnpm start
```

Open [http://localhost:4000](http://localhost:4000). Express serves both the API and the built React website.

To build and serve everything on `http://localhost:5173`:

```bash
pnpm serve
```

## GitHub And Vercel

This repository is arranged so it can be pushed to GitHub. The included `vercel.json` lets Vercel build the React frontend as a Vite project.

The full backend currently uses local SQLite, local uploads, Excel files, and Windows OCR. Those parts need hosted storage/database replacements before the hosted Vercel app can reliably save real hostel data. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before deploying.

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard` | List students and dashboard totals |
| `GET` | `/api/students/:id` | Get a profile and its payments |
| `POST` | `/api/aadhar/extract` | Extract Aadhar details from PDF/image |
| `POST` | `/api/students` | Add a student using multipart form data |
| `PUT` | `/api/students/:id` | Update a student |
| `DELETE` | `/api/students/:id` | Archive and remove a student |
| `POST` | `/api/students/:id/payments` | Record a payment |
| `DELETE` | `/api/payments/:id` | Remove a payment entry |
| `GET` | `/api/export` | Generate and download the workbook |

## Data Storage

| Location | Contents |
| --- | --- |
| `data/hostel.db` | SQLite database |
| `data/hostel-master.xlsx` | Latest Excel workbook |
| `uploads/` | Uploaded Aadhar PDFs and images |

Generated database files, Excel files, uploaded documents, dependency folders, and test scratch files are ignored by Git.

Automatic Aadhar extraction supports readable PDFs and clear JPG, JPEG, PNG, and WebP images. Password-protected PDFs, blurred photos, glare, cropping, or unusual document layouts may require manual correction. Always verify extracted details before saving.

## Security And Privacy

This application stores sensitive identity information. Run it only on a trusted computer or private network, restrict filesystem access, maintain encrypted backups, and follow applicable Indian privacy and retention requirements.

Access is restricted to the configured owner through Supabase email/password authentication. Public registration must remain disabled; see [the deployment guide](docs/DEPLOYMENT.md#phase-2-single-owner-authentication).

## License

No license is currently specified. Add a `LICENSE` file before distributing the project.
