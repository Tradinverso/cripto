const API_ROOT = "https://api.pandadoc.com/public/v1";

type PandaDocStatus = { id?: string; status?: string; name?: string; detail?: string; type?: string };

function headers(apiKey: string, json = false) {
  return {
    Authorization: `API-Key ${apiKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function responsePayload(response: Response): Promise<PandaDocStatus> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) as PandaDocStatus : {};
  } catch {
    return { detail: text };
  }
}

function pandaDocError(action: string, response: Response, payload: PandaDocStatus) {
  const detail = payload.detail || payload.type || `respuesta ${response.status}`;
  return new Error(`PandaDoc no pudo ${action}: ${detail}`);
}

export async function checkPandaDoc(apiKey: string) {
  const response = await fetch(`${API_ROOT}/templates?count=1`, { headers: headers(apiKey) });
  const payload = await responsePayload(response);
  if (!response.ok) throw pandaDocError("validar la conexión", response, payload);
  return true;
}

export async function uploadPandaDoc(
  apiKey: string,
  file: Uint8Array,
  student: { id: number; fullName: string; email: string },
) {
  const names = student.fullName.trim().split(/\s+/);
  const firstName = names.shift() || student.fullName;
  const lastName = names.join(" ") || "Alumno";
  const binary = new Uint8Array(file.byteLength);
  binary.set(file);
  const form = new FormData();
  form.append("file", new Blob([binary.buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `Acuerdo TRADINVERSO - ${student.fullName}.docx`);
  form.append("data", JSON.stringify({
    name: `Acuerdo TRADINVERSO - ${student.fullName}`,
    recipients: [{ email: student.email, first_name: firstName, last_name: lastName, role: "Alumno" }],
    parse_form_fields: false,
    tags: ["TRADINVERSO", "Contrato alumnos"],
    metadata: { tradinverso_student_id: String(student.id) },
  }));
  const response = await fetch(`${API_ROOT}/documents?upload`, { method: "POST", headers: headers(apiKey), body: form });
  const payload = await responsePayload(response);
  if (!response.ok || !payload.id) throw pandaDocError("crear el documento", response, payload);
  return { id: payload.id, status: payload.status || "document.uploaded" };
}

export async function getPandaDocStatus(apiKey: string, documentId: string) {
  const response = await fetch(`${API_ROOT}/documents/${encodeURIComponent(documentId)}`, { headers: headers(apiKey) });
  const payload = await responsePayload(response);
  if (!response.ok) throw pandaDocError("consultar el documento", response, payload);
  return payload.status || "";
}

export async function waitForPandaDocDraft(apiKey: string, documentId: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await getPandaDocStatus(apiKey, documentId);
    if (status === "document.draft") return status;
    if (status === "document.error") throw new Error("PandaDoc no pudo procesar el contrato generado.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("PandaDoc sigue preparando el contrato. Vuelve a intentarlo dentro de unos segundos.");
}

export async function sendPandaDoc(apiKey: string, documentId: string, studentName: string) {
  const response = await fetch(`${API_ROOT}/documents/${encodeURIComponent(documentId)}/send`, {
    method: "POST",
    headers: headers(apiKey, true),
    body: JSON.stringify({
      subject: "Firma de tu acuerdo de acceso a TRADINVERSO",
      message: `Hola ${studentName}, revisa y firma tu acuerdo privado de acceso y pago de TRADINVERSO. Recibirás una copia cuando quede completado.`,
      silent: false,
    }),
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw pandaDocError("enviar el contrato", response, payload);
  return payload.status || "document.sent";
}

export function pandaDocAdminUrl(documentId: string) {
  return `https://app.pandadoc.com/a/#/documents/${encodeURIComponent(documentId)}`;
}

export function isPandaDocCompleted(status: string) {
  return status === "document.completed";
}
