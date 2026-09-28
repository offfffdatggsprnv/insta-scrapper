@echo off
setlocal
echo ========================================================
echo     Removing InstaExtract from Windows Startup
echo ========================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_FOLDER%\InstaExtract.lnk"

if exist "%SHORTCUT%" (
    del /f /q "%SHORTCUT%"
    echo [SUCCESS] Removed InstaExtract from Windows Startup.
) else (
    echo [INFO] InstaExtract is not currently in your Startup folder.
)

echo.
pause
