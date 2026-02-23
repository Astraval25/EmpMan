param(
    [object]$PauseOnError = $true
)

# ================= AUTO CREATE KIOSK TASK =================
$ErrorActionPreference = "Stop"

$TaskName = "KioskAutoStart"

function Invoke-Schtasks {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $commandLine = ($Arguments | ForEach-Object {
            $arg = [string]$_
            if ($arg -match '[\s"]') {
                '"' + ($arg -replace '"', '\"') + '"'
            }
            else {
                $arg
            }
        }) -join " "

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "schtasks.exe"
    $psi.Arguments = $commandLine
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $stdOut = $proc.StandardOutput.ReadToEnd()
    $stdErr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode
    $output = ($stdOut + "`n" + $stdErr).Trim()

    return [pscustomobject]@{
        Output   = $output
        ExitCode = $exitCode
        Command  = "schtasks.exe $commandLine"
    }
}

function Convert-ToBool {
    param([object]$Value)
    $text = if ($null -eq $Value) { "" } else { $Value.ToString().Trim().ToLowerInvariant() }
    switch ($text) {
        "1" { return $true }
        "0" { return $false }
        "true" { return $true }
        "false" { return $false }
        "`$true" { return $true }
        "`$false" { return $false }
        default { return [bool]$Value }
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

function Resolve-TaskUserId {
    # Prefer explicit DOMAIN\USERNAME when available, otherwise fallback to the local username.
    $domain = if ($env:USERDOMAIN) { $env:USERDOMAIN.Trim() } else { "" }
    $user = if ($env:USERNAME) { $env:USERNAME.Trim() } else { "" }

    if ($domain.Length -gt 0 -and $user.Length -gt 0) {
        return "$domain\$user"
    }
    if ($user.Length -gt 0) {
        return $user
    }

    try {
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
        if ($identity -and $identity.Name -and $identity.Name.Trim().Length -gt 0) {
            return $identity.Name.Trim()
        }
    }
    catch {}

    return "SYSTEM"
}

function Resolve-TaskPrincipalId {
    # SID is more portable across domain/local naming differences on other systems.
    try {
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
        if ($identity -and $identity.User -and $identity.User.Value -and $identity.User.Value.Trim().Length -gt 0) {
            return $identity.User.Value.Trim()
        }
    }
    catch {}

    return Resolve-TaskUserId
}

function Write-TaskLog {
    param([string]$Message)
    try {
        $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        "$ts $Message" | Add-Content -Path $script:TaskLogPath
    }
    catch {}
}

function Handle-FatalError {
    param([string]$Message)
    Write-Error $Message
    Write-TaskLog ("ERROR: " + $Message)
    if ($script:PauseOnErrorEnabled -and $Host.Name -eq "ConsoleHost") {
        Write-Host ""
        Write-Host "Press Enter to close..." -ForegroundColor Yellow
        [void](Read-Host)
    }
    exit 1
}

try {
    $script:PauseOnErrorEnabled = Convert-ToBool $PauseOnError
    $SCRIPT_ROOT = Resolve-ScriptRoot
    $PROJECT_ROOT = Split-Path -Parent $SCRIPT_ROOT
    $exeCandidates = @(
        (Join-Path $PROJECT_ROOT "RunKiosk.bat"),
        (Join-Path $PROJECT_ROOT "dist\RunKiosk.bat"),
        (Join-Path $PROJECT_ROOT "kiosk_lock.exe"),
        (Join-Path $PROJECT_ROOT "dist\kiosk_lock.exe")
    )
    $ExePath = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    $CurrentUser = Resolve-TaskUserId
    $TaskPrincipalId = Resolve-TaskPrincipalId
    $safeUserSource = if ($env:USERNAME -and $env:USERNAME.Trim().Length -gt 0) {
        $env:USERNAME.Trim()
    }
    else {
        $CurrentUser
    }
    $SafeUserName = ($safeUserSource -replace '[^A-Za-z0-9_-]', '_').Trim('_')
    if (-not $SafeUserName) {
        $SafeUserName = "User"
    }
    $TaskName = "KioskAutoStart_{0}" -f $SafeUserName
    $taskDataRoot = if ($env:USERPROFILE -and $env:USERPROFILE.Trim().Length -gt 0) {
        Join-Path $env:USERPROFILE "AppData\LocalLow\Microsoft\KioskLock"
    }
    else {
        "C:\Users\Public\AppData\LocalLow\Microsoft\KioskLock"
    }

    if (-not (Test-Path $taskDataRoot)) {
        New-Item -Path $taskDataRoot -ItemType Directory -Force | Out-Null
    }
    $script:TaskLogPath = Join-Path $taskDataRoot "setup_kiosk_task.log"
    Write-TaskLog "Task setup started."

    if (-not $ExePath) {
        $candidateList = $exeCandidates -join ", "
        Handle-FatalError ("kiosk executable not found. Checked: {0}" -f $candidateList)
    }
    $ExeWorkingDir = Split-Path -Parent $ExePath

    # Delete old tasks (best-effort only).
    $taskNamesToDelete = @($TaskName, "KioskAutoStart") | Select-Object -Unique
    foreach ($taskToDelete in $taskNamesToDelete) {
        $deleteResult = Invoke-Schtasks -Arguments @("/Delete", "/TN", $taskToDelete, "/F")
        if ($deleteResult.ExitCode -ne 0) {
            $deleteText = if ($deleteResult.Output) { ($deleteResult.Output | Out-String).Trim() } else { "" }
            if ($deleteText -and $deleteText -notmatch "(?i)cannot find|not found") {
                Write-Warning ("Could not delete existing task '{0}': {1}" -f $taskToDelete, $deleteText)
                Write-TaskLog ("Delete warning ({0}): {1}" -f $taskToDelete, $deleteText)
            }
        }
    }

    # Create XML definition (primary)
    $xmlPrimary = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$CurrentUser</UserId>
    </LogonTrigger>
    <SessionStateChangeTrigger>
      <Enabled>true</Enabled>
      <StateChange>SessionUnlock</StateChange>
    </SessionStateChangeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$TaskPrincipalId</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>StopExisting</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$ExePath</Command>
      <WorkingDirectory>$ExeWorkingDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

    $xmlPath = Join-Path $taskDataRoot "kiosk_task.xml"
    $xmlPrimary | Out-File -Encoding Unicode $xmlPath

    # Register task using XML
    $createResult = Invoke-Schtasks -Arguments @("/Create", "/TN", $TaskName, "/XML", $xmlPath, "/F")
    if ($createResult.ExitCode -ne 0) {
        $createTextPrimary = if ($createResult.Output) { ($createResult.Output | Out-String).Trim() } else { "Unknown schtasks error." }

        # Compatibility fallback for systems that reject Task version 1.4.
        $xmlCompat = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$CurrentUser</UserId>
    </LogonTrigger>
    <SessionStateChangeTrigger>
      <Enabled>true</Enabled>
      <StateChange>SessionUnlock</StateChange>
    </SessionStateChangeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$TaskPrincipalId</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>StopExisting</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$ExePath</Command>
      <WorkingDirectory>$ExeWorkingDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@
        $xmlCompat | Out-File -Encoding Unicode $xmlPath
        $createResult = Invoke-Schtasks -Arguments @("/Create", "/TN", $TaskName, "/XML", $xmlPath, "/F")

        if ($createResult.ExitCode -ne 0) {
            $createText = if ($createResult.Output) { ($createResult.Output | Out-String).Trim() } else { "Unknown schtasks error." }
            if ($createText -match "(?i)access is denied") {
                Handle-FatalError ("Failed to create scheduled task '{0}' due to permission. Try running PowerShell as Administrator once, then run this script again. Details: {1}" -f $TaskName, $createText)
            }
            Handle-FatalError ("Failed to create scheduled task '{0}'. Primary error: {1}. Fallback error: {2}" -f $TaskName, $createTextPrimary, $createText)
        }
    }

    $queryResult = Invoke-Schtasks -Arguments @("/Query", "/TN", $TaskName)
    if ($queryResult.ExitCode -ne 0) {
        $queryText = if ($queryResult.Output) { ($queryResult.Output | Out-String).Trim() } else { "Task not queryable." }
        Handle-FatalError ("Task '{0}' was not found after creation. Command: {1}. Details: {2}" -f $TaskName, $queryResult.Command, $queryText)
    }

    Write-Host "Kiosk Auto Start Task Created Successfully for user: $CurrentUser"
    Write-Host "Task Name: $TaskName"
    Write-Host "Task XML stored at: $xmlPath"
    Write-Host "It will run at user logon and session unlock."
    Write-TaskLog "Task setup completed successfully."
}
catch {
    Handle-FatalError $_.Exception.Message
}
