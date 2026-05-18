$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Push-Location (Join-Path $Root "electron-app")
try {
    npm.cmd run dev
}
finally {
    Pop-Location
}
