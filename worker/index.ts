/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_PASSWORD?: string;
  SESSION_SECRET?: string;
  PANDADOC_API_KEY?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const AUTH_COOKIE = "tradinverso_session";
const SESSION_MESSAGE = "tradinverso-private-access-v1";

function loginPage(message = ""): Response {
  const notice = message ? `<p class="notice">${message}</p>` : "";
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acceso privado | TRADINVERSO</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f5f7;color:#17243c;font-family:Inter,Arial,sans-serif}.card{width:min(420px,100%);background:#fff;border:1px solid #e1e5eb;border-radius:16px;padding:34px;box-shadow:0 24px 70px rgba(20,34,57,.12)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:30px}.mark{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:#17243c;color:#dcb351;font:700 22px Georgia,serif}.brand strong{display:block;letter-spacing:.08em}.brand span{display:block;color:#7b8798;font-size:12px;margin-top:3px}h1{font:600 30px Georgia,serif;margin:0 0 9px}p{color:#718096;font-size:14px;line-height:1.55;margin:0 0 24px}label{display:block;color:#41506a;font-size:12px;font-weight:700}input{width:100%;margin-top:8px;border:1px solid #d8dee8;border-radius:9px;padding:13px 14px;font-size:15px;outline:none}input:focus{border-color:#9b7a34;box-shadow:0 0 0 3px rgba(155,122,52,.12)}button{width:100%;margin-top:15px;border:0;border-radius:9px;padding:13px;background:#17243c;color:#fff;font-size:13px;font-weight:800;cursor:pointer}.notice{margin:-8px 0 17px;padding:10px 12px;border-radius:8px;background:#fff1f1;color:#a63e3e;font-size:12px}
</style></head><body><main class="card"><div class="brand"><div class="mark">T</div><div><strong>TRADINVERSO</strong><span>Gestión privada</span></div></div><h1>Acceso restringido</h1><p>Introduce la contraseña para acceder al control de alumnos, pagos y contratos.</p>${notice}<form action="/api/auth/login" method="post"><label>Contraseña<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Entrar en la plataforma</button></form></main></body></html>`;
  return new Response(html, {
    status: message ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index++) difference |= leftHash[index] ^ rightHash[index];
  return difference === 0;
}

async function sessionToken(env: Env): Promise<string> {
  const secret = env.SESSION_SECRET || env.APP_PASSWORD || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(SESSION_MESSAGE)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sessionCookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${AUTH_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      if (!env.APP_PASSWORD) return loginPage("La contraseña todavía no está configurada en el servidor.");
      const form = await request.formData();
      const password = String(form.get("password") || "");
      if (!(await secureEqual(password, env.APP_PASSWORD))) return loginPage("La contraseña no es correcta.");
      return new Response(null, {
        status: 303,
        headers: {
          Location: new URL("/", request.url).toString(),
          "Set-Cookie": sessionCookie(request, await sessionToken(env), 60 * 60 * 12),
        },
      });
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return new Response(null, {
        status: 303,
        headers: {
          Location: new URL("/", request.url).toString(),
          "Set-Cookie": sessionCookie(request, "", 0),
        },
      });
    }

    const configured = Boolean(env.APP_PASSWORD);
    const authorized = configured && await secureEqual(cookieValue(request, AUTH_COOKIE), await sessionToken(env));
    if (!authorized) {
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ error: configured ? "Acceso no autorizado." : "Protección sin configurar." }, { status: configured ? 401 : 503 });
      }
      return loginPage(configured ? "" : "La protección está pendiente de configuración.");
    }

    if (url.pathname === "/_vinext/image") {
      if (!env.IMAGES) {
        const sourcePath = url.searchParams.get("url");
        if (sourcePath?.startsWith("/")) {
          return env.ASSETS.fetch(new Request(new URL(sourcePath, request.url)));
        }
        return new Response("Imagen no disponible.", { status: 400 });
      }
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
