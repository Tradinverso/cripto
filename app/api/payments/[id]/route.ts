import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase } from "../../../../db/init";
import { payments, students } from "../../../../db/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabase();
    const { id } = await context.params;
    const paymentId = Number(id);
    const body = (await request.json()) as { status?: string };
    if (!paymentId || (body.status !== "paid" && body.status !== "pending")) {
      return Response.json({ error: "Estado de pago no válido." }, { status: 400 });
    }
    const db = getDb();
    const [payment] = await db.update(payments).set({
      status: body.status,
      paidAt: body.status === "paid" ? new Date().toISOString() : null,
    }).where(eq(payments.id, paymentId)).returning();
    if (!payment) return Response.json({ error: "Pago no encontrado." }, { status: 404 });
    const today = new Date().toISOString().slice(0, 10);
    const overdue = await db.select({ id: payments.id }).from(payments).where(and(
      eq(payments.studentId, payment.studentId),
      eq(payments.status, "pending"),
      lt(payments.dueDate, today),
    )).limit(1);
    await db.update(students).set({ accessStatus: overdue.length ? "paused" : "active" }).where(eq(students.id, payment.studentId));
    return Response.json({ payment });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el pago." }, { status: 500 });
  }
}
