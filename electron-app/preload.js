const { contextBridge, ipcRenderer } = require("electron");
const path = require("node:path");

const args = Object.fromEntries(
  process.argv
    .filter((arg) => arg.startsWith("--itera-"))
    .map((arg) => {
      const [key, ...valueParts] = arg.slice(2).split("=");
      return [key, valueParts.join("=")];
    })
);

contextBridge.exposeInMainWorld("itera", {
  partition: args["itera-partition"] || "itera-default",
  homeUrl: pathToFileUrl(args["itera-home"]),
  features: {},
  closeWindow() {
    ipcRenderer.send("itera-close-window");
  },
  destroySession() {
    ipcRenderer.send("itera-destroy-session");
  },
  onOpenUrl(callback) {
    ipcRenderer.on("itera-open-url", (_event, url) => callback(url));
  },
  onNavigationBlocked(callback) {
    ipcRenderer.on("itera-navigation-blocked", (_event, payload) => callback(payload));
  },
  onPermissionBlocked(callback) {
    ipcRenderer.on("itera-permission-blocked", (_event, payload) => callback(payload));
  },
  onDownloadEvent(callback) {
    ipcRenderer.on("itera-download-event", (_event, payload) => callback(payload));
  }
});

function pathToFileUrl(filePath) {
  if (!filePath) {
    return "about:blank";
  }
  const resolved = path.resolve(filePath).replace(/\\/g, "/");
  return `file:///${encodeURI(resolved)}`;
}
