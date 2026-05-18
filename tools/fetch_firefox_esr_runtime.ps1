param(
    [string]$Lang = "en-US",
    [string]$Arch = "win64"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Cache = Join-Path $Root ".cache\firefox-esr"
$Extract = Join-Path $Cache "extract"
$Runtime = Join-Path $Root "runtime\firefox-esr"
$VersionJson = "https://product-details.mozilla.org/1.0/firefox_versions.json"

$ResolvedRoot = [System.IO.Path]::GetFullPath($Root)
$ResolvedRuntime = [System.IO.Path]::GetFullPath($Runtime)
if (-not $ResolvedRuntime.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write runtime outside the Itera workspace: $ResolvedRuntime"
}

$SevenZip = Get-Command 7z.exe -ErrorAction SilentlyContinue
if (-not $SevenZip) {
    throw "7z.exe is required to extract Firefox's Windows installer into a portable runtime. Install 7-Zip or place Firefox ESR manually at runtime\firefox-esr\firefox.exe."
}

New-Item -ItemType Directory -Force $Cache | Out-Null

$Versions = Invoke-RestMethod -Uri $VersionJson
$Version = $Versions.FIREFOX_ESR
if (-not $Version) {
    throw "Could not resolve latest Firefox ESR version from $VersionJson"
}

$FileName = "Firefox Setup $Version.exe"
$EscapedFileName = [uri]::EscapeDataString($FileName)
$InstallerUrl = "https://ftp.mozilla.org/pub/firefox/releases/$Version/$Arch/$Lang/$EscapedFileName"
$InstallerPath = Join-Path $Cache $FileName

Write-Host "Downloading Firefox ESR $Version..."
Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath

if (Test-Path $Extract) {
    Remove-Item -LiteralPath $Extract -Recurse -Force
}
New-Item -ItemType Directory -Force $Extract | Out-Null

Write-Host "Extracting Firefox installer..."
& $SevenZip.Source x "-o$Extract" -y $InstallerPath | Out-Null

$CoreDir = Get-ChildItem -LiteralPath $Extract -Recurse -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "firefox.exe") } |
    Select-Object -First 1

if (-not $CoreDir) {
    throw "Extracted installer did not contain firefox.exe"
}

if (Test-Path $Runtime) {
    Remove-Item -LiteralPath $Runtime -Recurse -Force
}

New-Item -ItemType Directory -Force (Split-Path -Parent $Runtime) | Out-Null
Copy-Item -Recurse -Force $CoreDir.FullName $Runtime

$Distribution = Join-Path $Runtime "distribution"
New-Item -ItemType Directory -Force $Distribution | Out-Null
Copy-Item -Force (Join-Path $Root "app\policies.json") (Join-Path $Distribution "policies.json")

Write-Host "Firefox ESR runtime ready: $Runtime"
