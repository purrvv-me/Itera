import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import winreg
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from tkinter import Tk, messagebox


APP_NAME = "Itera"
PROFILE_PREFIX = "itera-profile-"
RUNTIME_DIR = Path("runtime") / "firefox-esr"
HOME_PAGE = Path("app") / "home.html"

USER_JS = """\
user_pref("browser.privatebrowsing.autostart", true);
user_pref("privacy.resistFingerprinting", true);
user_pref("media.peerconnection.enabled", false);

user_pref("browser.cache.disk.enable", false);
user_pref("browser.cache.memory.enable", true);

user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("places.history.enabled", false);

user_pref("signon.rememberSignons", false);
user_pref("browser.formfill.enable", false);

user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.unified", false);

user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);

user_pref("app.shield.optoutstudies.enabled", false);
user_pref("extensions.pocket.enabled", false);

user_pref("dom.security.https_only_mode", true);

user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.newtabpage.enabled", false);
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
"""


@dataclass(frozen=True)
class RuntimeConfig:
    firefox_path: str
    start_url: str


def main() -> int:
    remove_debug_log_if_disabled()
    log_event("Itera starting")
    cleanup_abandoned_profiles()

    config = create_runtime_config()
    if not config:
        show_error(
            "Firefox ESR runtime was not found.\n\n"
            "For the packaged app, place Firefox ESR at:\n"
            "runtime\\firefox-esr\\firefox.exe\n\n"
            "For development, set ITERA_FIREFOX_PATH to firefox.exe."
        )
        return 1

    profile_dir = create_profile()
    try:
        log_event(f"Session born: {profile_dir}")
        exit_code = run_browser_session(config, profile_dir)
        log_event(f"Browser runtime exited: {exit_code}")
        return exit_code
    except Exception as exc:
        log_event(f"Browser runtime launch failed: {exc}")
        show_error(f"Could not start Itera's browser runtime:\n\n{exc}")
        return 1
    finally:
        if not destroy_profile(profile_dir):
            log_event(f"Session destruction deferred: {profile_dir}")
        else:
            log_event("Session destroyed")
        remove_empty_session_base()


def run_browser_session(config: RuntimeConfig, profile_dir: Path) -> int:
    process = subprocess.Popen(
        [
            config.firefox_path,
            "-no-remote",
            "-new-instance",
            "-profile",
            str(profile_dir),
            config.start_url,
        ]
    )
    return process.wait()


def create_profile() -> Path:
    base_dir = session_base_dir()
    base_dir.mkdir(parents=True, exist_ok=True)
    profile_dir = base_dir / f"{PROFILE_PREFIX}{uuid.uuid4().hex}"
    profile_dir.mkdir()
    (profile_dir / "user.js").write_text(USER_JS, encoding="utf-8", newline="\n")
    return profile_dir


def cleanup_abandoned_profiles() -> None:
    base_dir = session_base_dir()
    if not base_dir.exists():
        return

    for child in base_dir.iterdir():
        if child.is_dir() and child.name.startswith(PROFILE_PREFIX):
            if destroy_profile(child):
                log_event(f"Abandoned session destroyed: {child}")
            else:
                log_event(f"Abandoned session still locked: {child}")
    remove_empty_session_base()


def destroy_profile(profile_dir: Path | None) -> bool:
    if not profile_dir or not profile_dir.exists():
        return True

    for _ in range(24):
        try:
            shutil.rmtree(profile_dir)
            return True
        except PermissionError:
            time.sleep(0.25)
        except FileNotFoundError:
            return True
        except OSError:
            time.sleep(0.25)
    return False


def session_base_dir() -> Path:
    return Path(tempfile.gettempdir()) / APP_NAME


def log_path() -> Path:
    base_dir = session_base_dir()
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / "itera.log"


def log_event(message: str) -> None:
    if os.environ.get("ITERA_DEBUG_LOG") != "1":
        return
    try:
        timestamp = datetime.now().isoformat(timespec="seconds")
        with log_path().open("a", encoding="utf-8") as log_file:
            log_file.write(f"{timestamp} {message}\n")
    except OSError:
        pass


def remove_empty_session_base() -> None:
    base_dir = session_base_dir()
    try:
        base_dir.rmdir()
    except OSError:
        pass


def remove_debug_log_if_disabled() -> None:
    if os.environ.get("ITERA_DEBUG_LOG") == "1":
        return
    try:
        log_path().unlink(missing_ok=True)
    except OSError:
        pass


def app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def create_runtime_config() -> RuntimeConfig | None:
    firefox_path = find_firefox()
    if not firefox_path:
        return None
    return RuntimeConfig(firefox_path=firefox_path, start_url=start_url())


def start_url() -> str:
    home_path = app_dir() / HOME_PAGE
    if home_path.exists():
        return home_path.resolve().as_uri()
    return "about:blank"


def find_firefox() -> str | None:
    env_path = os.environ.get("ITERA_FIREFOX_PATH")
    if env_path and Path(env_path).exists():
        return env_path

    root = app_dir()
    candidates = [
        root / RUNTIME_DIR / "firefox.exe",
        root / "runtime" / "firefox" / "firefox.exe",
        root / "firefox-esr" / "firefox.exe",
        root / "firefox" / "firefox.exe",
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Mozilla Firefox ESR" / "firefox.exe",
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Mozilla Firefox" / "firefox.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Mozilla Firefox ESR" / "firefox.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Mozilla Firefox" / "firefox.exe",
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    registry_path = read_firefox_app_path()
    if registry_path:
        return registry_path

    return shutil.which("firefox.exe") or shutil.which("firefox")


def read_firefox_app_path() -> str | None:
    keys = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe"),
    ]
    for hive, key_path in keys:
        try:
            with winreg.OpenKey(hive, key_path) as key:
                value, _ = winreg.QueryValueEx(key, None)
                if value and Path(value).exists():
                    return value
        except OSError:
            continue
    return None


def show_error(message: str) -> None:
    root = Tk()
    root.withdraw()
    messagebox.showerror(APP_NAME, message)
    root.destroy()


if __name__ == "__main__":
    raise SystemExit(main())
