import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  documentId: text("document_id").notNull(),
  address: text("address").notNull().default(""),
  country: text("country").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  plan: integer("plan").notNull(),
  installmentAmount: integer("installment_amount").notNull(),
  currency: text("currency").notNull(),
  network: text("network").notNull().default(""),
  wallet: text("wallet").notNull().default(""),
  accessStatus: text("access_status").notNull().default("active"),
  contractStatus: text("contract_status").notNull().default("pending"),
  signedPdfUrl: text("signed_pdf_url").notNull().default(""),
  pandadocDocumentId: text("pandadoc_document_id").notNull().default(""),
  pandadocStatus: text("pandadoc_status").notNull().default(""),
  pandadocSentAt: text("pandadoc_sent_at").notNull().default(""),
  pandadocUpdatedAt: text("pandadoc_updated_at").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  installmentNo: integer("installment_no").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
  status: text("status").notNull().default("pending"),
});
