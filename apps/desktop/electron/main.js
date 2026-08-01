import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(
  fileURLToPath(import.meta.url),
);

const isDevelopment = !app.isPackaged;

function safePdfName(value) {
  const name = String(value || "reporte-ventas.pdf")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim();

  return name.toLowerCase().endsWith(".pdf")
    ? name
    : `${name}.pdf`;
}

ipcMain.handle(
  "reports:save-pdf",
  async (event, suggestedName) => {
    const ownerWindow = BrowserWindow.fromWebContents(
      event.sender,
    );

    const defaultPath = path.join(
      app.getPath("documents"),
      safePdfName(suggestedName),
    );

    const selection = await dialog.showSaveDialog(
      ownerWindow,
      {
        title: "Guardar reporte en PDF",
        defaultPath,
        buttonLabel: "Guardar PDF",
        filters: [
          {
            name: "Documento PDF",
            extensions: ["pdf"],
          },
        ],
      },
    );

    if (selection.canceled || !selection.filePath) {
      return {
        canceled: true,
      };
    }

    const pdf = await event.sender.printToPDF({
      pageSize: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    await writeFile(selection.filePath, pdf);

    return {
      canceled: false,
      filePath: selection.filePath,
    };
  },
);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(
        currentDirectory,
        "preload.cjs",
      ),
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

  mainWindow.loadFile(
    path.join(currentDirectory, "../dist/index.html"),
  );
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