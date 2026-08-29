import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { students } from "../db/schema";
import { isPandaDocCompleted, pandaDocAdminUrl } from "./pandadoc";

export function pandaDocStatusValues(documentId: string, status: string, sent = false) {
  const now = new Date().toISOString();
  const values: Record<string, string> = {
    pandadocDocumentId: documentId,
    pandadocStatus: status,
    pandadocUpdatedAt: now,
  };
  if (sent) values.pandadocSentAt = now;
  if (isPandaDocCompleted(status)) {
    values.contractStatus = "signed";
    values.signedPdfUrl = pandaDocAdminUrl(documentId);
  }
  return values;
}

export async function savePandaDocStatus(studentId: number, documentId: string, status: string, sent = false) {
  const values = pandaDocStatusValues(documentId, status, sent);
  await getDb().update(students).set(values).where(eq(students.id, studentId));
  return values;
}
