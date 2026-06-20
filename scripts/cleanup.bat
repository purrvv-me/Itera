@echo off
setlocal
title ITERA - Erasing your identity
color 0E
mode con: cols=88 lines=52

set "DATA=%~1"

echo.
echo    ITERA   -   Every launch begins again.
echo    ======================================================================
echo.
echo    Profile:  "%DATA%"
echo.
echo    Erasing every trace of this session from disk.
echo    Watch each command run - nothing is kept.
echo.
ping -n 3 127.0.0.1 >nul

echo    --- Cookies ^& login sessions -------------------------------------
echo       ^> del /f /q "%DATA%\Network\Cookies"
del /f /q "%DATA%\Network\Cookies" 2>nul
echo       ^> del /f /q "%DATA%\Network\Cookies-journal"
del /f /q "%DATA%\Network\Cookies-journal" 2>nul
echo       ^> del /f /q "%DATA%\Cookies"
del /f /q "%DATA%\Cookies" 2>nul
echo       ^> del /f /q "%DATA%\Cookies-journal"
del /f /q "%DATA%\Cookies-journal" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Caches  (disk, code, GPU, shader) ----------------------------
echo       ^> rmdir /s /q "%DATA%\Cache"
rmdir /s /q "%DATA%\Cache" 2>nul
echo       ^> rmdir /s /q "%DATA%\Code Cache"
rmdir /s /q "%DATA%\Code Cache" 2>nul
echo       ^> rmdir /s /q "%DATA%\GPUCache"
rmdir /s /q "%DATA%\GPUCache" 2>nul
echo       ^> rmdir /s /q "%DATA%\DawnCache"
rmdir /s /q "%DATA%\DawnCache" 2>nul
echo       ^> rmdir /s /q "%DATA%\DawnGraphiteCache"
rmdir /s /q "%DATA%\DawnGraphiteCache" 2>nul
echo       ^> rmdir /s /q "%DATA%\DawnWebGPUCache"
rmdir /s /q "%DATA%\DawnWebGPUCache" 2>nul
echo       ^> rmdir /s /q "%DATA%\ShaderCache"
rmdir /s /q "%DATA%\ShaderCache" 2>nul
echo       ^> rmdir /s /q "%DATA%\GrShaderCache"
rmdir /s /q "%DATA%\GrShaderCache" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Local storage, session storage, databases --------------------
echo       ^> rmdir /s /q "%DATA%\Local Storage"
rmdir /s /q "%DATA%\Local Storage" 2>nul
echo       ^> rmdir /s /q "%DATA%\Session Storage"
rmdir /s /q "%DATA%\Session Storage" 2>nul
echo       ^> rmdir /s /q "%DATA%\IndexedDB"
rmdir /s /q "%DATA%\IndexedDB" 2>nul
echo       ^> rmdir /s /q "%DATA%\databases"
rmdir /s /q "%DATA%\databases" 2>nul
echo       ^> rmdir /s /q "%DATA%\File System"
rmdir /s /q "%DATA%\File System" 2>nul
echo       ^> rmdir /s /q "%DATA%\WebStorage"
rmdir /s /q "%DATA%\WebStorage" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Service workers ^& background data ----------------------------
echo       ^> rmdir /s /q "%DATA%\Service Worker"
rmdir /s /q "%DATA%\Service Worker" 2>nul
echo       ^> rmdir /s /q "%DATA%\blob_storage"
rmdir /s /q "%DATA%\blob_storage" 2>nul
echo       ^> rmdir /s /q "%DATA%\shared_proto_db"
rmdir /s /q "%DATA%\shared_proto_db" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Fingerprint ^& network state ----------------------------------
echo       ^> del /f /q "%DATA%\Network\Network Persistent State"
del /f /q "%DATA%\Network\Network Persistent State" 2>nul
echo       ^> del /f /q "%DATA%\Network\TransportSecurity"
del /f /q "%DATA%\Network\TransportSecurity" 2>nul
echo       ^> rmdir /s /q "%DATA%\Network\Trust Tokens"
rmdir /s /q "%DATA%\Network\Trust Tokens" 2>nul
echo       ^> del /f /q "%DATA%\TransportSecurity"
del /f /q "%DATA%\TransportSecurity" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Preferences ^& saved sessions ---------------------------------
echo       ^> del /f /q "%DATA%\Preferences"
del /f /q "%DATA%\Preferences" 2>nul
echo       ^> del /f /q "%DATA%\Local State"
del /f /q "%DATA%\Local State" 2>nul
echo       ^> rmdir /s /q "%DATA%\Sessions"
rmdir /s /q "%DATA%\Sessions" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Every site partition  (this session's whole identity) --------
echo       ^> rmdir /s /q "%DATA%\Partitions"
rmdir /s /q "%DATA%\Partitions" 2>nul
ping -n 2 127.0.0.1 >nul

echo    --- Final sweep: the entire profile folder -----------------------
echo       ^> rmdir /s /q "%DATA%"
rmdir /s /q "%DATA%" 2>nul
if exist "%DATA%" ( echo        [!] locked - retrying & ping -n 3 127.0.0.1 >nul & rmdir /s /q "%DATA%" 2>nul )
if exist "%DATA%" ( echo        [!] locked - retrying & ping -n 3 127.0.0.1 >nul & rmdir /s /q "%DATA%" 2>nul )
if exist "%DATA%" ( echo        [!] locked - retrying & ping -n 4 127.0.0.1 >nul & rmdir /s /q "%DATA%" 2>nul )

echo.
echo    ======================================================================
if exist "%DATA%" (
  echo    [ WARN ]  A few files are still locked by Windows and will be
  echo              removed automatically on the next launch.
) else (
  echo    [ DONE ]  Cookies, cache, localStorage, sessionStorage, IndexedDB,
  echo              service workers and fingerprint data are permanently gone.
)
echo.
echo    You are no one again.
echo.
ping -n 6 127.0.0.1 >nul
exit
