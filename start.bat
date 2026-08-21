@echo off
setlocal

rem TarotNAI launcher. Run from anywhere - it locates the project itself.
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js is not on your PATH.
    echo     Install Node 22 or newer from https://nodejs.org
    goto :fail
)

for /f "tokens=1 delims=." %%v in ('node -e "process.stdout.write(process.versions.node)"') do set MAJOR=%%v
if %MAJOR% LSS 22 (
    echo [X] Node %MAJOR% is too old - this needs Node 22 or newer.
    goto :fail
)

if not exist "node_modules\" (
    echo [*] Installing dependencies...
    call npm install
    if errorlevel 1 goto :fail
)

if not exist ".env" (
    if exist ".env.example" (
        echo [!] No .env yet - creating one from .env.example.
        echo     Add your NovelAI key to it, then restart.
        copy /y ".env.example" ".env" >nul
        echo.
    )
)

echo [*] Starting TarotNAI...
echo     Press Ctrl+C to stop.
echo.

call npm start
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
    echo.
    echo [X] Server exited with code %EXITCODE%.
    goto :fail
)

endlocal
exit /b 0

:fail
echo.
pause
exit /b 1
