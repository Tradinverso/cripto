import { env } from "cloudflare:workers";

let initialized = false;

export async function ensureDatabase() {
  if (initialized) return;
  const d1 = env.DB;
  if (!d1) throw new Error("La base de datos local no está disponible.");

  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      document_id TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      plan INTEGER NOT NULL,
      installment_amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT '',
      wallet TEXT NOT NULL DEFAULT '',
      access_status TEXT NOT NULL DEFAULT 'active',
      contract_status TEXT NOT NULL DEFAULT 'pending',
      signed_pdf_url TEXT NOT NULL DEFAULT '',
      pandadoc_document_id TEXT NOT NULL DEFAULT '',
      pandadoc_status TEXT NOT NULL DEFAULT '',
      pandadoc_sent_at TEXT NOT NULL DEFAULT '',
      pandadoc_updated_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      installment_no INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_students_access_status ON students(access_status)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_payments_student_due ON payments(student_id, due_date)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_payments_open_status ON payments(status) WHERE status != 'paid'"),
  ]);
  await d1.prepare("PRAGMA optimize").run();
  initialized = true;
}
