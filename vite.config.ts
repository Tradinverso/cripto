import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  const localRuntimeVars = mode === "development" ? {
    APP_PASSWORD: localEnv.APP_PASSWORD || "",
    SESSION_SECRET: localEnv.SESSION_SECRET || "",
    PROVIDER_NAME: localEnv.PROVIDER_NAME || "",
    PROVIDER_DOCUMENT_ID: localEnv.PROVIDER_DOCUMENT_ID || "",
    PROVIDER_ADDRESS: localEnv.PROVIDER_ADDRESS || "",
    PROVIDER_EMAIL: localEnv.PROVIDER_EMAIL || "",
    PROVIDER_PHONE: localEnv.PROVIDER_PHONE || "",
    DRIVE_ROOT_URL: localEnv.DRIVE_ROOT_URL || "",
    DRIVE_PENDING_URL: localEnv.DRIVE_PENDING_URL || "",
    DRIVE_SIGNED_URL: localEnv.DRIVE_SIGNED_URL || "",
  } : {};
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        configPath: "./wrangler.jsonc",
        config: (userConfig) => {
          userConfig.vars = localRuntimeVars;
        },
      }),
    ],
  };
});
