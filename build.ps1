param(
    [switch]$SkipIcon,
    [switch]$SkipRuntimeCopy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Assets = Join-Path $Root "assets"
$RuntimeSource = Join-Path $Root "runtime\firefox-esr"
$Dist = Join-Path $Root "dist\Itera"
$Icon = Join-Path $Assets "itera.ico"

python -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not installed. Run: python -m pip install -r requirements-build.txt"
}

if (-not $SkipIcon) {
    python (Join-Path $Root "tools\generate_icon.py")
}

python -m PyInstaller `
    --noconfirm `
    --clean `
    --onedir `
    --windowed `
    --name Itera `
    --icon $Icon `
    (Join-Path $Root "itera_launcher.py")

$DistApp = Join-Path $Dist "app"
New-Item -ItemType Directory -Force $DistApp | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root "app\*") $DistApp

if (-not $SkipRuntimeCopy) {
    if (-not (Test-Path (Join-Path $RuntimeSource "firefox.exe"))) {
        throw "Firefox ESR runtime missing. Put it at runtime\firefox-esr\firefox.exe before packaging."
    }

    New-Item -ItemType Directory -Force (Join-Path $Dist "runtime") | Out-Null
    Copy-Item -Recurse -Force $RuntimeSource (Join-Path $Dist "runtime\firefox-esr")

    $Distribution = Join-Path $Dist "runtime\firefox-esr\distribution"
    New-Item -ItemType Directory -Force $Distribution | Out-Null
    Copy-Item -Force (Join-Path $Root "app\policies.json") (Join-Path $Distribution "policies.json")
}

Write-Host "Portable build ready: $Dist"
