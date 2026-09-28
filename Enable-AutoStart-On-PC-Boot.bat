@echo off
setlocal
echo ========================================================
echo     Configuring InstaExtract to Run on Windows Boot
echo ========================================================
echo.

set "SCRIPT_PATH=%~dp0Run-Silent.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_FOLDER%\InstaExtract.lnk"

:: Use PowerShell to create shortcut in Startup folder
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%SCRIPT_PATH%\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

if exist "%SHORTCUT%" (
    echo [SUCCESS] InstaExtract has been added to your Windows Startup!
    echo It will now run automatically in the background every time you turn on your PC.
) else (
    echo [ERROR] Failed to add shortcut.
)

echo.
pause
