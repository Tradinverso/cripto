import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { students } from "../db/schema";
import { archiveSignedPdf } from "./drive-archive";
import { downloadCompletedPandaDoc, isPandaDocCompleted, pandaDocAdminUrl } from "./pandadoc";

type ArchiveOptions = {
  apiKey?: string;
  webhookUrl?: string;
  secret?: string;
  studentName?: string;
};

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

export async function savePandaDocStatus(
  studentId: number,
  documentId: string,
  status: string,
  sent = false,
  archive: ArchiveOptions = {},
) {
  const values = pandaDocStatusValues(documentId, status, sent);
  await getDb().update(students).set(values).where(eq(students.id, studentId));
  if (
    isPandaDocCompleted(status)
    && archive.apiKey
    && archive.webhookUrl
    && archive.secret
    && archive.studentName
  ) {
    try {
      const pdf = await downloadCompletedPandaDoc(archive.apiKey, documentId);
      const stored = await archiveSignedPdf(
        archive.webhookUrl,
        archive.secret,
        pdf,
        archive.studentName,
        documentId,
      );
      values.signedPdfUrl = stored.url;
      await getDb().update(students).set({ signedPdfUrl: stored.url }).where(eq(students.id, studentId));
    } catch (error) {
      console.error("No se pudo archivar el contrato firmado en Drive.", error);
    }
  }
  return values;
}
