# Plataforma privada de contratos TRADINVERSO

**Acceso a la plataforma:** [tradinverso-contratos.tradinverso.workers.dev](https://tradinverso-contratos.tradinverso.workers.dev)

Aplicación interna para registrar alumnos que pagan en USDT o USDC, controlar sus cuotas, gestionar el estado de acceso y generar acuerdos privados personalizados.

## Funciones principales

- Planes de 3 pagos de 510 USDT/USDC o 4 pagos de 385 USDT/USDC.
- Calendario de vencimientos y control de cuotas pagadas, pendientes o vencidas.
- Pausa del acceso cuando existe un pago vencido.
- Contrato personalizado imprimible y exportable como PDF.
- Enlaces directos a las carpetas privadas de Google Drive.
- Registro del enlace del contrato firmado en la ficha del alumno.
- Acceso protegido mediante una única contraseña y cookie de sesión privada.

## Privacidad

Los alumnos, pagos y contratos no se guardan en este repositorio. La base local de desarrollo vive en `.wrangler/`, los secretos en `.env.local` y ambos están excluidos de Git.

No escribas la contraseña real en el código ni en un commit. Copia `.env.example` como `.env.local` para trabajar localmente y configura `APP_PASSWORD` y `SESSION_SECRET` como secretos en el servicio donde se publique la aplicación.

## Desarrollo local

Requiere Node.js 22.13 o posterior y pnpm.

```bash
pnpm install
pnpm dev
```

En el ordenador de administración también puede abrirse con `ABRIR PLATAFORMA.cmd`.

## Publicación con GitHub y Cloudflare

El repositorio de GitHub es la fuente del código. Cloudflare Workers ejecuta la aplicación, sirve los archivos estáticos y guarda alumnos y pagos en la base D1 `tradinverso-contratos`.

```bash
pnpm build
pnpm deploy
```

No existe un único `index.html` porque esta aplicación tiene rutas de servidor, autenticación y una base D1. Vinext genera una aplicación compatible con Cloudflare Workers. GitHub Pages, al ser alojamiento estático, no puede ejecutar por sí solo esta plataforma.

## Estructura

- `app/`: panel, contratos y rutas de datos.
- `db/`: tablas de alumnos y pagos.
- `drizzle/`: migraciones de la base de datos.
- `worker/`: entrada del servidor y protección por contraseña.
- `wrangler.jsonc`: configuración de Cloudflare Worker, archivos estáticos y base D1.

## Datos de producción

La publicación utiliza una base D1 independiente. Los datos locales nunca se copian automáticamente a producción ni se versionan en GitHub. La contraseña, la clave de sesión, los datos del proveedor y los enlaces de Drive se configuran como secretos cifrados de Cloudflare.
