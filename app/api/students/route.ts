import { asc, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { ensureDatabase } from "../../../db/init";
import { payments, students } from "../../../db/schema";
import { getPandaDocStatus, isPandaDocCompleted, pandaDocAdminUrl } from "../../../lib/pandadoc";
import { savePandaDocStatus } from "../../../lib/pandadoc-sync";

type NewStudent = {
  fullName?: string;
  documentId?: string;
  address?: string;
  country?: string;
  email?: string;
  phone?: string;
  plan?: number;
  installmentAmount?: number;
  currency?: string;
  network?: string;
  wallet?: string;
  contractRequired?: boolean;
  notes?: string;
  dueDates?: string[];
};

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const db = getDb();
    const url = new URL(request.url);
    const requestedId = Number(url.searchParams.get("id") || 0);
    let studentRows = requestedId
      ? await db.select().from(students).where(eq(students.id, requestedId)).limit(1)
      : await db.select().from(students).orderBy(desc(students.createdAt), desc(students.id));
    if (url.searchParams.get("syncPandaDoc") === "1") {
      const apiKey = (env as unknown as Record<string, string | undefined>).PANDADOC_API_KEY || "";
      const pendingDocuments = studentRows
        .filter((student) => student.pandadocDocumentId && student.contractStatus !== "signed" && student.pandadocStatus !== "document.completed")
        .slice(0, 8);
      if (apiKey && pendingDocuments.length) {
        const statuses = await Promise.allSettled(pendingDocuments.map(async (student) => ({
          student,
          status: await getPandaDocStatus(apiKey, student.pandadocDocumentId),
        })));
        const refreshed = new Map<number, string>();
        for (const result of statuses) {
          if (result.status !== "fulfilled") continue;
          const { student, status } = result.value;
          await savePandaDocStatus(student.id, student.pandadocDocumentId, status);
          refreshed.set(student.id, status);
        }
        studentRows = studentRows.map((student) => {
          const status = refreshed.get(student.id);
          return status ? {
            ...student,
            pandadocStatus: status,
            pandadocUpdatedAt: new Date().toISOString(),
            contractStatus: isPandaDocCompleted(status) ? "signed" : student.contractStatus,
            signedPdfUrl: isPandaDocCompleted(status) ? pandaDocAdminUrl(student.pandadocDocumentId) : student.signedPdfUrl,
          } : student;
        });
      }
    }
    const paymentRows = await db.select().from(payments).orderBy(asc(payments.installmentNo));
    const today = new Date().toISOString().slice(0, 10);
    const result = studentRows.map((student) => {
      const studentPayments = paymentRows
        .filter((payment) => payment.studentId === student.id)
        .map((payment) => ({
          ...payment,
          status: payment.status === "pending" && payment.dueDate < today ? "overdue" : payment.status,
        }));
      const hasOverdue = studentPayments.some((payment) => payment.status === "overdue");
      return { ...student, accessStatus: hasOverdue ? "paused" : student.accessStatus, payments: studentPayments };
    });
    return Response.json({ students: result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los alumnos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const body = (await request.json()) as NewStudent;
    const fullName = body.fullName?.trim() || "";
    const documentId = body.documentId?.trim() || "";
    const email = body.email?.trim() || "";
    const phone = body.phone?.trim() || "";
    const plan = body.plan === 4 ? 4 : 3;
    const installmentAmount = Number(body.installmentAmount);
    const currency = body.currency === "EUR" ? "EUR" : body.currency === "USDC" ? "USDC" : "USDT";
    const privateEnv = env as unknown as Record<string, string | undefined>;
    const network = body.network?.trim() || (currency === "USDT" ? privateEnv.USDT_NETWORK || "TRC20 (TRON)" : "");
    const wallet = body.wallet?.trim() || (currency === "USDT" ? privateEnv.USDT_WALLET || "" : "");
    const dueDates = (body.dueDates || []).slice(0, plan);
    if (!fullName || !documentId || !phone || !Number.isInteger(installmentAmount) || installmentAmount <= 0 || dueDates.length !== plan || dueDates.some((date) => !date)) {
      return Response.json({ error: "Completa los datos obligatorios y todas las fechas de pago." }, { status: 400 });
    }

    const db = getDb();
    const [student] = await db.insert(students).values({
      fullName,
      documentId,
      address: body.address?.trim() || "",
      country: body.country?.trim() || "",
      email,
      phone,
      plan,
      installmentAmount,
      currency,
      network,
      wallet,
      contractStatus: body.contractRequired === false ? "not_required" : "pending",
      notes: body.notes?.trim() || "",
    }).returning();
    await db.insert(payments).values(dueDates.map((dueDate, index) => ({
      studentId: student.id,
      installmentNo: index + 1,
      amount: installmentAmount,
      currency,
      dueDate,
    })));
    return Response.json({ student }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el alumno." }, { status: 500 });
  }
}
