# Plataforma privada de contratos TRADINVERSO

**Acceso oficial a la plataforma:** [contratos.tradinverso.com](https://contratos.tradinverso.com)

Este dominio redirige a la aplicación alojada en Cloudflare.

Aplicación interna para registrar alumnos que pagan en USDT o USDC, controlar sus cuotas, gestionar el estado de acceso y generar acuerdos privados personalizados.

## Funciones principales

- Plan estándar de 3 pagos de 550 USDT/USDC o 550 € mediante Bizum/SeQura (total 1.650).
- Calendario de vencimientos y control de cuotas pagadas, pendientes o vencidas.
- Pausa del acceso cuando existe un pago vencido.
- Contrato personalizado imprimible y exportable como PDF.
- Enlaces directos a las carpetas privadas de Google Drive.
- Archivado automático del PDF firmado en Drive y registro de su enlace en la ficha del alumno.
- Generación del mismo acuerdo en DOCX, envío por PandaDoc y seguimiento del estado de firma.
- Acceso protegido mediante una única contraseña y cookie de sesión privada.

## Privacidad

Los alumnos, pagos y contratos no se guardan en este repositorio. La base local de desarrollo vive en `.wrangler/`, los secretos en `.env.local` y ambos están excluidos de Git.

No escribas contraseñas ni claves de API reales en el código o en un commit. Copia `.env.example` como `.env.local` para trabajar localmente y configura `APP_PASSWORD`, `SESSION_SECRET` y `PANDADOC_API_KEY` como secretos en el servicio donde se publique la aplicación.

## Desarrollo local

Requiere Node.js 22.13 o posterior y pnpm.

```bash
pnpm install
pnpm dev
```

En el ordenador de administración también puede abrirse con `ABRIR PLATAFORMA.cmd`.

## Publicación con GitHub y Cloudflare

El repositorio de GitHub es la fuente del código. Cloudflare Workers ejecuta la aplicación, sirve los archivos estáticos y guarda alumnos y pagos en la base D1 `tradinverso-contratos`.

Cada cambio enviado a la rama `main` activa GitHub Actions, compila la plataforma, aplica las migraciones pendientes y publica la nueva versión en Cloudflare Workers.

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

La publicación utiliza una base D1 independiente. Los datos locales nunca se copian automáticamente a producción ni se versionan en GitHub. La contraseña, la clave de sesión, los datos del proveedor, el acceso a PandaDoc y el enlace seguro de archivado en Drive se configuran como secretos cifrados de Cloudflare.

## Trabajo desde otro ordenador

El trabajo diario no depende de este PC. Desde cualquier ordenador se puede abrir `contratos.tradinverso.com`, iniciar sesión y gestionar alumnos, pagos, contratos y firmas. PandaDoc, Drive y la base de datos funcionan en la nube.

Solo hace falta trabajar con el repositorio cuando se quiera modificar o publicar una nueva versión de la aplicación. El archivo `PROMPT-GESTION-CONTRATOS.md` contiene el mensaje preparado para iniciar un chat de gestión desde Codex en otro ordenador.
