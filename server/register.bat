@echo off
set "CURRENT_DIR=%~dp0"
set "LAUNCHER=%CURRENT_DIR%seraphim-launcher.bat"
set "STOPPER=%CURRENT_DIR%seraphim-stop.bat"

echo Registering protocol handler: %LAUNCHER%

reg add "HKCU\Software\Classes\seraphim" /ve /t REG_SZ /d "URL:Seraphim Protocol" /f
reg add "HKCU\Software\Classes\seraphim" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\seraphim\shell\open\command" /ve /t REG_SZ /d "\"%LAUNCHER%\" \"%%1\"" /f

reg add "HKCU\Software\Classes\seraphim-stop" /ve /t REG_SZ /d "URL:Seraphim Stop Protocol" /f
reg add "HKCU\Software\Classes\seraphim-stop" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\seraphim-stop\shell\open\command" /ve /t REG_SZ /d "\"%STOPPER%\" \"%%1\"" /f

echo Protocols 'seraphim://' and 'seraphim-stop://' successfully registered.
