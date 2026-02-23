@echo off
:kioskloop
taskkill /f /im explorer.exe >nul 2>&1

start /wait "" "%~dp0kiosk_lock.exe"

if %errorlevel% equ 0 (
    start explorer.exe
    exit
)

goto kioskloop
