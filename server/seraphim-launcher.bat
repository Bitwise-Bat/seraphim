@echo off
cd /d "%~dp0"

set "RAW=%~1"

:: Check if stop command was requested
if "%RAW%"=="seraphim://stop" goto :stop
if "%RAW%"=="seraphim://stop/" goto :stop
if "%RAW%"=="stop" goto :stop

goto :launch

:stop
call "%~dp0seraphim-stop.bat"
exit /b

:launch
title Seraphim Server
set "PROJECT_PATH=%RAW:seraphim://=%"
set "PROJECT_PATH=%PROJECT_PATH:/=\%"

if "%PROJECT_PATH:~-1%"=="\" set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

if not exist "%PROJECT_PATH%" (
    if exist "%USERPROFILE%\Documents\%PROJECT_PATH%" (
        set "PROJECT_PATH=%USERPROFILE%\Documents\%PROJECT_PATH%"
    )
)

echo Starting Seraphim server for: "%PROJECT_PATH%"
npm start -- "%PROJECT_PATH%"
pause
