param(
    [switch]$AutoInstallPrerequisites = $true,
    [switch]$PauseOnError = $true
)

$ErrorActionPreference = "Stop"

function Show-FatalErrorAndOptionallyPause {
    param([string]$Message)

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red

    if ($PauseOnError -and $Host.Name -eq "ConsoleHost") {
        Write-Host ""
        Write-Host "Press Enter to close..." -ForegroundColor Yellow
        [void](Read-Host)
    }
}

function Test-PythonInstalled {
    try {
        & py -3 --version *> $null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    catch { }

    try {
        & python --version *> $null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    catch { }

    return $false
}

function Install-Python {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Python not found and winget is unavailable. Install Python 3.12+ manually."
    }

    Write-Host "Installing Python using winget..."
    & winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0 -or -not (Test-PythonInstalled)) {
        throw "Python install failed. Install Python 3.12+ manually and rerun."
    }
}

function Get-ISCCPath {
    $fromPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    $candidates = @(
        "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
    )

    return ($candidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
}

function Install-InnoSetup {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Inno Setup not found and winget is unavailable. Install Inno Setup 6 manually."
    }

    Write-Host "Installing Inno Setup using winget..."
    & winget install -e --id JRSoftware.InnoSetup --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup install failed. Install Inno Setup 6 manually and rerun."
    }
}

function Resolve-ScriptRoot {
    if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
        return $PSScriptRoot
    }

    $scriptPath = $null
    if ($MyInvocation -and $MyInvocation.MyCommand) {
        $pathProperty = $MyInvocation.MyCommand.PSObject.Properties["Path"]
        if ($pathProperty) {
            $scriptPath = $pathProperty.Value
        }
    } 
    if ($scriptPath -and $scriptPath.Trim().Length -gt 0) {
        return (Split-Path -Parent $scriptPath)
    }

    return (Get-Location).Path
}

$scriptRoot = Resolve-ScriptRoot
$projectRoot = Split-Path -Parent $scriptRoot
$issPath = Join-Path $projectRoot "installer\KioskLockInstaller.iss"
$exePath = Join-Path $projectRoot "dist\kiosk_lock.exe"
$runKioskBatPath = Join-Path $projectRoot "dist\RunKiosk.bat"
$authExePath = Join-Path $projectRoot "src\login_ui\dist\auth_login.exe"
$authScriptPath = Join-Path $projectRoot "src\login_ui\auth_login.py"
$readerScriptPath = Join-Path $projectRoot "src\monitor\reader.py"
$readerExePath = Join-Path $projectRoot "src\monitor\dist\reader.exe"

if (-not (Test-Path $issPath)) {
    throw "Installer script not found: $issPath"
}

if (-not (Test-Path $exePath)) {
    throw "App executable not found: $exePath"
}

if (-not (Test-Path $runKioskBatPath)) {
    throw "RunKiosk.bat not found: $runKioskBatPath"
}

if (-not (Test-Path $authExePath)) {
    throw "Auth executable not found: $authExePath"
}

if (-not (Test-Path $authScriptPath)) {
    throw "Auth script not found: $authScriptPath"
}

if (-not (Test-Path $readerScriptPath)) {
    throw "Reader script not found: $readerScriptPath"
}

if (-not (Test-Path $readerExePath)) {
    throw "Reader executable not found: $readerExePath"
}

if (-not (Test-PythonInstalled)) {
    if ($AutoInstallPrerequisites) {
        Install-Python
    }
    else {
        throw "Python 3.12+ is required. Install Python and rerun."
    }
}

$iscc = Get-ISCCPath
if (-not $iscc) {
    if ($AutoInstallPrerequisites) {
        Install-InnoSetup
        $iscc = Get-ISCCPath
    }
}

if (-not $iscc) {
    throw "Inno Setup 6 not found. Install Inno Setup, then run this script again."
}

try {
    Push-Location $projectRoot
    try {
        $defaultOutputBase = "KioskLockSetup"
        $finalInstallerPath = Join-Path $projectRoot "dist_installer\$defaultOutputBase.exe"

        $compileOutput = & $iscc $issPath 2>&1
        $compileOutput | ForEach-Object { Write-Host $_ }
        $exitCode = $LASTEXITCODE

        if ($exitCode -ne 0) {
            $compileText = ($compileOutput | Out-String)

            if ($compileText -match "Error 32: The process cannot access the file because it is being used by another process") {
                $fallbackOutputBase = "KioskLockSetup_{0}" -f (Get-Date -Format "yyyyMMdd_HHmmss")
                Write-Host "Default installer filename is locked. Retrying with: $fallbackOutputBase.exe"

                $retryOutput = & $iscc "/F$fallbackOutputBase" $issPath 2>&1
                $retryOutput | ForEach-Object { Write-Host $_ }
                $retryExitCode = $LASTEXITCODE

                if ($retryExitCode -ne 0) {
                    throw "ISCC failed with exit code $retryExitCode."
                }

                $finalInstallerPath = Join-Path $projectRoot "dist_installer\$fallbackOutputBase.exe"
            }
            else {
                throw "ISCC failed with exit code $exitCode."
            }
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "Installer built successfully: $finalInstallerPath" -ForegroundColor Green
}
catch {
    Show-FatalErrorAndOptionallyPause -Message $_.Exception.Message
    exit 1
}
