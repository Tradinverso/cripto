import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/init";
import { payments, students } from "../../../../../db/schema";
import { createPandaDocContract } from "../../../../../lib/pandadoc-contract";
import {
  getPandaDocStatus,
  pandaDocAdminUrl,
  sendPandaDoc,
  uploadPandaDoc,
  waitForPandaDocDraft,
} from "../../../../../lib/pandadoc";
import { savePandaDocStatus } from "../../../../../lib/pandadoc-sync";

function privateEnv() {
  return env as unknown as Record<string, string | undefined>;
}

async function studentData(id: number) {
  const db = getDb();
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!student) return null;
  const studentPayments = await db.select().from(payments).where(eq(payments.studentId, id)).orderBy(asc(payments.installmentNo));
  return { student, payments: studentPayments };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabase();
    const { id } = await context.params;
    const studentId = Number(id);
    const data = await studentData(studentId);
    if (!data) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    if (!data.student.pandadocDocumentId) return Response.json({ configured: Boolean(privateEnv().PANDADOC_API_KEY), status: "" });
    const settings = privateEnv();
    const apiKey = settings.PANDADOC_API_KEY || "";
    if (!apiKey) return Response.json({ error: "PandaDoc todavía no está conectado al servidor." }, { status: 503 });
    const status = await getPandaDocStatus(apiKey, data.student.pandadocDocumentId);
    const values = await savePandaDocStatus(studentId, data.student.pandadocDocumentId, status, false, {
      apiKey,
      webhookUrl: settings.DRIVE_ARCHIVE_WEBHOOK_URL,
      secret: settings.DRIVE_ARCHIVE_SECRET,
      studentName: data.student.fullName,
    });
    return Response.json({
      status,
      documentId: data.student.pandadocDocumentId,
      url: values.signedPdfUrl || pandaDocAdminUrl(data.student.pandadocDocumentId),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo consultar PandaDoc." }, { status: 500 });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabase();
    const { id } = await context.params;
    const studentId = Number(id);
    const data = await studentData(studentId);
    if (!data) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    const { student } = data;
    if (student.contractStatus === "not_required") return Response.json({ error: "Este alumno está marcado como sin contrato." }, { status: 400 });
    if (!student.email) return Response.json({ error: "Añade el correo del alumno antes de enviar el contrato." }, { status: 400 });
    const settings = privateEnv();
    const apiKey = settings.PANDADOC_API_KEY || "";
    if (!apiKey) return Response.json({ error: "PandaDoc todavía no está conectado al servidor." }, { status: 503 });

    let documentId = student.pandadocDocumentId;
    let status = student.pandadocStatus;
    if (documentId) {
      status = await getPandaDocStatus(apiKey, documentId);
      if (["document.sent", "document.viewed", "document.completed", "document.waiting_approval"].includes(status)) {
        const values = await savePandaDocStatus(studentId, documentId, status, false, {
          apiKey,
          webhookUrl: settings.DRIVE_ARCHIVE_WEBHOOK_URL,
          secret: settings.DRIVE_ARCHIVE_SECRET,
          studentName: student.fullName,
        });
        return Response.json({ status, documentId, url: values.signedPdfUrl || pandaDocAdminUrl(documentId), alreadySent: true });
      }
    }

    if (!documentId || status === "document.error") {
      const file = await createPandaDocContract(student, data.payments, {
        name: settings.PROVIDER_NAME || "David Rosell",
        documentId: settings.PROVIDER_DOCUMENT_ID || "74514221V",
        address: settings.PROVIDER_ADDRESS || "Nürnberg, Alemania",
        email: settings.PROVIDER_EMAIL || "hola@tradinverso.com",
        phone: settings.PROVIDER_PHONE || "+34 614 33 76 15",
      });
      const uploaded = await uploadPandaDoc(apiKey, new Uint8Array(file), student, {
        fullName: settings.PROVIDER_NAME || "David Rosell",
        email: settings.PANDADOC_SIGNER_EMAIL || "tradinverso@gmail.com",
      });
      documentId = uploaded.id;
      status = uploaded.status;
      await savePandaDocStatus(studentId, documentId, status);
    }

    if (status !== "document.draft") status = await waitForPandaDocDraft(apiKey, documentId);
    status = await sendPandaDoc(apiKey, documentId, student.fullName);
    await savePandaDocStatus(studentId, documentId, status, true);
    return Response.json({ status, documentId, url: pandaDocAdminUrl(documentId) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo enviar el contrato con PandaDoc." }, { status: 500 });
  }
}
