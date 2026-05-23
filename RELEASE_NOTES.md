# Release Notes

## v2.1 - Disposable Browser Hardening and Chrome Polish

Itera 2.1 tightens the disposable browser behavior and makes the desktop app feel more like its own browser product instead of a generic Electron shell.

### Highlights

- Windows portable build: `Itera-2.1.exe`.
- More distinctive Itera browser chrome with a stronger active-tab treatment, premium address bar, grouped navigation controls, and visible identity status.
- `Destroy Session` is more reliable and exits through a fire-and-forget cleanup path.
- Session cleanup smoke tests cover both normal window close and explicit session destruction.
- Permission requests are blocked by default.
- Downloads save directly to the device and survive outside the disposable identity.
- External support links open in the user's default browser.

### Download

Use the Windows portable build from the GitHub Release assets:

- `Itera-2.1.exe`

### Product Principle

One launch = one disposable identity. All tabs live inside that one identity. Close Itera and the whole identity dies.

## v2.1-android - Android Mobile Polish

Itera Android now has the same updated mobile direction as the desktop MVP: cleaner controls, a more focused start page, stricter permission behavior, and direct device downloads that live outside the disposable identity.

### Highlights

- Android APK build: `Itera.apk`.
- Redesigned mobile browser shell and start page.
- Mobile tabs, address controls, back, forward, reload, and home.
- Disposable WebView data cleanup on launch and close.
- Permission requests are blocked by default.
- Downloads save directly to the device and survive outside the disposable identity.
- GitHub support link opens in the user's default browser.

### Download

Use the Android APK from the GitHub Release assets:

- `Itera.apk`

### Product Principle

One launch = one disposable identity. All mobile tabs live inside that one identity. Close Itera and the whole identity dies.

## v2.0-android - Android APK Prototype

Itera now has an Android APK prototype. It ports the disposable browser idea to a mobile WebView shell: one app launch creates one temporary mobile identity, tabs live inside that launch, and closing/destroying the session clears local WebView data.

### Highlights

- Android APK build: `Itera.apk`.
- Mobile browser shell with tabs.
- Address bar, back, forward, reload, and home controls.
- Itera mobile start page.
- Disposable WebView data cleanup on launch and close.
- GitHub support link opens in the user's default browser.

### Download

Use the Android APK from the GitHub Release assets:

- `Itera.apk`

### Product Principle

One launch = one disposable identity. All mobile tabs live inside that one identity. Close Itera and the whole identity dies.

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
