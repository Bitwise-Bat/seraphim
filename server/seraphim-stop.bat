@echo off
title Stopping Seraphim Server

echo Stopping Seraphim Server...

:: 1. Terminate any process listening on port 9001 and its process tree
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":9001" ^| findstr "LISTENING"') do (
    echo Killing process on port 9001: PID %%a
    taskkill /F /T /PID %%a >nul 2>&1
)

:: 2. Terminate any window titled "Seraphim Server"
taskkill /FI "WINDOWTITLE eq Seraphim Server*" /T /F >nul 2>&1

echo Seraphim Server stopped.
