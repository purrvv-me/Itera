# Itera Packaging

The target product shape is a portable Windows folder:

```text
Itera/
  Itera.exe
  app/
    home.html
    policies.json
  runtime/
    firefox-esr/
      firefox.exe
      distribution/
        policies.json
```

Build:

```powershell
python -m pip install -r requirements-build.txt
.\build.ps1
```

Before running `build.ps1`, place an unmodified Firefox ESR runtime at:

```text
runtime\firefox-esr\firefox.exe
```

You can prepare that runtime from Mozilla's current ESR installer with:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\fetch_firefox_esr_runtime.ps1
```

This helper requires `7z.exe` on `PATH`.

The build script copies that runtime into `dist\Itera\runtime\firefox-esr` and installs Firefox enterprise policies into the runtime's `distribution` folder.

For a public release, confirm Mozilla redistribution and trademark requirements before shipping a bundled runtime.

Optional installer:

1. Build the portable folder with `.\build.ps1`.
2. Open `packaging\Itera.iss` in Inno Setup.
3. Compile `IteraSetup.exe`.
