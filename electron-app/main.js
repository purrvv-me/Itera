const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const APP_NAME = "Itera";
const PROJECT_URL = "https://github.com/purrvv-me/Itera";
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const SESSION_PREFIX = "itera-electron-";
const LEGACY_SESSION_PREFIX = "itera-profile-";
const sessionId = `${SESSION_PREFIX}${crypto.randomUUID()}`;
const sessionRoot = path.join(os.tmpdir(), APP_NAME);
const userDataPath = path.join(sessionRoot, sessionId);
const partitionName = `itera-${crypto.randomUUID()}`;
const appRoot = __dirname;
const appFileRoots = [
  path.join(appRoot, "src"),
  path.join(appRoot, "assets")
].map((entry) => path.resolve(entry));
const smokeTestMode = process.argv.includes("--itera-smoke-test");
const destroySmokeTestMode = process.argv.includes("--itera-destroy-smoke-test");

const featureFlags = Object.freeze({
  ramOnlyMode: false,
  perSiteIdentities: false,
  proxyModes: false,
  sessionMonitor: false
});

app.setName(APP_NAME);
app.setPath("userData", userDataPath);
app.userAgentFallback = DESKTOP_USER_AGENT;
app.commandLine.appendSwitch("user-agent", DESKTOP_USER_AGENT);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication,MediaRouter");
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-sync");
app.commandLine.appendSwitch("disable-default-apps");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("in-process-gpu");

let mainWindow = null;
let cleanupScheduled = false;
let shutdownStarted = false;

async function createWindow() {
  cleanupAbandonedSessions();
  configureDisposableSession(session.fromPartition(partitionName));

  const iconPath = path.join(__dirname, "assets", "itera.ico");
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 920,
    minHeight: 620,
    title: APP_NAME,
    icon: iconPath,
    backgroundColor: "#030814",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#11131a",
      symbolColor: "#f3eee7",
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: [
        `--itera-partition=${partitionName}`,
        `--itera-home=${path.join(__dirname, "src", "home.html")}`,
        `--itera-user-agent=${DESKTOP_USER_AGENT}`
      ],
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on("will-attach-webview", (_event, webPreferences, params) => {
    params.partition = partitionName;
    params.useragent = DESKTOP_USER_AGENT;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  if (destroySmokeTestMode) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }

        mainWindow.webContents.executeJavaScript(
          "Boolean(document.getElementById('destroySessionButton')) && (document.getElementById('destroySessionButton').click(), true)",
          true
        ).then((clicked) => {
          if (!clicked) {
            destroySessionAndQuit();
          }
        }).catch(() => {
          destroySessionAndQuit();
        });
      }, 1000);
    });
  }

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (smokeTestMode) {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    }, 3000);
  }
}

async function destroySession() {
  const target = session.fromPartition(partitionName);
  try {
    await target.clearStorageData();
    await target.clearCache();
  } catch {
    // Profile directory deletion below is the authoritative cleanup path.
  }
}

function configureDisposableSession(target) {
  target.setUserAgent(DESKTOP_USER_AGENT);

  target.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    setRequestHeader(requestHeaders, "User-Agent", DESKTOP_USER_AGENT);
    setRequestHeader(requestHeaders, "Sec-CH-UA", '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"');
    setRequestHeader(requestHeaders, "Sec-CH-UA-Mobile", "?0");
    setRequestHeader(requestHeaders, "Sec-CH-UA-Platform", '"Windows"');
    setRequestHeader(requestHeaders, "Sec-CH-UA-Platform-Version", '"15.0.0"');
    callback({ requestHeaders });
  });

  target.setPermissionRequestHandler((_webContents, permission, callback) => {
    notifyRenderer("itera-permission-blocked", { permission });
    callback(false);
  });

  target.setPermissionCheckHandler(() => false);

  target.on("will-download", (event, item) => {
    const filename = item.getFilename() || "download";
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: "Save file outside Itera",
      defaultPath: path.join(app.getPath("downloads"), filename),
      buttonLabel: "Save outside session",
      message: "Downloaded files are saved outside the disposable identity and will survive after Itera closes."
    });

    if (!savePath) {
      event.preventDefault();
      notifyRenderer("itera-download-event", {
        state: "cancelled",
        filename
      });
      return;
    }

    item.setSavePath(savePath);
    notifyRenderer("itera-download-event", {
      state: "started",
      filename,
      path: savePath
    });

    item.once("done", (_event, state) => {
      notifyRenderer("itera-download-event", {
        state,
        filename,
        path: savePath
      });
    });
  });
}

async function destroySessionAndQuit() {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  app.isQuittingAfterCleanup = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    const windowToDestroy = mainWindow;
    mainWindow = null;
    windowToDestroy.destroy();
  }

  await destroySession();
  schedulePostExitCleanup();

  app.quit();
}

function cleanupAbandonedSessions() {
  if (!fs.existsSync(sessionRoot)) {
    return;
  }

  for (const entry of fs.readdirSync(sessionRoot, { withFileTypes: true })) {
    const isCurrentSession = entry.name === sessionId;
    const isIteraSession = entry.name.startsWith(SESSION_PREFIX) || entry.name.startsWith(LEGACY_SESSION_PREFIX);
    if (entry.isDirectory() && isIteraSession && !isCurrentSession) {
      removeDirectory(path.join(sessionRoot, entry.name));
    }
  }
}

function removeDirectory(targetPath) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return true;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
  return false;
}

function removeEmptySessionRoot() {
  try {
    fs.rmdirSync(sessionRoot);
  } catch {
    // The directory may contain another active Itera session.
  }
}

function schedulePostExitCleanup() {
  if (cleanupScheduled) {
    return;
  }
  cleanupScheduled = true;

  if (process.platform !== "win32") {
    return;
  }

  try {
    const cleanupScriptPath = path.join(os.tmpdir(), `${sessionId}-cleanup.cmd`);
    const script = [
      "@echo off",
      "timeout /t 2 /nobreak > nul",
      "for /L %%i in (1,1,20) do (",
      `  if not exist ${quoteCmd(userDataPath)} goto done`,
      `  rmdir /s /q ${quoteCmd(userDataPath)} > nul 2> nul`,
      `  if not exist ${quoteCmd(userDataPath)} goto done`,
      "  timeout /t 1 /nobreak > nul",
      ")",
      ":done",
      `rmdir /q ${quoteCmd(sessionRoot)} > nul 2> nul`,
      "del /f /q \"%~f0\" > nul 2> nul"
    ].join("\r\n");

    fs.writeFileSync(cleanupScriptPath, script, "utf8");

    const child = spawn(
      path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe"),
      ["/d", "/s", "/c", cleanupScriptPath],
      { detached: true, stdio: "ignore", windowsHide: true }
    );
    child.unref();
  } catch {
    // Startup cleanup on the next Itera launch is the fallback.
  }
}

function quoteCmd(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", async (event) => {
  if (app.isQuittingAfterCleanup) {
    return;
  }

  event.preventDefault();
  await destroySessionAndQuit();
});

app.on("will-quit", () => {
  schedulePostExitCleanup();
  removeDirectory(userDataPath);
  cleanupAbandonedSessions();
  removeEmptySessionRoot();
});

app.on("web-contents-created", (_event, contents) => {
  try {
    contents.setUserAgent(DESKTOP_USER_AGENT);
  } catch {
    // Some internal contents may not allow user-agent changes.
  }

  contents.setWindowOpenHandler(({ url }) => {
    if (url === PROJECT_URL || url.startsWith(`${PROJECT_URL}/`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }

    if (!isAllowedBrowserUrl(url)) {
      notifyRenderer("itera-navigation-blocked", { url });
      return { action: "deny" };
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("itera-open-url", url);
    }
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    if (contents === mainWindow?.webContents) {
      return;
    }

    if (!isAllowedBrowserUrl(url)) {
      event.preventDefault();
      notifyRenderer("itera-navigation-blocked", { url });
    }
  });
});

ipcMain.on("itera-close-window", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.on("itera-destroy-session", async () => {
  await destroySessionAndQuit();
});

global.iteraFeatureFlags = featureFlags;

function isAllowedBrowserUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "about:") {
    return true;
  }

  if (parsed.protocol === "file:") {
    const filePath = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    const normalizedPath = path.resolve(filePath);
    return appFileRoots.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}${path.sep}`));
  }

  return false;
}

function setRequestHeader(headers, name, value) {
  const normalizedName = name.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (headerName.toLowerCase() === normalizedName) {
      delete headers[headerName];
    }
  }
  headers[name] = value;
}

function notifyRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}
