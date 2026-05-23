const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "electron-app");
const sessionRoot = path.join(os.tmpdir(), "Itera");

const scenarios = [
  ["window close cleanup", "--itera-smoke-test"],
  ["destroy session cleanup", "--itera-destroy-smoke-test"]
];

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  for (const [name, flag] of scenarios) {
    await removeSessionRoot();
    await runElectron(flag);
    await wait(4500);
    const leftovers = getLeftoverSessions();
    if (leftovers.length > 0) {
      throw new Error(`${name} failed: leftover sessions: ${leftovers.join(", ")}`);
    }
    console.log(`${name}: ok`);
  }
}

function runElectron(flag) {
  return new Promise((resolve, reject) => {
    const electronBin = require(path.join(appDir, "node_modules", "electron"));

    const child = spawn(electronBin, [".", flag], {
      cwd: appDir,
      env: withoutElectronRunAsNode(process.env),
      stdio: "inherit",
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Electron smoke scenario timed out: ${flag}`));
    }, 16000);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Electron exited with code ${code} for ${flag}`));
    });
  });
}

function getLeftoverSessions() {
  if (!fs.existsSync(sessionRoot)) {
    return [];
  }

  return fs.readdirSync(sessionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("itera-electron-"))
    .map((entry) => entry.name);
}

async function removeSessionRoot() {
  if (!fs.existsSync(sessionRoot)) {
    return;
  }
  fs.rmSync(sessionRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}

function withoutElectronRunAsNode(env) {
  const nextEnv = { ...env };
  delete nextEnv.ELECTRON_RUN_AS_NODE;
  return nextEnv;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
