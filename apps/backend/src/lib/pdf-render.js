// apps/backend/src/lib/pdf-render.js
//
// Único lugar del backend que sabe convertir HTML a PDF. Usa Puppeteer
// porque el backend es un proceso Node normal (no Electron), así que
// no tiene printToPDF disponible como el desktop.
//
// Reutiliza el navegador entre llamadas (arrancar Chromium tarda
// 1-2 segundos; hacerlo en cada informe sería un desperdicio y además
// deja procesos zombie si algo falla a medio camino).

import puppeteer from "puppeteer";

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Si el navegador se cae (crash, kill externo, etc.), no seguir
    // devolviendo una promesa resuelta con un browser muerto — la
    // siguiente llamada debe relanzarlo.
    browserPromise.then((browser) => {
      browser.on("disconnected", () => {
        browserPromise = null;
      });
    }, () => {
      // Un arranque fallido no debe impedir todos los reintentos de la cola.
      browserPromise = null;
    });
  }

  return browserPromise;
}

export async function renderHtmlToPdf(html) {
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
