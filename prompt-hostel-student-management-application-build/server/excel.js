import ExcelJS from 'exceljs';
import path from 'node:path';
import { db, dataDir, studentRows } from './db.js';

export const excelPath = path.join(dataDir, 'hostel-master.xlsx');
const moneyFmt = '₹#,##0.00';
function style(ws, widths) {
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: ws.getRow(1).getCell(ws.columnCount).address };
  ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F35' } }; });
  ws.getRow(1).height = 25; widths.forEach((w, i) => ws.getColumn(i + 1).width = w);
  ws.eachRow((r, n) => { if (n > 1 && n % 2 === 1) r.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F2' } }); });
}
export async function generateExcel(target = excelPath) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'SWAMI Hostel Ledger'; wb.created = new Date();
  const students = studentRows();
  const payments = db.prepare(`SELECT p.*,s.full_name FROM payments p JOIN students s ON s.id=p.student_id ORDER BY p.payment_date DESC`).all();
  const s = wb.addWorksheet('Students'); s.addRow(['Student ID','Full Name','Class / Year','Mobile','Address','Aadhar Number','Aadhar Document','Admission Date','Total Fees','Total Paid','Pending','Security Deposit','Deposit Status']);
  students.forEach(x => s.addRow([x.id,x.full_name,x.class_year,x.mobile,x.address,x.aadhar_number,x.aadhar_file||'',x.admission_date,x.total_fees,x.total_paid,x.pending_amount,x.security_deposit,x.deposit_status])); style(s,[12,25,18,15,38,18,28,18,16,16,16,18,16]); [9,10,11,12].forEach(i => s.getColumn(i).numFmt = moneyFmt);
  const p = wb.addWorksheet('Payments'); p.addRow(['Payment ID','Student ID','Student Name','Month','Amount Paid','Payment Date','Mode']);
  payments.forEach(x => p.addRow([x.id,x.student_id,x.full_name,x.month,x.amount,x.payment_date,x.mode||'—'])); style(p,[13,12,25,18,16,18,18]); p.getColumn(5).numFmt = moneyFmt;
  const q = wb.addWorksheet('Pending Summary'); q.addRow(['Student ID','Student Name','Class / Year','Admission Date','Total Fees','Amount Paid','Pending Amount','Status']);
  students.forEach(x => q.addRow([x.id,x.full_name,x.class_year,x.admission_date,x.total_fees,x.total_paid,x.pending_amount,x.pending_amount<=0?'Paid':'Pending'])); style(q,[12,26,18,18,17,17,18,14]); [5,6,7].forEach(i => q.getColumn(i).numFmt = moneyFmt);
  const d = wb.addWorksheet('Security Deposits'); d.addRow(['Student ID','Student Name','Admission Date','Deposit Amount','Status','Received Date','Refunded Date']);
  students.forEach(x => d.addRow([x.id,x.full_name,x.admission_date,x.security_deposit,x.deposit_status,x.deposit_received_date||'',x.deposit_refunded_date||''])); style(d,[12,26,18,18,16,18,18]); d.getColumn(4).numFmt=moneyFmt;
  await wb.xlsx.writeFile(target); return target;
}
let queue = Promise.resolve();
export function syncExcel() { queue = queue.then(() => generateExcel()).catch(console.error); return queue; }
