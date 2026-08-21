# Plataforma privada de contratos — TRADINVERSO

## Abrir la plataforma

Haz doble clic en **ABRIR PLATAFORMA.cmd**. La aplicación se abrirá automáticamente en el navegador.

La entrada está protegida por contraseña y no necesita nombre de usuario. La contraseña privada se guarda únicamente en `.env.local`, un archivo excluido de GitHub.

## Flujo recomendado

1. Pulsa **Nuevo alumno** y completa sus datos, el plan de 3 o 4 pagos y las fechas acordadas.
2. Abre **Ver contrato**, comprueba la información y pulsa **Imprimir / Guardar PDF**.
3. Guarda el PDF en la carpeta **02 - Pendientes de firma** de Google Drive.
4. Cuando vuelva firmado, súbelo a **03 - Contratos firmados**.
5. Copia el enlace del PDF firmado en la ficha del alumno y pulsa **Guardar enlace**.
6. Marca cada pago como recibido. Si una cuota vence, la ficha quedará señalada para pausar el acceso.

## Carpetas de Google Drive

Los botones de la propia plataforma abren la carpeta principal, los contratos pendientes de firma y los contratos firmados. Sus enlaces privados se guardan en `.env.local` y no se publican en GitHub.

Los datos de seguimiento de alumnos y pagos quedan guardados localmente en esta aplicación. Los documentos y contratos firmados quedan centralizados en el Drive privado.

## GitHub y publicación

La plataforma no es una página estática basada únicamente en `index.html`: incluye base de datos, rutas privadas y generación de contratos. GitHub guarda el código y el historial. Cloudflare Workers compila y publica automáticamente los cambios de la rama `main`, mantiene la contraseña en sus secretos cifrados y guarda los registros en D1. GitHub Pages no se utiliza porque no puede ejecutar estas funciones privadas.
