# Release Notes

## v0.2.0 - Standalone Disposable Browser Prototype

Itera now behaves like a standalone browser product instead of a launcher script. The app opens directly into an Itera browser window, creates a fresh disposable identity for the session, and removes that identity after close.

### Highlights

- Standalone-looking Windows app: `Itera.exe`.
- Custom Itera window, icon, start page, and minimal browser chrome.
- Disposable Electron/Chromium session directory under `%TEMP%\Itera`.
- Automatic cleanup after app close.
- Startup cleanup for abandoned Itera session folders.
- Portable Windows build through Electron Builder.

### Download

Use the Windows portable build from the GitHub Release assets:

- `Itera 0.2.0.exe`

### Current Limitations

- This is still an early prototype.
- Itera uses Electron/Chromium internally, not a custom browser engine.
- Code signing is not configured yet, so Windows may show a SmartScreen warning.
- The old Firefox ESR wrapper remains in the repository as a proof of concept, but the Electron app is now the main direction.

### Product Principle

One launch = one life. Close = death. Next launch = new identity.
