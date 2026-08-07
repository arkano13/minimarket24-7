import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const isDevelopment = !app.isPackaged;

let backendProcess = null;

function startBackend() {
  if (isDevelopment) {
    // En desarrollo, el backend se corre aparte con "npm run dev".
    return;
  }

  const backendDirectory = path.join(process.resourcesPath, "backend");
  const backendEntry = path.join(backendDirectory, "src", "server.js");
  const logPath = path.join(app.getPath("userData"), "backend.log");

  const logStream = createWriteStream(logPath, { flags: "a" });

  logStream.write(`\n--- Iniciando backend: ${new Date().toISOString()} ---\n`);
  logStream.write(`Entrada: ${backendEntry}\n`);
  logStream.write(`.env presente: ${existsSync(path.join(backendDirectory, ".env"))}\n`);
  logStream.write(`node_modules presente: ${existsSync(path.join(process.resourcesPath, "node_modules"))}\n`);

  backendProcess = fork(backendEntry, [], {
    cwd: backendDirectory,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  backendProcess.stdout?.on("data", (chunk) => logStream.write(chunk));
  backendProcess.stderr?.on("data", (chunk) => logStream.write(chunk));

  backendProcess.on("error", (error) => {
    logStream.write(`ERROR al iniciar: ${error.stack ?? error}\n`);
    console.error("No se pudo iniciar el backend:", error);
  });

  backendProcess.on("exit", (code) => {
    logStream.write(`Backend terminó con código ${code}\n`);

    if (code !== 0) {
      console.error(`El backend se cerró de forma inesperada (código ${code}).`);
    }
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

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
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopBackend();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});