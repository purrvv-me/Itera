param(
    [string]$FirefoxPath = "C:\Program Files\Mozilla Firefox\firefox.exe"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Source = Split-Path -Parent $FirefoxPath
$Target = Join-Path $Root "runtime\firefox-esr"
$ResolvedRoot = [System.IO.Path]::GetFullPath($Root)
$ResolvedTarget = [System.IO.Path]::GetFullPath($Target)

if (-not (Test-Path $FirefoxPath)) {
    throw "Firefox runtime not found at: $FirefoxPath"
}

if (-not $ResolvedTarget.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write runtime outside the Itera workspace: $ResolvedTarget"
}

New-Item -ItemType Directory -Force (Split-Path -Parent $Target) | Out-Null
if (Test-Path $Target) {
    Remove-Item -LiteralPath $Target -Recurse -Force
}

Copy-Item -Recurse -Force $Source $Target
Write-Host "Runtime prepared: $Target"
