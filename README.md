# Kiosk Lock Project

## Structure

kiosk_lock/
- src/login_ui/auth_login.py
- src/login_ui/admin_api.py
- src/monitor/reader.py
- scripts/kiosk_lock.ps1
- scripts/setup_kiosk_task.ps1
- scripts/build_installer.ps1
- installer/KioskLockInstaller.iss
- assets/icon.ico
- logs/kiosk.log
- build/
- dist/

## Notes

- `scripts/kiosk_lock.ps1` now uses project-relative paths.
- `scripts/setup_kiosk_task.ps1` uses `kiosk_lock.exe` (and supports legacy `dist/kiosk_lock.exe`).
- Logs are written to `C:\ProgramData\KioskLock\logs\kiosk.log`.

## Build Installer (Windows)

1. Build `dist\kiosk_lock.exe` first.
2. Install Inno Setup 6.
3. Run:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\build_installer.ps1`
4. Output setup file:
   - `dist_installer\KioskLockSetup.exe`

## Installer Behavior

- Uses admin permissions.
- Installs to `Program Files\Kiosk Lock` by default.
- Creates Start Menu shortcuts.
- Optional desktop icon.
- Runs `scripts\setup_kiosk_task.ps1` after install, so kiosk starts at logon and session unlock.

## Admin Panel Commandes
 ### Backend Run Commandes
  - python app.py
 ### Frontend Run Commandes
  - npm run dev
   