import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { supabase } from './supabase.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const isVercel = Boolean(process.env.VERCEL);

/* =========================================================
   TEMPORARY FILE LOCATIONS
   ========================================================= */

const dataDir = isVercel
  ? path.join(os.tmpdir(), 'swami-data')
  : path.join(root, 'data');

const uploadDir = isVercel
  ? path.join(os.tmpdir(), 'swami-uploads')
  : path.join(root, 'uploads');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());

if (!isVercel) {
  app.use('/uploads', express.static(uploadDir));
}

/* =========================================================
   AADHAAR UPLOAD CONFIGURATION
   ========================================================= */

const aadharTypes = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const aadharFilter = (_, file, cb) => {
  const valid = aadharTypes.has(file.mimetype);

  cb(
    valid
      ? null
      : new Error(
          'Aadhar document must be a PDF, JPG, PNG, or WebP file'
        ),
    valid
  );
};

const storage = multer.diskStorage({
  destination: uploadDir,

  filename: (_, file, cb) => {
    const ext = aadharTypes.get(file.mimetype);

    cb(
      null,
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}${ext}`
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: aadharFilter
});

const extractUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: aadharFilter
});

const runFile = promisify(execFile);

const bundledPython =
  'C:\\Users\\jayha\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';

/* =========================================================
   VALIDATION
   ========================================================= */

const validate = student => {
  const errors = {};

  if (!student.full_name?.trim()) {
    errors.full_name = 'Full name is required';
  }

  if (!student.class_year?.trim()) {
    errors.class_year = 'Class / year is required';
  }

  if (!/^\d{10}$/.test(student.mobile || '')) {
    errors.mobile =
      'Enter a valid 10-digit mobile number';
  }

  if (!student.address?.trim()) {
    errors.address = 'Address is required';
  }

  if (!/^\d{12}$/.test(student.aadhar_number || '')) {
    errors.aadhar_number =
      'Enter a valid 12-digit Aadhar number';
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      student.admission_date || ''
    ) ||
    student.admission_date < '2026-07-01'
  ) {
    errors.admission_date =
      'Admission date must be on or after 1 July 2026';
  }

  if (!(Number(student.total_fees) >= 0)) {
    errors.total_fees =
      'Enter a valid fee amount';
  }

  if (
    !(Number(student.security_deposit || 0) >= 0)
  ) {
    errors.security_deposit =
      'Enter a valid security deposit amount';
  }

  if (
    !['Pending', 'Held', 'Refunded'].includes(
      student.deposit_status || 'Pending'
    )
  ) {
    errors.deposit_status =
      'Choose a valid deposit status';
  }

  return errors;
};

/* =========================================================
   PAYMENT HELPERS
   ========================================================= */

const feeMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function isOpenFeeMonth(value) {
  const match = String(value).match(
    /^([A-Za-z]+)\s+(\d{4})$/
  );

  if (!match) return false;

  const month = feeMonths.findIndex(
    m =>
      m.toLowerCase() ===
      match[1].toLowerCase()
  );

  const year = Number(match[2]);

  return (
    month >= 0 &&
    (
      year > 2026 ||
      (year === 2026 && month >= 6)
    )
  );
}

function feeMonthKey(value) {
  const match = String(value).match(
    /^([A-Za-z]+)\s+(\d{4})$/
  );

  if (!match) return '';

  const index = feeMonths.findIndex(
    m =>
      m.toLowerCase() ===
      match[1].toLowerCase()
  );

  if (index < 0) return '';

  return `${match[2]}-${String(index + 1).padStart(
    2,
    '0'
  )}`;
}

/* =========================================================
   DASHBOARD
   ========================================================= */

app.get(
  '/api/dashboard',

  async (_, res, next) => {
    try {
      const {
        data: studentsData,
        error: studentsError
      } = await supabase
        .from('students')
        .select('*')
        .order('full_name', {
          ascending: true
        });

      if (studentsError) {
        throw studentsError;
      }

      const {
        data: payments,
        error: paymentsError
      } = await supabase
        .from('payments')
        .select('student_id, amount');

      if (paymentsError) {
        throw paymentsError;
      }

      const paymentTotals = {};

      for (const payment of payments || []) {
        const id = String(payment.student_id);

        paymentTotals[id] =
          (paymentTotals[id] || 0) +
          Number(payment.amount || 0);
      }

      const students = (studentsData || []).map(
        student => {
          const totalPaid =
            paymentTotals[String(student.id)] || 0;

          const totalFees =
            Number(student.total_fees || 0);

          return {
            ...student,

            total_paid: totalPaid,

            pending_amount: Math.max(
              totalFees - totalPaid,
              0
            )
          };
        }
      );

      const totalFees = students.reduce(
        (sum, student) =>
          sum +
          Number(student.total_fees || 0),
        0
      );

      const totalPaid = (payments || []).reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0
      );

      res.json({
        students,

        stats: {
          students: students.length,
          total_fees: totalFees,
          total_paid: totalPaid,
          pending: Math.max(
            totalFees - totalPaid,
            0
          )
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   AADHAAR EXTRACTION
   ========================================================= */

app.post(
  '/api/aadhar/extract',

  extractUpload.single('aadhar_pdf'),

  async (req, res) => {
    /*
      Your existing extraction requires local Python
      and PowerShell.

      That works on your Windows computer but not
      reliably inside a Vercel function.
    */

    if (isVercel) {
      return res.status(501).json({
        error:
          'Automatic Aadhar extraction is temporarily unavailable on the deployed website. Please enter the details manually.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error:
          'Choose an Aadhar document first'
      });
    }

    const id = crypto.randomUUID();

    const tempPath = path.join(
      dataDir,
      `extract-${id}${aadharTypes.get(
        req.file.mimetype
      )}`
    );

    const normalizedPath = path.join(
      dataDir,
      `extract-${id}-ocr.png`
    );

    const textPath = path.join(
      dataDir,
      `extract-${id}.txt`
    );

    try {
      fs.writeFileSync(
        tempPath,
        req.file.buffer
      );

      const python =
        process.env.PYTHON_PATH ||
        (
          fs.existsSync(bundledPython)
            ? bundledPython
            : 'python'
        );

      let parsePath = tempPath;

      if (
        req.file.mimetype !==
        'application/pdf'
      ) {
        await runFile(
          python,

          [
            path.join(
              root,
              'server',
              'prepare_aadhar_image.py'
            ),

            tempPath,
            normalizedPath
          ],

          {
            timeout: 20000,
            maxBuffer: 1024 * 1024
          }
        );

        const {
          stdout: ocrText
        } = await runFile(
          'powershell.exe',

          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',

            path.join(
              root,
              'server',
              'ocr_image.ps1'
            ),

            '-ImagePath',
            normalizedPath
          ],

          {
            timeout: 30000,
            maxBuffer: 2 * 1024 * 1024
          }
        );

        fs.writeFileSync(
          textPath,
          ocrText,
          'utf8'
        );

        parsePath = textPath;
      }

      const { stdout } =
        await runFile(
          python,

          [
            path.join(
              root,
              'server',
              'extract_aadhar.py'
            ),

            parsePath
          ],

          {
            timeout: 20000,
            maxBuffer: 1024 * 1024
          }
        );

      res.json(
        JSON.parse(stdout)
      );
    } catch (error) {
      let message =
        'Could not read this document. Try a clearer, upright image or enter the details manually.';

      try {
        const parsed =
          JSON.parse(
            error.stdout || '{}'
          );

        if (parsed.error) {
          message = parsed.error;
        }
      } catch {}

      res.status(422).json({
        error: message
      });
    } finally {
      [
        tempPath,
        normalizedPath,
        textPath
      ].forEach(file => {
        fs.rmSync(file, {
          force: true
        });
      });
    }
  }
);

/* =========================================================
   GET ONE STUDENT
   ========================================================= */

app.get(
  '/api/students/:id',

  async (req, res, next) => {
    try {
      const {
        data: student,
        error: studentError
      } = await supabase
        .from('students')
        .select('*')
        .eq(
          'id',
          req.params.id
        )
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      if (!student) {
        return res.status(404).json({
          error:
            'Student not found'
        });
      }

      const {
        data: payments,
        error: paymentsError
      } = await supabase
        .from('payments')
        .select('*')
        .eq(
          'student_id',
          req.params.id
        )
        .order(
          'payment_date',
          {
            ascending: false
          }
        )
        .order(
          'id',
          {
            ascending: false
          }
        );

      if (paymentsError) {
        throw paymentsError;
      }

      const totalPaid =
        (payments || []).reduce(
          (sum, payment) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        );

      res.json({
        ...student,

        total_paid:
          totalPaid,

        pending_amount:
          Math.max(
            Number(
              student.total_fees || 0
            ) -
              totalPaid,
            0
          ),

        payments:
          payments || []
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADD STUDENT
   ========================================================= */

app.post(
  '/api/students',

  upload.single('aadhar_pdf'),

  async (req, res, next) => {
    try {
      const errors =
        validate(req.body);

      if (
        Object.keys(errors).length
      ) {
        if (req.file) {
          fs.rmSync(
            req.file.path,
            {
              force: true
            }
          );
        }

        return res
          .status(400)
          .json({
            errors
          });
      }

      /*
        Uploaded files are currently local only.
        Do not store new Aadhaar files on Vercel
        until Supabase Storage is configured.
      */

      if (
        isVercel &&
        req.file
      ) {
        fs.rmSync(
          req.file.path,
          {
            force: true
          }
        );

        return res
          .status(501)
          .json({
            error:
              'Aadhar document storage is not configured yet. Please add the student without uploading the Aadhar document for now.'
          });
      }

      const newStudent = {
        full_name:
          req.body.full_name.trim(),

        class_year:
          req.body.class_year.trim(),

        mobile:
          req.body.mobile,

        address:
          req.body.address.trim(),

        aadhar_number:
          req.body.aadhar_number,

        admission_date:
          req.body.admission_date,

        aadhar_file:
          req.file?.filename ||
          null,

        total_fees:
          Number(
            req.body.total_fees
          ),

        security_deposit:
          Number(
            req.body
              .security_deposit ||
              0
          ),

        deposit_status:
          req.body
            .deposit_status ||
          'Pending',

        deposit_received_date:
          req.body
            .deposit_received_date ||
          null,

        deposit_refunded_date:
          req.body
            .deposit_refunded_date ||
          null
      };

      const {
        data,
        error
      } = await supabase
        .from('students')
        .insert(newStudent)
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      res
        .status(201)
        .json({
          id: data.id
        });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   UPDATE STUDENT
   ========================================================= */

app.put(
  '/api/students/:id',

  upload.single('aadhar_pdf'),

  async (req, res, next) => {
    try {
      const {
        data: oldStudent,
        error: findError
      } = await supabase
        .from('students')
        .select('*')
        .eq(
          'id',
          req.params.id
        )
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (!oldStudent) {
        if (req.file) {
          fs.rmSync(
            req.file.path,
            {
              force: true
            }
          );
        }

        return res
          .status(404)
          .json({
            error:
              'Student not found'
          });
      }

      const errors =
        validate(req.body);

      if (
        Object.keys(errors).length
      ) {
        if (req.file) {
          fs.rmSync(
            req.file.path,
            {
              force: true
            }
          );
        }

        return res
          .status(400)
          .json({
            errors
          });
      }

      if (
        isVercel &&
        req.file
      ) {
        fs.rmSync(
          req.file.path,
          {
            force: true
          }
        );

        return res
          .status(501)
          .json({
            error:
              'Aadhar document storage is not configured yet. Please edit the student without uploading a new Aadhar document.'
          });
      }

      const updatedStudent = {
        full_name:
          req.body.full_name.trim(),

        class_year:
          req.body.class_year.trim(),

        mobile:
          req.body.mobile,

        address:
          req.body.address.trim(),

        aadhar_number:
          req.body.aadhar_number,

        admission_date:
          req.body.admission_date,

        aadhar_file:
          req.file?.filename ||
          oldStudent.aadhar_file,

        total_fees:
          Number(
            req.body.total_fees
          ),

        security_deposit:
          Number(
            req.body
              .security_deposit ||
              0
          ),

        deposit_status:
          req.body
            .deposit_status ||
          'Pending',

        deposit_received_date:
          req.body
            .deposit_received_date ||
          null,

        deposit_refunded_date:
          req.body
            .deposit_refunded_date ||
          null,

        updated_at:
          new Date().toISOString()
      };

      const { error } =
        await supabase
          .from('students')
          .update(
            updatedStudent
          )
          .eq(
            'id',
            req.params.id
          );

      if (error) {
        throw error;
      }

      res.json({
        ok: true
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   DELETE + ARCHIVE STUDENT
   ========================================================= */

app.delete(
  '/api/students/:id',

  async (req, res, next) => {
    try {
      /*
        1. Find student
      */

      const {
        data: student,
        error: studentError
      } = await supabase
        .from('students')
        .select('*')
        .eq(
          'id',
          req.params.id
        )
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      if (!student) {
        return res
          .status(404)
          .json({
            error:
              'Student not found'
          });
      }

      /*
        2. Get payments
      */

      const {
        data: payments,
        error: paymentsError
      } = await supabase
        .from('payments')
        .select('*')
        .eq(
          'student_id',
          req.params.id
        );

      if (paymentsError) {
        throw paymentsError;
      }

      /*
        3. Calculate total paid
      */

      const totalPaid =
        (payments || []).reduce(
          (sum, payment) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        );

      const pendingAmount =
        Math.max(
          Number(
            student.total_fees ||
              0
          ) -
            totalPaid,
          0
        );

      /*
        4. Archive student
      */

      const archivedStudent = {
        original_student_id:
          student.id,

        full_name:
          student.full_name,

        class_year:
          student.class_year,

        mobile:
          student.mobile,

        address:
          student.address,

        aadhar_number:
          student.aadhar_number,

        admission_date:
          student.admission_date,

        total_fees:
          Number(
            student.total_fees ||
              0
          ),

        security_deposit:
          Number(
            student
              .security_deposit ||
              0
          ),

        deposit_status:
          student.deposit_status,

        deposit_received_date:
          student
            .deposit_received_date,

        deposit_refunded_date:
          student
            .deposit_refunded_date,

        total_paid:
          totalPaid,

        pending_amount:
          pendingAmount
      };

      const {
        error:
          archiveStudentError
      } = await supabase
        .from(
          'archived_students'
        )
        .insert(
          archivedStudent
        );

      if (
        archiveStudentError
      ) {
        throw archiveStudentError;
      }

      /*
        5. Archive payments
      */

      if (
        payments &&
        payments.length > 0
      ) {
        const archivedPayments =
          payments.map(
            payment => ({
              original_payment_id:
                payment.id,

              original_student_id:
                student.id,

              student_name:
                student.full_name,

              month:
                payment.month,

              amount:
                payment.amount,

              payment_date:
                payment.payment_date,

              mode:
                payment.mode
            })
          );

        const {
          error:
            archivePaymentsError
        } = await supabase
          .from(
            'archived_payments'
          )
          .insert(
            archivedPayments
          );

        if (
          archivePaymentsError
        ) {
          throw archivePaymentsError;
        }
      }

      /*
        6. Delete active payments
      */

      const {
        error:
          deletePaymentsError
      } = await supabase
        .from('payments')
        .delete()
        .eq(
          'student_id',
          req.params.id
        );

      if (
        deletePaymentsError
      ) {
        throw deletePaymentsError;
      }

      /*
        7. Delete active student
      */

      const {
        error:
          deleteStudentError
      } = await supabase
        .from('students')
        .delete()
        .eq(
          'id',
          req.params.id
        );

      if (
        deleteStudentError
      ) {
        throw deleteStudentError;
      }

      /*
        Delete local file only
        when running locally.
      */

      if (
        !isVercel &&
        student.aadhar_file
      ) {
        fs.rm(
          path.join(
            uploadDir,
            student.aadhar_file
          ),
          {
            force: true
          },
          () => {}
        );
      }

      res.json({
        ok: true,
        archived: true
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADD PAYMENT
   ========================================================= */

app.post(
  '/api/students/:id/payments',

  async (req, res, next) => {
    try {
      const {
        data: student,
        error: studentError
      } = await supabase
        .from('students')
        .select(
          'id, admission_date'
        )
        .eq(
          'id',
          req.params.id
        )
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      if (!student) {
        return res
          .status(404)
          .json({
            error:
              'Student not found'
          });
      }

      const {
        month,
        amount,
        payment_date,
        mode
      } = req.body;

      if (
        !month ||
        !payment_date ||
        !(Number(amount) > 0)
      ) {
        return res
          .status(400)
          .json({
            error:
              'Month, date, and a positive amount are required'
          });
      }

      const admissionMonth =
        student.admission_date.slice(
          0,
          7
        );

      if (
        !isOpenFeeMonth(month) ||
        feeMonthKey(month) <
          admissionMonth ||
        payment_date <
          student.admission_date
      ) {
        return res
          .status(400)
          .json({
            error:
              `Payments can only be recorded from the admission date (${student.admission_date}) onward`
          });
      }

      const {
        data,
        error
      } = await supabase
        .from('payments')
        .insert({
          student_id:
            Number(
              req.params.id
            ),

          month,

          amount:
            Number(amount),

          payment_date,

          mode:
            mode || null
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      res
        .status(201)
        .json({
          id: data.id
        });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   DELETE PAYMENT
   ========================================================= */

app.delete(
  '/api/payments/:id',

  async (req, res, next) => {
    try {
      const {
        data,
        error
      } = await supabase
        .from('payments')
        .delete()
        .eq(
          'id',
          req.params.id
        )
        .select('id');

      if (error) {
        throw error;
      }

      if (
        !data ||
        data.length === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              'Payment not found'
          });
      }

      res.json({
        ok: true
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   EXCEL EXPORT
   ========================================================= */

/*
  excel.js still reads the old SQLite database.

  For localhost we keep the old export temporarily.
  For Vercel we disable it until excel.js is migrated
  to Supabase.
*/

app.get(
  '/api/export',

  async (_, res, next) => {
    try {
      if (isVercel) {
        return res
          .status(501)
          .json({
            error:
              'Excel export is temporarily unavailable while it is being migrated to Supabase.'
          });
      }

      const {
        excelPath,
        generateExcel
      } = await import(
        './excel.js'
      );

      await generateExcel();

      res.download(
        excelPath,
        'hostel-master.xlsx'
      );
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(error);

    /*
      PostgreSQL duplicate/unique constraint.
      For example duplicate Aadhar number.
    */

    if (
      error.code === '23505'
    ) {
      return res
        .status(409)
        .json({
          error:
            'This Aadhar number is already registered'
        });
    }

    /*
      Multer upload size errors
    */

    if (
      error.code ===
      'LIMIT_FILE_SIZE'
    ) {
      return res
        .status(400)
        .json({
          error:
            'File must be 5 MB or smaller'
        });
    }

    res
      .status(
        error.status || 400
      )
      .json({
        error:
          error.message ||
          'Something went wrong'
      });
  }
);

/* =========================================================
   SERVE VITE BUILD LOCALLY
   ========================================================= */

if (
  !isVercel &&
  fs.existsSync(
    path.join(
      root,
      'dist'
    )
  )
) {
  app.use(
    express.static(
      path.join(
        root,
        'dist'
      )
    )
  );

  app.get(
    '/{*splat}',

    (req, res) =>
      res.sendFile(
        path.join(
          root,
          'dist',
          'index.html'
        )
      )
  );
}

/* =========================================================
   LOCAL SERVER
   ========================================================= */

const port =
  process.env.PORT ||
  4000;

if (
  process.env.NODE_ENV !==
    'test' &&
  !isVercel
) {
  app.listen(
    port,

    () => {
      console.log(
        `SWAMI running at http://localhost:${port}`
      );
    }
  );
}

export default app;