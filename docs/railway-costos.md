# Reducir el costo en Railway

Railway cobra por RAM y CPU usadas por minuto, por tráfico de salida a internet (egress) y por volúmenes.

## Cambios en el código

- **Chromium se cierra solo** (`apps/backend/src/lib/pdf-render.js`). Antes quedaba abierto para siempre después del primer informe de caja. Ahora se cierra tras 2 minutos sin uso y se vuelve a abrir en el siguiente informe (tarda 1–2 s más, sin cambios para el cajero). Ajustable con `PDF_BROWSER_IDLE_MS`.
- **Compresión gzip** en la API pública (`apps/backend/src/app.js`). Reduce el tráfico de salida hacia la app de escritorio y el inventario móvil. Las rutas `/interno` no cambian.
- **Cola de informes sin sondeo constante** (`informe-turno-notifier.js`). Antes consultaba Postgres cada 2 minutos todo el día. Ahora agenda la siguiente revisión para cuando toca el próximo informe pendiente (5 minutos después del cierre y los reintentos igual que antes), con una revisión de seguridad cada 30 minutos.
- Se eliminó `src/lib/prisma-readonly.js`, que no se usaba.

## Ajustes en el panel de Railway

1. **Red privada entre servicios** (lo más importante para el egress):
   - Backend: `WHATSAPP_BOT_URL=http://<bot>.railway.internal:<puerto>`
   - Bot: `MINIMARKET_API_URL=http://<backend>.railway.internal:<puerto>`

   Si alguna usa `https://...up.railway.app`, las notas de voz y los PDF salen por internet y se cobran.
2. **Réplicas**: 1 réplica por servicio y una sola región. El bot debe tener siempre una sola réplica.
3. **Límite de memoria de Node**: `NODE_OPTIONS=--max-old-space-size=384` en el backend y `256` en el bot (ajustar según Metrics).
4. **Instalación del bot**: agregar `PUPPETEER_SKIP_DOWNLOAD=true` en el servicio del bot; no usa Chromium. **No** agregarlo en el backend, que sí lo necesita para los PDF.
5. **Revisar Metrics** de cada servicio después del despliegue: la RAM del backend ya no debe quedar alta después de un cierre de caja.
