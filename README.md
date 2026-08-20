# SWAMI Hostel Ledger

A full-stack hostel student management website for maintaining resident records, tracking fee payments, storing Aadhar documents, and exporting current data to Excel.

## Features

- Add, view, edit, search, and remove active students
- Store class/year, mobile number, address, Aadhar number, and total fees
- Store each student's admission date and begin fee history from that date
- Validate Indian 10-digit mobile and 12-digit Aadhar numbers
- Upload and view Aadhar documents as PDF, JPG, PNG, or WebP files (maximum 5 MB)
- Read Aadhar PDFs and images locally and prefill name, Aadhar number, and address
- Record month, amount, payment date, and payment mode
- Calculate collected and pending fees automatically
- Track security-deposit amount, collection status, received date, and refund date
- Display month-wise payment status and full payment history
- Prepare editable WhatsApp reminders for students with pending fees
- Archive student and payment history before deleting active records
- Generate a formatted Excel workbook on every data change

The workbook contains **Students**, **Payments**, **Pending Summary**, and **Security Deposits** worksheets.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Lucide React |
| Backend | Node.js, Express 5 |
| Database | SQLite with Better SQLite3 |
| Excel export | ExcelJS |
| PDF uploads | Multer |

## Project structure

```text
├── server/
│   ├── db.js          # Database schema and queries
│   ├── excel.js       # Excel workbook generation
│   └── index.js       # Express API and uploads
├── src/
│   ├── App.jsx        # Dashboard, forms, and profiles
│   ├── main.jsx       # React entry point
│   └── styles.css     # Responsive styling
├── data/              # Generated database and workbook
├── uploads/           # Aadhar PDF and image files
├── package.json
└── vite.config.js
```

## Requirements

- Node.js 20 or later
- pnpm
- Python with `pypdf` and Pillow, plus Windows OCR for automatic Aadhar extraction

## Installation and development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The Express API runs on port `4000` and Vite forwards API and upload requests to it.

### One-click Windows launcher

After installing and building the project once, double-click **Open SWAMI Website.cmd** in the project folder. It starts the server and opens the website automatically.

## Production

```bash
pnpm build
pnpm start
```

Open [http://localhost:4000](http://localhost:4000). Express serves both the API and the built React website.

To build and serve everything on `http://localhost:5173` with one command:

```bash
pnpm serve
```

To change the server port in PowerShell:

```powershell
$env:PORT=8080
pnpm start
```

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard` | List students and dashboard totals |
| `GET` | `/api/students/:id` | Get a profile and its payments |
| `POST` | `/api/students` | Add a student using multipart form data |
| `PUT` | `/api/students/:id` | Update a student |
| `DELETE` | `/api/students/:id` | Archive and remove a student |
| `POST` | `/api/students/:id/payments` | Record a payment |
| `DELETE` | `/api/payments/:id` | Remove a payment entry |
| `GET` | `/api/export` | Generate and download the workbook |

## Data storage

| Location | Contents |
| --- | --- |
| `data/hostel.db` | SQLite database |
| `data/hostel-master.xlsx` | Latest Excel workbook |
| `uploads/` | Uploaded Aadhar PDFs and images |

Automatic Aadhar extraction supports readable PDFs and clear JPG, JPEG, PNG, and WebP images. Password-protected PDFs, blurred photos, glare, cropping, or unusual document layouts may require manual correction. Always verify the extracted details before saving.

When a student is removed, their details and payment records are copied into the `archived_students` and `archived_payments` database tables before the active records are deleted.

## Security and privacy

This application stores sensitive identity information. Run it only on a trusted computer or private network, restrict filesystem access, maintain encrypted backups, and follow applicable Indian privacy and retention requirements.

Authentication is intentionally not included. Add access control before making the application available on the public internet.

## License

No license is currently specified. Add a `LICENSE` file before distributing the project.
