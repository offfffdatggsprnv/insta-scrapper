@echo off
title InstaExtract Server
echo ========================================================
echo       Starting InstaExtract Server (localhost:3000)
echo ========================================================
echo.

cd /d "%~dp0"

:: Start the server in the background or minimized
start /b node server.js

:: Wait 2 seconds for server to initialize
timeout /t 2 /nobreak >nul

:: Automatically open default web browser to the app
start http://localhost:3000

echo.
echo InstaExtract is running at http://localhost:3000
echo You can minimize this window. Close it to stop the server.
echo.
pause
