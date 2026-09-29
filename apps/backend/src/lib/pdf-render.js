// apps/backend/src/lib/pdf-render.js
//
// Único lugar del backend que sabe convertir HTML a PDF. Usa Puppeteer
// porque el backend es un proceso Node normal (no Electron), así que
// no tiene printToPDF disponible como el desktop.
//
// Reutiliza el navegador entre llamadas cercanas (arrancar Chromium tarda
// 1-2 segundos), pero lo cierra tras unos minutos sin uso: solo se generan
// unos pocos informes al día y un Chromium ocioso ocupa cientos de MB de
// RAM que en Railway se cobran por minuto.

import puppeteer from "puppeteer";

const CIERRE_OCIOSO_MS = Number(process.env.PDF_BROWSER_IDLE_MS ?? 2 * 60_000);

let browserPromise = null;
let activos = 0;
let idleTimer = null;

function programarCierre() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    if (activos > 0 || !browserPromise) return;
    const pendiente = browserPromise;
    browserPromise = null;
    const browser = await pendiente.catch(() => null);
    await browser?.close?.().catch(() => {});
  }, CIERRE_OCIOSO_MS);
  idleTimer.unref?.();
}

async function getBrowser() {
  if (!browserPromise) {
    const launch = puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // /dev/shm es pequeño en contenedores; sin esto Chromium puede caerse.
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
      ],
    });
    browserPromise = launch;

    // Si el navegador se cae (crash, kill externo, etc.), no seguir
    // devolviendo una promesa resuelta con un browser muerto — la
    // siguiente llamada debe relanzarlo.
    launch.then((browser) => {
      browser.on("disconnected", () => {
        // Solo olvidar la promesa si sigue siendo la de este navegador.
        if (browserPromise === launch) browserPromise = null;
      });
    }, () => {
      // Un arranque fallido no debe impedir todos los reintentos de la cola.
      if (browserPromise === launch) browserPromise = null;
    });
  }

  return browserPromise;
}

export async function renderHtmlToPdf(html) {
  clearTimeout(idleTimer);
  activos++;

  try {
    return await renderizar(html);
  } finally {
    activos--;
    if (activos === 0) programarCierre();
  }
}

async function renderizar(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "13mm",
        bottom: "16mm",
        left: "13mm",
      },
    });

    // Puppeteer puede devolver un Uint8Array "plano" en vez de un
    // Buffer de Node real — Baileys (sock.sendMessage con document:)
    // espera específicamente un Buffer, si no falla al armar el
    // mensaje ("Cannot read properties of undefined").
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
