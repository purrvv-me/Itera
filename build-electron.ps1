$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ElectronApp = Join-Path $Root "electron-app"
$IconSource = Join-Path $Root "assets\itera.ico"
$IconTarget = Join-Path $ElectronApp "assets\itera.ico"
$ElectronCache = Join-Path $ElectronApp ".electron-cache"
$ElectronBuilderCache = Join-Path $ElectronApp ".electron-builder-cache"

if (-not (Test-Path $IconSource)) {
    python (Join-Path $Root "tools\generate_icon.py")
}

Copy-Item -Force $IconSource $IconTarget
New-Item -ItemType Directory -Force $ElectronCache | Out-Null
New-Item -ItemType Directory -Force $ElectronBuilderCache | Out-Null

$env:ELECTRON_CACHE = $ElectronCache
$env:ELECTRON_BUILDER_CACHE = $ElectronBuilderCache
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

Push-Location $ElectronApp
try {
    npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }

    npm.cmd run package
    if ($LASTEXITCODE -ne 0) {
        throw "npm run package failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Host "Electron build ready: $ElectronApp\dist"
