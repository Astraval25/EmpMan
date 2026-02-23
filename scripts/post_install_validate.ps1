param(
    [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = "Stop"

function Fail {
    param([string]$Message)
    Write-Host "VALIDATION_FAILED: $Message" -ForegroundColor Red
    exit 1
}

function Assert-PathExists {
    param(
        [string]$PathToCheck,
        [string]$Label
    )
    if (-not (Test-Path $PathToCheck)) {
        Fail "Missing $Label at $PathToCheck"
    }
}

# 1. Basic Directory Check
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    Fail "InstallDir is empty."
}

# 2. Define File Paths
$mainExeCandidates = @(
    (Join-Path $InstallDir "kiosk_lock.exe"),
    (Join-Path $InstallDir "KioskLock.exe"),
    (Join-Path $InstallDir "dist\kiosk_lock.exe"),
    (Join-Path $InstallDir "dist\KioskLock.exe")
)
$runBatCandidates = @(
    (Join-Path $InstallDir "RunKiosk.bat"),
    (Join-Path $InstallDir "dist\RunKiosk.bat")
)
$mainExe = $mainExeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$runBat = $runBatCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

# 3. File Verifications
if (-not $mainExe) {
    Fail ("Missing Main Executable. Checked: {0}" -f ($mainExeCandidates -join ", "))
}
if (-not $runBat) {
    Fail ("Missing Continuous Loop Batch. Checked: {0}" -f ($runBatCandidates -join ", "))
}

# 4. Registry Shell info (read-only check)
Write-Host "Shell registry value (info):" -ForegroundColor Cyan
$shellInfo = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name "Shell" -ErrorAction SilentlyContinue
if ($null -ne $shellInfo) {
    Write-Host ("  Shell = {0}" -f $shellInfo.Shell)
}
else {
    Write-Host "  Shell value not found."
}

# 5. Scheduled Task check (required in Task Scheduler mode)
$task = Get-ScheduledTask -TaskName "KioskAutoStart*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $task) {
    Fail "Scheduled Task KioskAutoStart* not found."
}

Write-Host "VALIDATION_OK: Task Scheduler startup is configured." -ForegroundColor Green
exit 0
