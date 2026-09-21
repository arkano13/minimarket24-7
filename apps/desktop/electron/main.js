import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electronUpdater from "electron-updater";
import { generarInformeTurnoHTML, safePdfName } from "./shift-report-pdf.js";
import { buildUserSalesReceiptHtml } from "./sale-receipt.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const isDevelopment = !app.isPackaged;

const { autoUpdater } = electronUpdater;

const UPDATE_CHECK_DELAY_MS = 15 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

// Actualización automática: revisa GitHub Releases al abrir la app y cada 30
// minutos. Descarga la versión nueva en segundo plano y la instala sola al
// cerrar el programa. También avisa para poder reiniciar antes, sin
// interrumpir una venta en curso. Solo corre en la app instalada.
function setupAutoUpdater() {
  if (isDevelopment) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("[actualizador]", error?.message ?? error);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const ownerWindow = BrowserWindow.getAllWindows()[0];

    const options = {
      type: "info",
      title: "Actualización lista",
      message: `La versión ${info.version} de Minimarket 24/7 está lista para instalar.`,
      detail:
        "Se instalará automáticamente al cerrar la aplicación. " +
        "Si la reinicias ahora, no lo hagas en medio de una venta.",
      buttons: ["Reiniciar ahora", "Más tarde"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    };

    const { response } = ownerWindow
      ? await dialog.showMessageBox(ownerWindow, options)
      : await dialog.showMessageBox(options);

    if (response === 0) {
      autoUpdater.quitAndInstall(true, true);
    }
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      // Sin internet o sin release nuevo: no es un problema, se reintenta luego.
      console.error("[actualizador]", error?.message ?? error);
    });
  };

  setTimeout(checkForUpdates, UPDATE_CHECK_DELAY_MS);
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

ipcMain.handle("sales:print-user-sales", async (event, report) => {
  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  const temporaryHtmlPath = path.join(
    app.getPath("temp"),
    `minisuper-receipt-${randomUUID()}.html`,
  );
  const receiptWindow = new BrowserWindow({
    show: false,
    parent: ownerWindow ?? undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  try {
    await writeFile(temporaryHtmlPath, buildUserSalesReceiptHtml(report), "utf8");
    await receiptWindow.loadFile(temporaryHtmlPath);

    const printers = await receiptWindow.webContents.getPrintersAsync();
    const receiptPrinter = printers.find((printer) =>
      /rpt\s*0*06|receipt|pos[-_ ]?80|thermal/i.test(
        `${printer.name} ${printer.displayName ?? ""}`,
      ),
    ) ?? printers.find((printer) => printer.isDefault);

    if (!receiptPrinter) {
      throw new Error("No se encontró la impresora térmica RPT006S instalada en Windows.");
    }

    return await new Promise((resolve, reject) => {
      receiptWindow.webContents.print(
        { silent: true, deviceName: receiptPrinter.name, printBackground: true },
        (success, failureReason) => {
          if (success) resolve({ printed: true, printer: receiptPrinter.displayName ?? receiptPrinter.name });
          else reject(new Error(failureReason || "No se pudo imprimir el recibo."));
        },
      );
    });
  } finally {
    if (!receiptWindow.isDestroyed()) receiptWindow.destroy();
    await unlink(temporaryHtmlPath).catch(() => {});
  }
});

// Imprime un informe ya armado (HTML) con el diálogo de impresión de
// Windows — el usuario elige impresora, copias, etc. El HTML lo genera el
// backend con la misma plantilla que el PDF de WhatsApp, así lo impreso
// es idéntico. No usa la térmica de recibos: el informe es tamaño carta.
ipcMain.handle("reports:print-html", async (event, payload) => {
  if (typeof payload?.html !== "string" || payload.html.length === 0) {
    throw new Error("No se recibió el informe a imprimir.");
  }

  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  const temporaryHtmlPath = path.join(
    app.getPath("temp"),
    `minisuper-print-${randomUUID()}.html`,
  );
  const printWindow = new BrowserWindow({
    show: false,
    parent: ownerWindow ?? undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  try {
    await writeFile(temporaryHtmlPath, payload.html, "utf8");
    await printWindow.loadFile(temporaryHtmlPath);

    // Fuerza a imprimir los colores de fondo. Sin esto, el encabezado
    // verde (texto blanco sobre degradado) sale casi invisible y se
    // pierden los tonos de tarjetas y barras. Solo afecta a la
    // impresión: no se toca la plantilla que usa WhatsApp.
    await printWindow.webContents.insertCSS(
      "*, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
    );

    return await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          pageSize: "Letter",
          // Los márgenes ya vienen definidos en el @page de la plantilla.
          margins: { marginType: "none" },
        },
        (success, failureReason) => {
          if (success) {
            resolve({ printed: true });
          } else if (/cancel/i.test(failureReason ?? "")) {
            resolve({ canceled: true });
          } else {
            reject(new Error(failureReason || "No se pudo imprimir el informe."));
          }
        },
      );
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
    await unlink(temporaryHtmlPath).catch(() => {});
  }
});

// Un solo tipo de reporte: el informe de turno unificado. Reemplaza los
// antiguos "administrativo" (ADMINISTRATIVE) y "operativo" (ventas) —
// ya no se distingue reportType, siempre se genera el mismo documento.
ipcMain.handle("reports:save-pdf", async (event, payload) => {
  if (!payload?.report || typeof payload.report !== "object") {
    throw new Error("No se recibieron los datos del reporte.");
  }

  const ownerWindow = BrowserWindow.fromWebContents(event.sender);

  const defaultPath = path.join(
    app.getPath("documents"),
    safePdfName(payload.suggestedName),
  );

  const selection = await dialog.showSaveDialog(ownerWindow, {
    title: "Guardar reporte en PDF",
    defaultPath,
    buttonLabel: "Guardar PDF",
    filters: [
      {
        name: "Documento PDF",
        extensions: ["pdf"],
      },
    ],
  });

  if (selection.canceled || !selection.filePath) {
    return {
      canceled: true,
    };
  }

  const temporaryHtmlPath = path.join(
    app.getPath("temp"),
    `minisuper-report-${randomUUID()}.html`,
  );

  const reportWindow = new BrowserWindow({
    show: false,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    const reportHtml = generarInformeTurnoHTML(payload.report);

    await writeFile(temporaryHtmlPath, reportHtml, "utf8");

    await reportWindow.loadFile(temporaryHtmlPath);

    const pdf = await reportWindow.webContents.printToPDF({
      pageSize: "A4",

      landscape: false,

      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,

      headerTemplate: "<div></div>",

      footerTemplate: `
            <div
              style="
                box-sizing: border-box;
                display: flex;
                justify-content: space-between;
                width: 100%;
                padding: 0 11mm;
                color: #64748b;
                font-family: Arial, sans-serif;
                font-size: 8px;
              "
            >
              <span>
                Minimarket 24/7 ·
                Informe de turno
              </span>

              <span>
                Página
                <span class="pageNumber"></span>
                de
                <span class="totalPages"></span>
              </span>
            </div>
          `,

      margins: {
        top: 0.45,
        bottom: 0.55,
        left: 0.35,
        right: 0.35,
      },
    });

    await writeFile(selection.filePath, pdf);

    return {
      canceled: false,
      filePath: selection.filePath,
    };
  } finally {
    if (!reportWindow.isDestroyed()) {
      reportWindow.destroy();
    }

    await unlink(temporaryHtmlPath).catch(() => {});
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#f2eee3",

    webPreferences: {
      preload: path.join(currentDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (isDevelopment) {
    mainWindow.loadURL("http://127.0.0.1:5173");

    return;
  }

  mainWindow.loadFile(path.join(currentDirectory, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});