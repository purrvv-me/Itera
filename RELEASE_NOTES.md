# Release Notes

## v2.0 - Browser Tabs and Product Polish

Itera now feels more like a real disposable browser MVP while keeping the core one-session identity model. All tabs belong to the same temporary identity for the current launch, and closing Itera still destroys the entire session.

### Highlights

- Multi-tab browser UI.
- New tab button and close button on each tab.
- Active-tab address bar, back, forward, reload, and home behavior.
- Tab titles update from page titles.
- Basic loading state on tabs.
- Drag-and-drop tab reordering.
- Integrated title bar styling for a cleaner browser-like window.
- Itera start page polish with setup cards, GitHub support link, and small project note.
- GitHub support link opens in the user's default browser instead of inside Itera.

### Download

Use the Windows portable build from the GitHub Release assets:

- `Itera-2.0.exe`

### Product Principle

One launch = one disposable identity. All tabs live inside that one identity. Close Itera and the whole identity dies.

## v1.0 - Standalone Disposable Browser Prototype

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

- `Itera-1.0.exe`

### Current Limitations

- This is still an early prototype.
- Itera uses Electron/Chromium internally, not a custom browser engine.
- Code signing is not configured yet, so Windows may show a SmartScreen warning.
- The old Firefox ESR wrapper remains in the repository as a proof of concept, but the Electron app is now the main direction.

### Product Principle

One launch = one life. Close = death. Next launch = new identity.
