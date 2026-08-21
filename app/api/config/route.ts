import { env } from "cloudflare:workers";

export async function GET() {
  const privateEnv = env as unknown as Record<string, string | undefined>;
  return Response.json({
    provider: {
      name: privateEnv.PROVIDER_NAME || "",
      documentId: privateEnv.PROVIDER_DOCUMENT_ID || "",
      address: privateEnv.PROVIDER_ADDRESS || "",
      email: privateEnv.PROVIDER_EMAIL || "",
      phone: privateEnv.PROVIDER_PHONE || "",
    },
    drive: {
      root: privateEnv.DRIVE_ROOT_URL || "",
      pending: privateEnv.DRIVE_PENDING_URL || "",
      signed: privateEnv.DRIVE_SIGNED_URL || "",
    },
  });
}
