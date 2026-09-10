const {
  contextBridge,
  ipcRenderer,
} = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,

  saveReportPdf: (payload) =>
    ipcRenderer.invoke(
      "reports:save-pdf",
      payload,
    ),

  printUserSales: (report) =>
    ipcRenderer.invoke("sales:print-user-sales", report),

  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
