'use strict';

const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Fresh identity, every launch.
//
// Each run gets its own unique, on-disk session partition. Because the folder
// name is new every time, the browser starts with zero cookies / cache /
// storage and a freshly randomized user agent. On exit we wipe it from disk
// *visibly*, in a terminal, so the user can see their tracks being erased.
// ---------------------------------------------------------------------------

const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const partitionName = `persist:itera-${sessionId}`; // persisted => real files on disk to wipe
const partitionDir = `itera-${sessionId}`;          // folder name under Partitions/

const userAgent = randomUserAgent();

let mainWindow = null;
let cleaningUp = false;

// ---------------------------------------------------------------------------
// Randomized, realistic desktop-Chrome user agent (so every site still works).
// ---------------------------------------------------------------------------
function randomUserAgent() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chromeMajor = 120 + Math.floor(Math.random() * 12); // 120 - 131
  const build = 1000 + Math.floor(Math.random() * 6000);
  const patch = Math.floor(Math.random() * 200);
  const platform = pick([
    'Windows NT 10.0; Win64; x64',
    'Windows NT 10.0; WOW64',
    'Windows NT 10.0; Win64; x64',
  ]);
  return (
    `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) ` +
    `Chrome/${chromeMajor}.0.${build}.${patch} Safari/537.36`
  );
}

function partitionsRoot() {
  return path.join(app.getPath('userData'), 'Partitions');
}

// Remove any ITERA partitions left behind by a previous crash, so we never
// silently inherit an old identity.
function purgeStalePartitions() {
  try {
    const root = partitionsRoot();
    if (!fs.existsSync(root)) return;
    for (const name of fs.readdirSync(root)) {
      if (name.startsWith('itera-') && name !== partitionDir) {
        fs.rmSync(path.join(root, name), { recursive: true, force: true });
      }
    }
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Configure the disposable session.
// ---------------------------------------------------------------------------
function configureSession() {
  const ses = session.fromPartition(partitionName);
  ses.setUserAgent(userAgent);

  // Look like a normal browser to be friendly to sites.
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = userAgent;
    callback({ requestHeaders: details.requestHeaders });
  });

  // Allow the permissions media-heavy sites (YouTube/Spotify) ask for.
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    const allowed = ['media', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'pointerLock'];
    callback(allowed.includes(permission));
  });

  return ses;
}

// ---------------------------------------------------------------------------
// Main window.
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    frame: false,
    backgroundColor: '#0e0e10',
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      partition: partitionName,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // keep the maximize/restore button icon in sync with the actual state
  const sendState = () =>
    mainWindow && mainWindow.webContents.send('itera:maximized', mainWindow.isMaximized());
  mainWindow.on('maximize', sendState);
  mainWindow.on('unmaximize', sendState);
}

// Keep popups inside the same view and force the randomized UA on every
// webview that gets created.
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    contents.setUserAgent(userAgent);
    // A link/script opening a new window becomes a new tab in the renderer.
    contents.setWindowOpenHandler(({ url, disposition }) => {
      if (mainWindow && url) {
        mainWindow.webContents.send('itera:new-tab', {
          url,
          background: disposition === 'background-tab',
        });
      }
      return { action: 'deny' };
    });
  }
});

// ---------------------------------------------------------------------------
// IPC: window controls + config for the renderer.
// ---------------------------------------------------------------------------
ipcMain.handle('itera:config', () => ({ partition: partitionName, userAgent }));
ipcMain.on('itera:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('itera:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('itera:close', () => app.quit());
// Forced "kill session" — same flow as closing: visible wipe terminal, then exit.
ipcMain.on('itera:kill-session', () => app.quit());

// ---------------------------------------------------------------------------
// The visible wipe. A real terminal window appears and erases this session.
// ---------------------------------------------------------------------------
function runVisibleCleanup(targets) {
  // When packaged, scripts/cleanup.bat lives *inside* app.asar — a virtual
  // archive cmd.exe cannot execute from. So copy it out to a real temp file
  // first (fs reads transparently through asar) and run that.
  const srcBat = path.join(__dirname, '..', 'scripts', 'cleanup.bat');
  const tmpBat = path.join(os.tmpdir(), `itera-wipe-${Date.now()}.bat`);
  let bat = srcBat;
  try {
    fs.writeFileSync(tmpBat, fs.readFileSync(srcBat));
    bat = tmpBat;
  } catch {
    /* fall back to the original path */
  }
  try {
    // `start` opens a brand-new console window that the batch writes to, so the
    // user actually sees the deletion happen. The outer cmd exits immediately.
    const child = spawn('cmd.exe', ['/c', 'start', '', '/wait', bat, ...targets], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    /* if the terminal fails to spawn we still wipe via Electron APIs below */
  }
}

app.on('before-quit', (e) => {
  if (cleaningUp) return;
  e.preventDefault();
  cleaningUp = true;

  const ses = session.fromPartition(partitionName);
  const tasks = [ses.clearStorageData(), ses.clearCache()];
  if (ses.clearAuthCache) tasks.push(ses.clearAuthCache());
  if (ses.clearHostResolverCache) tasks.push(ses.clearHostResolverCache());

  Promise.allSettled(tasks).finally(() => {
    // Wipe the ENTIRE app profile on exit — not just this session's partition.
    // The terminal shows every real deletion command as it runs.
    const userDataDir = app.getPath('userData');
    runVisibleCleanup([userDataDir]);
    // give the terminal a beat to spawn before the process dies
    setTimeout(() => app.exit(0), 250);
  });
});

// ---------------------------------------------------------------------------
// App lifecycle.
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  purgeStalePartitions();
  configureSession();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
