const {
  contextBridge,
  ipcRenderer,
} = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,

  saveReportPdf: (suggestedName) =>
    ipcRenderer.invoke(
      "reports:save-pdf",
      suggestedName,
    ),

  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});