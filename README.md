<p align="center">
  <img src="app/Itera-logo.png" alt="Itera logo" width="520">
</p>

<h1 align="center">Itera</h1>

<p align="center">
  Disposable browser. Every launch begins again.
</p>

<p align="center">
  <strong>One launch = one life. Close = death. Next launch = new identity.</strong>
</p>

<p align="center">
  <a href="https://github.com/purrvv-me/Itera">Repository</a>
  ·
  <a href="https://purrvv-me.github.io/Itera/">Website</a>
  ·
  <a href="https://github.com/purrvv-me/Itera/releases/download/v2.0/Itera-2.0.exe">Download for Windows</a>
  ·
  <a href="https://github.com/purrvv-me/Itera/releases/download/v2.1-android/Itera.apk">Download for Android</a>
  ·
  <a href="https://github.com/purrvv-me/Itera/releases/tag/v2.0">Release 2.0</a>
</p>

## About

Itera is a disposable browser prototype for Windows. It opens as its own minimal browser app, creates a fresh temporary identity for each launch, and destroys that identity when the window closes.

## What Itera Is

Itera is an experimental disposable browser.

Modern browsers remember the user. Private modes try to hide parts of the session. Itera is built around a different idea: a browser identity exists for one session only. When the browser closes, the identity and its profile are destroyed.

Itera is not meant to be another private browser, a Tor replacement, a VPN, a tracker blocker, or a dressed-up incognito mode. The product goal is simpler and stricter:

> The previous browser identity no longer exists.

## Current Status

The main direction is now the Electron browser shell in [`electron-app`](electron-app/). It gives Itera its own window, address bar, icon, start page, and disposable Electron/Chromium session.

The older Python/Firefox ESR wrapper is still in the repository as a proof of concept for the original disposable-profile lifecycle, but it is no longer the preferred product direction.

## What Works

- Standalone-looking Itera window.
- Custom Itera icon and start page.
- Minimal browser chrome with address bar, tabs, tab dragging, back, forward, and reload.
- External project support link that opens in the user's default browser.
- Disposable Electron/Chromium `userData` directory under `%TEMP%\Itera`.
- Session cleanup after close.
- Startup cleanup for abandoned Itera session folders.
- Portable Windows build through Electron Builder.

## What Itera Destroys

The intended disposable session surface includes:

- cookies
- cache
- browsing state
- localStorage
- IndexedDB
- permissions
- form/login state
- browser profile files

In the Electron build, this is handled by creating a temporary app data/session directory for each run and removing it after the app exits.

## Download

Download the current Windows build from the GitHub release:

https://github.com/purrvv-me/Itera/releases/download/v2.0/Itera-2.0.exe

Download the Android APK build:

https://github.com/purrvv-me/Itera/releases/download/v2.1-android/Itera.apk

## Website

The public product site lives in [`docs/index.html`](docs/index.html) and is published through GitHub Pages:

https://purrvv-me.github.io/Itera/

## Architecture

```text
electron-app/
  main.js          Electron lifecycle, disposable session cleanup
  preload.js       Safe bridge from app shell to renderer
  src/
    index.html     Itera browser shell
    renderer.js    Navigation and address bar behavior
    home.html      Itera start page
    styles.css     Browser shell styling
    home.css       Start page styling
  assets/
    logo.svg       Itera visual mark
    itera.ico      Windows app icon
```

The Android port lives here:

```text
android-app/
  app/src/main/java/app/itera/mobile/MainActivity.java
```

The old Firefox proof of concept remains here:

```text
itera_launcher.py
build.ps1
app/
runtime/
```

## Roadmap

- Stronger session monitor.
- RAM-only mode.
- Per-site disposable identities.
- Optional proxy/VPN/Tor routing modes.
- Better crash recovery and cleanup verification.
- Installer and signed Windows release.

These are future features. The current priority is the core product loop:

```text
open Itera -> browser identity is born
close Itera -> identity is destroyed
open again -> a new identity begins
```

## Design Language

Itera should feel sterile, minimal, memoryless, temporary, and calm. The visual identity uses a single burning match on a near-black field with warm orange `ITERA` lettering.

Avoid cyberpunk, hacker-tool, military-security, and fake privacy aesthetics.

## Security Note

Itera is experimental software. It should not yet be treated as a hardened anonymity tool. The current implementation focuses on disposable local browser identity, not network anonymity.
