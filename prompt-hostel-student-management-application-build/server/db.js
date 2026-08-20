import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = path.join(root, 'data');
export const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive:true }); fs.mkdirSync(uploadDir, { recursive:true });
export const db = new Database(process.env.DB_PATH || path.join(dataDir, 'hostel.db'));
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS students (
 id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, class_year TEXT NOT NULL,
 mobile TEXT NOT NULL, address TEXT NOT NULL, aadhar_number TEXT NOT NULL UNIQUE, admission_date TEXT NOT NULL DEFAULT '2026-07-01',
 aadhar_file TEXT, total_fees REAL NOT NULL CHECK(total_fees >= 0), security_deposit REAL NOT NULL DEFAULT 0,
 deposit_status TEXT NOT NULL DEFAULT 'Pending', deposit_received_date TEXT, deposit_refunded_date TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, month TEXT NOT NULL,
 amount REAL NOT NULL CHECK(amount > 0), payment_date TEXT NOT NULL, mode TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS archived_students (
 id INTEGER PRIMARY KEY AUTOINCREMENT, original_student_id INTEGER NOT NULL, full_name TEXT NOT NULL,
 class_year TEXT, mobile TEXT, address TEXT, aadhar_number TEXT, admission_date TEXT, total_fees REAL,
 security_deposit REAL, deposit_status TEXT, deposit_received_date TEXT, deposit_refunded_date TEXT,
 total_paid REAL, pending_amount REAL, deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS archived_payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, original_payment_id INTEGER, original_student_id INTEGER NOT NULL,
 student_name TEXT NOT NULL, month TEXT, amount REAL, payment_date TEXT, mode TEXT,
 archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

function ensureColumn(table, column, definition) {
 const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column);
 if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('students','security_deposit','REAL NOT NULL DEFAULT 0');
ensureColumn('students','admission_date',"TEXT NOT NULL DEFAULT '2026-07-01'");
ensureColumn('students','deposit_status',"TEXT NOT NULL DEFAULT 'Pending'");
ensureColumn('students','deposit_received_date','TEXT');
ensureColumn('students','deposit_refunded_date','TEXT');
ensureColumn('archived_students','security_deposit','REAL');
ensureColumn('archived_students','admission_date','TEXT');
ensureColumn('archived_students','deposit_status','TEXT');
ensureColumn('archived_students','deposit_received_date','TEXT');
ensureColumn('archived_students','deposit_refunded_date','TEXT');

export function studentRows(){
 return db.prepare(`SELECT s.*, COALESCE(SUM(p.amount),0) total_paid,
 MAX(s.total_fees-COALESCE((SELECT SUM(amount) FROM payments WHERE student_id=s.id),0),0) pending_amount
 FROM students s LEFT JOIN payments p ON p.student_id=s.id GROUP BY s.id ORDER BY s.full_name COLLATE NOCASE`).all();
}
