@echo off
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Terminal Server Client\Default" /f >nul 2>&1
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Terminal Server Client\Servers" /f >nul 2>&1
del "%USERPROFILE%\Documents\*.rdp" /q >nul 2>&1
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\RecentDocs\.rdp" /f >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Recent\AutomaticDestinations\*" /q >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Recent\CustomDestinations\*" /q >nul 2>&1
