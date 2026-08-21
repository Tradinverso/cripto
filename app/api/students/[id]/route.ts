import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase } from "../../../../db/init";
import { students } from "../../../../db/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabase();
    const { id } = await context.params;
    const studentId = Number(id);
    const body = (await request.json()) as { signedPdfUrl?: string; contractStatus?: string; accessStatus?: string; notes?: string };
    const values: Record<string, string> = {};
    if (typeof body.signedPdfUrl === "string") values.signedPdfUrl = body.signedPdfUrl.trim();
    if (body.contractStatus === "signed" || body.contractStatus === "pending") values.contractStatus = body.contractStatus;
    if (body.accessStatus === "active" || body.accessStatus === "paused") values.accessStatus = body.accessStatus;
    if (typeof body.notes === "string") values.notes = body.notes.trim();
    if (!studentId || Object.keys(values).length === 0) return Response.json({ error: "No hay cambios válidos." }, { status: 400 });
    const db = getDb();
    const [student] = await db.update(students).set(values).where(eq(students.id, studentId)).returning();
    return Response.json({ student });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el alumno." }, { status: 500 });
  }
}
