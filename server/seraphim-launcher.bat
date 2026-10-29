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
node "%~dp0launch.js" %*
if errorlevel 1 pause
