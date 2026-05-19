const { app, BrowserWindow, ipcMain, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const APP_NAME = "Itera";
const SESSION_PREFIX = "itera-electron-";
const LEGACY_SESSION_PREFIX = "itera-profile-";
const sessionId = `${SESSION_PREFIX}${crypto.randomUUID()}`;
const sessionRoot = path.join(os.tmpdir(), APP_NAME);
const userDataPath = path.join(sessionRoot, sessionId);
const partitionName = `itera-${crypto.randomUUID()}`;
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: [
        `--itera-partition=${partitionName}`,
        `--itera-home=${path.join(__dirname, "src", "home.html")}`
      ],
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  if (destroySmokeTestMode) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }

        mainWindow.webContents.executeJavaScript(
          "document.getElementById('destroySessionButton')?.click()",
          true
        );
      }, 1000);
    });
  }

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

async function destroySessionAndQuit() {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  app.isQuittingAfterCleanup = true;
  await destroySession();
  schedulePostExitCleanup();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }

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
  contents.setWindowOpenHandler(({ url }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("itera-open-url", url);
    }
    return { action: "deny" };
  });
});

ipcMain.on("itera-close-window", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.handle("itera-destroy-session", async () => {
  await destroySessionAndQuit();
  return true;
});

global.iteraFeatureFlags = featureFlags;
