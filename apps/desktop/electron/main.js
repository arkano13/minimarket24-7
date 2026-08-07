import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSalesReportHtml, safePdfName } from "./sales-report-pdf.js";
import { buildAdministrativeReportHtml } from "./administrative-report-pdf.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const isDevelopment = !app.isPackaged;

ipcMain.handle("reports:save-pdf", async (event, payload) => {
  if (!payload?.report || typeof payload.report !== "object") {
    throw new Error("No se recibieron los datos del reporte.");
  }

  const isAdministrative = payload.reportType === "ADMINISTRATIVE";


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
    const reportHtml = isAdministrative
      ? buildAdministrativeReportHtml(payload.report)
      : buildSalesReportHtml(payload.report);

    await writeFile(temporaryHtmlPath, reportHtml, "utf8");

    await reportWindow.loadFile(temporaryHtmlPath);

    const reportName = isAdministrative
      ? "Reporte administrativo"
      : "Reporte operativo";

    const pdf = await reportWindow.webContents.printToPDF({
      pageSize: "A4",

      landscape: !isAdministrative,

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
                ${reportName}
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