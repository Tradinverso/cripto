import { env } from "cloudflare:workers";
import { checkPandaDoc } from "../../../lib/pandadoc";

export async function GET() {
  const privateEnv = env as unknown as Record<string, string | undefined>;
  const pandaDocKey = privateEnv.PANDADOC_API_KEY || "";
  let pandaDocConnected = false;
  if (pandaDocKey) {
    try {
      pandaDocConnected = await checkPandaDoc(pandaDocKey);
    } catch {
      pandaDocConnected = false;
    }
  }
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
      archiveConfigured: Boolean(privateEnv.DRIVE_ARCHIVE_WEBHOOK_URL && privateEnv.DRIVE_ARCHIVE_SECRET),
    },
    pandadoc: {
      configured: Boolean(pandaDocKey),
      connected: pandaDocConnected,
    },
    payment: {
      usdt: {
        network: privateEnv.USDT_NETWORK || "TRC20 (TRON)",
        wallet: privateEnv.USDT_WALLET || "",
      },
    },
  });
}
