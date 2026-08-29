type ArchiveResponse = {
  success?: boolean;
  id?: string;
  url?: string;
  error?: string;
};

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim();
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function archiveSignedPdf(
  webhookUrl: string,
  secret: string,
  pdf: Uint8Array,
  studentName: string,
  documentId: string,
) {
  const fileName = safeFileName(`Acuerdo TRADINVERSO - ${studentName} - firmado.pdf`);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      secret,
      fileName,
      mimeType: "application/pdf",
      contentBase64: toBase64(pdf),
      documentId,
    }),
  });
  const text = await response.text();
  let payload: ArchiveResponse = {};
  try {
    payload = text ? JSON.parse(text) as ArchiveResponse : {};
  } catch {
    payload = { error: text };
  }
  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(`Drive no pudo archivar el contrato: ${payload.error || `respuesta ${response.status}`}`);
  }
  return { id: payload.id || "", url: payload.url };
}
