# =============================================================================
#  Update the already-installed ITERA in place - no reinstall.
#
#  Rebuilds the app code and swaps the new app.asar into the installed folder.
#  Takes a couple of seconds instead of running the full installer again.
# =============================================================================
$ErrorActionPreference = 'Stop'

# this script lives in <repo>\scripts
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# the harness sometimes forces node-only mode; clear it so electron-builder runs
[Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null)

$version = (Get-Content (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
Write-Host ""
Write-Host "  ITERA in-place update  (v$version)" -ForegroundColor Yellow
Write-Host "  ----------------------------------"

# --- 1. find the installed app ----------------------------------------------
function Find-InstallDir {
  $keys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($k in $keys) {
    try {
      $hit = Get-ItemProperty $k -ErrorAction SilentlyContinue |
             Where-Object { $_.DisplayName -match 'ITERA' -and $_.InstallLocation -and (Test-Path $_.InstallLocation) } |
             Select-Object -First 1
      if ($hit) { return $hit.InstallLocation }
    } catch {}
  }
  foreach ($p in @((Join-Path $env:LOCALAPPDATA 'Programs\itera'),
                   'C:\Program Files\ITERA',
                   (Join-Path $env:LOCALAPPDATA 'Programs\ITERA'))) {
    if (Test-Path (Join-Path $p 'resources\app.asar')) { return $p }
  }
  return $null
}

$installDir = Find-InstallDir
if (-not $installDir) {
  Write-Host "  [x] Could not find an installed ITERA. Run 'npm run dist' and install it once first." -ForegroundColor Red
  exit 1
}
$targetAsar = Join-Path $installDir 'resources\app.asar'
Write-Host "  Installed at:  $installDir"

# --- 2. rebuild the unpacked app (produces a fresh app.asar) -----------------
Write-Host "  Building...    " -NoNewline
& (Join-Path $repo 'node_modules\.bin\electron-builder.cmd') --dir | Out-Null
$newAsar = Join-Path $repo 'dist\win-unpacked\resources\app.asar'
if (-not (Test-Path $newAsar)) {
  Write-Host "failed." -ForegroundColor Red
  Write-Host "  [x] Build did not produce $newAsar" -ForegroundColor Red
  exit 1
}
Write-Host "done."

# --- 3. close the app if it is running --------------------------------------
$procs = Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($installDir, [StringComparison]::OrdinalIgnoreCase) }
if ($procs) {
  Write-Host "  Closing running ITERA ($($procs.Count) process(es))..."
  $procs | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {} }
  Start-Sleep -Milliseconds 1200
}

# --- 4. swap in the new code -------------------------------------------------
Copy-Item -Path $newAsar -Destination $targetAsar -Force
$newUnpacked = Join-Path $repo 'dist\win-unpacked\resources\app.asar.unpacked'
if (Test-Path $newUnpacked) {
  $dstUnpacked = Join-Path $installDir 'resources\app.asar.unpacked'
  Copy-Item -Path $newUnpacked -Destination $dstUnpacked -Recurse -Force
}

$size = [math]::Round((Get-Item $targetAsar).Length / 1KB, 0)
Write-Host ""
Write-Host "  [ DONE ] Updated $targetAsar ($size KB)." -ForegroundColor Green
Write-Host "           Just relaunch ITERA - no reinstall needed."
Write-Host ""
