# ================= SETTINGS =================
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -AssemblyName PresentationFramework

try {
# ================= CONFIG =================
function Resolve-ScriptRoot {
    if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
        return $PSScriptRoot
    }
    try {
        $processPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
        if ($processPath -and $processPath.Trim().Length -gt 0) {
            return (Split-Path -Parent $processPath)
        }
    }
    catch {}

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

$SCRIPT_ROOT = Resolve-ScriptRoot
function Resolve-ProjectRoot($scriptRoot) {
    if (-not [string]::IsNullOrWhiteSpace($scriptRoot)) {
        if (Test-Path (Join-Path $scriptRoot "src")) {
            return $scriptRoot
        }

        $parent = Split-Path -Parent $scriptRoot
        if (-not [string]::IsNullOrWhiteSpace($parent) -and (Test-Path (Join-Path $parent "src"))) {
            return $parent
        }
    }

    return $scriptRoot
}

$PROJECT_ROOT = Resolve-ProjectRoot $SCRIPT_ROOT
$PYTHON_SCRIPT = Join-Path $PROJECT_ROOT "src\monitor\reader.py"
$READER_EXE_PRIMARY = Join-Path $PROJECT_ROOT "src\monitor\dist\reader.exe"
$READER_EXE_LEGACY = Join-Path $PROJECT_ROOT "dist\reader.exe"
$PYTHON_DIR = Split-Path $PYTHON_SCRIPT
$PYTHON_EXE = $null
$AUTH_SCRIPT = $null
$script:LastAuthMessage = ""

function Resolve-AuthScriptPath {
    $candidates = @()

    if (-not [string]::IsNullOrWhiteSpace($env:KIOSK_AUTH_SCRIPT)) {
        $candidates += $env:KIOSK_AUTH_SCRIPT
    }

    $baseDirs = @($PROJECT_ROOT, $SCRIPT_ROOT)
    foreach ($baseDir in $baseDirs) {
        if ([string]::IsNullOrWhiteSpace($baseDir)) {
            continue
        }

        $candidates += (Join-Path $baseDir "src\login_ui\dist\auth_login.exe")
        $candidates += (Join-Path $baseDir "login_ui\dist\auth_login.exe")
        $candidates += (Join-Path $baseDir "dist\auth_login.exe")
        $candidates += (Join-Path $baseDir "auth_login.exe")
        $candidates += (Join-Path $baseDir "src\login_ui\auth_login.py")
        $candidates += (Join-Path $baseDir "login_ui\auth_login.py")
        $candidates += (Join-Path $baseDir "auth_login.py")
    }

    if ($PSCommandPath -and $PSCommandPath.Trim().Length -gt 0) {
        $commandDir = Split-Path -Parent $PSCommandPath
        if (-not [string]::IsNullOrWhiteSpace($commandDir)) {
            $candidates += (Join-Path $commandDir "src\login_ui\dist\auth_login.exe")
            $candidates += (Join-Path $commandDir "src\login_ui\auth_login.py")
        }
    }

    $uniqueCandidates = $candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    foreach ($candidate in $uniqueCandidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

# ================= DATABASE CONFIG =================
$DB_HOST = if ($env:KIOSK_DB_HOST) { $env:KIOSK_DB_HOST } else { "astraval.com" }
$DB_PORT = if ($env:KIOSK_DB_PORT) { $env:KIOSK_DB_PORT } else { "5432" }
$DB_USER = if ($env:KIOSK_DB_USER) { $env:KIOSK_DB_USER } else { "postgres" }
$DB_PASSWORD = if ($env:KIOSK_DB_PASSWORD) { $env:KIOSK_DB_PASSWORD } else { "root@IET25" }
$DB_NAME = if ($env:KIOSK_DB_NAME) { $env:KIOSK_DB_NAME } else { "EmpMan" }

function Export-DbEnvironment {
    $env:KIOSK_DB_HOST = $DB_HOST
    $env:KIOSK_DB_PORT = $DB_PORT
    $env:KIOSK_DB_USER = $DB_USER
    $env:KIOSK_DB_PASSWORD = $DB_PASSWORD
    $env:KIOSK_DB_NAME = $DB_NAME
}

# ================= LOGGING =================
$localLowRoot = if ($env:USERPROFILE -and $env:USERPROFILE.Trim().Length -gt 0) {
    Join-Path $env:USERPROFILE "AppData\LocalLow\Microsoft\KioskLock"
}
else {
    "C:\Users\Public\AppData\LocalLow\Microsoft\KioskLock"
}
$LOG_DIR = Join-Path $localLowRoot "logs"
if (-not (Test-Path $LOG_DIR)) {
    New-Item -Path $LOG_DIR -ItemType Directory -Force | Out-Null
}
$LOG_PATH = Join-Path $LOG_DIR "kiosk.log"

function Write-Log($text) {
    try {
        $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        "$ts $text" | Add-Content -Path $LOG_PATH
    }
    catch {}
}

function Invoke-HiddenProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @()
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $FilePath
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $escapedArgs = @()
    foreach ($argument in $Arguments) {
        $argText = if ($null -eq $argument) { "" } else { [string]$argument }
        $argText = $argText -replace '(\\*)"', '$1$1\"'
        if ($argText -match '\s|\"') {
            $argText = '"' + ($argText -replace '(\\+)$', '$1$1') + '"'
        }
        $escapedArgs += $argText
    }
    $startInfo.Arguments = ($escapedArgs -join " ")

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    [void]$process.Start()

    $stdOut = $process.StandardOutput.ReadToEnd()
    $stdErr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Output = (($stdOut + "`n" + $stdErr).Trim())
    }
}

function Get-PythonExecutable {
    function Test-PythonCandidate([string]$exePath) {
        if ([string]::IsNullOrWhiteSpace($exePath)) {
            return $false
        }

        if (-not (Test-Path $exePath)) {
            return $false
        }

        # Ignore App Execution Alias stubs that redirect to Microsoft Store.
        if ($exePath -match "(?i)\\WindowsApps\\(python|py)(\.exe)?$") {
            return $false
        }

        try {
            $versionOut = & $exePath --version 2>&1
            $exitCode = $LASTEXITCODE
            $versionText = if ($versionOut) { ($versionOut | Out-String).Trim() } else { "" }
            if ($exitCode -ne 0) {
                return $false
            }
            if ($versionText -match "(?i)microsoft store|windows store|install.*store") {
                return $false
            }
            if ($versionText -match "(?i)^python\s+\d") {
                return $true
            }
        }
        catch {}

        return $false
    }

    $candidates = @("python", "py")
    foreach ($candidate in $candidates) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) {
            if ($cmd -is [System.Management.Automation.ApplicationInfo] -and
                -not [string]::IsNullOrWhiteSpace($cmd.Path) -and
                (Test-PythonCandidate $cmd.Path)) {
                return $cmd.Path
            }

            if (-not [string]::IsNullOrWhiteSpace($cmd.Source) -and (Test-PythonCandidate $cmd.Source)) {
                return $cmd.Source
            }

            if (-not [string]::IsNullOrWhiteSpace($cmd.Definition) -and (Test-PythonCandidate $cmd.Definition)) {
                return $cmd.Definition
            }
        }
    }

    $knownInstallPaths = @(
        "$env:LocalAppData\Programs\Python\Python313\python.exe",
        "$env:LocalAppData\Programs\Python\Python312\python.exe",
        "$env:LocalAppData\Programs\Python\Python311\python.exe",
        "$env:ProgramFiles\Python313\python.exe",
        "$env:ProgramFiles\Python312\python.exe",
        "$env:ProgramFiles\Python311\python.exe"
    )

    foreach ($candidatePath in $knownInstallPaths) {
        if (Test-PythonCandidate $candidatePath) {
            return $candidatePath
        }
    }

    return $null
}

function Ensure-PythonDependency {
    param(
        [Parameter(Mandatory = $true)][string]$ModuleName,
        [Parameter(Mandatory = $true)][string]$PackageName
    )

    if (-not $PYTHON_EXE) {
        return $false
    }

    try {
        & $PYTHON_EXE -c "import $ModuleName" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    catch {}

    Write-Log "Missing Python module '$ModuleName'. Attempting auto-install of '$PackageName'."

    try {
        & $PYTHON_EXE -m ensurepip --upgrade 2>&1 | Out-Null
    }
    catch {}

    try {
        $installOutput = & $PYTHON_EXE -m pip install --user --disable-pip-version-check $PackageName 2>&1
        $installExit = $LASTEXITCODE
        if ($installOutput) {
            Write-Log ("pip install output: " + (($installOutput | Out-String).Trim()))
        }
        if ($installExit -ne 0) {
            Write-Log "pip install failed for $PackageName (exit $installExit)."
            return $false
        }
    }
    catch {
        Write-Log ("pip install exception for {0}: {1}" -f $PackageName, $_.Exception.Message)
        return $false
    }

    try {
        & $PYTHON_EXE -c "import $ModuleName" 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    }
    catch {}

    return $false
}

$PYTHON_EXE = Get-PythonExecutable
if (-not $PYTHON_EXE) {
    Write-Log "Python runtime not found in PATH (tried: python, py)."
}
else {
    Export-DbEnvironment
    [void](Ensure-PythonDependency -ModuleName "psycopg2" -PackageName "psycopg2-binary")
}

$AUTH_SCRIPT = Resolve-AuthScriptPath
if (-not [string]::IsNullOrWhiteSpace($AUTH_SCRIPT)) {
    Write-Log "Auth script resolved: $AUTH_SCRIPT"
}
else {
    Write-Log "Auth script not found. Will use inline auth fallback."
}

# ================= DATABASE CHECK =================
function Test-DatabaseConnection {
    $script:LastAuthMessage = ""

    if (-not $PYTHON_EXE) {
        $script:LastAuthMessage = "Python runtime not found."
        Write-Log "DB check skipped: Python runtime unavailable."
        return $false
    }

    try {
        $dbCheckScript = 'import os, psycopg2; c=psycopg2.connect(host=os.getenv("KIOSK_DB_HOST"), port=os.getenv("KIOSK_DB_PORT"), user=os.getenv("KIOSK_DB_USER"), password=os.getenv("KIOSK_DB_PASSWORD"), dbname=os.getenv("KIOSK_DB_NAME")); c.close(); print("DB_OK")'
        $dbOutput = & $PYTHON_EXE -c $dbCheckScript 2>&1
        $exitCode = $LASTEXITCODE
        $dbText = ""
        $dbSummary = ""
        if ($dbOutput) {
            $dbText = ($dbOutput | Out-String).Trim()
            Write-Log ("DB check: " + $dbText)
            $dbLines = $dbText -split "(`r`n|`n|`r)" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
            $meaningful = $dbLines | Where-Object { $_ -notmatch "^Traceback" -and $_ -notmatch "^File\s" }
            if ($meaningful) {
                $dbSummary = $meaningful[-1]
            }
        }
        if ($exitCode -ne 0) {
            $detail = if ([string]::IsNullOrWhiteSpace($dbText)) { "" } else { $dbText.ToLowerInvariant() }
            if ($detail -match "password authentication failed") {
                $script:LastAuthMessage = "Database login failed (username/password)."
            }
            elseif ($detail -match "could not connect|connection refused|timeout|timed out|no route|network") {
                $script:LastAuthMessage = "Database server unreachable (network/port)."
            }
            elseif ($detail -match "could not translate host name|name or service not known|getaddrinfo") {
                $script:LastAuthMessage = "Database host name is invalid."
            }
            elseif ((-not [string]::IsNullOrWhiteSpace($dbSummary)) -and ($dbSummary -notmatch "(?i)^traceback")) {
                $script:LastAuthMessage = "Database error: $dbSummary"
            }
            else {
                $script:LastAuthMessage = "Database connection failed (runtime error)."
            }
        }
        return ($exitCode -eq 0)
    }
    catch {
        $errText = "$($_.Exception.Message)"
        $shortErr = if ([string]::IsNullOrWhiteSpace($errText)) {
            "Unknown runtime failure"
        }
        else {
            $errLines = $errText -split "(`r`n|`n|`r)" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
            $meaningfulErr = $errLines | Where-Object { $_ -notmatch "^Traceback" -and $_ -notmatch "^File\s" }
            if ($meaningfulErr) { $meaningfulErr[-1] } else { $errLines[0] }
        }

        Write-Log "DB check runtime error: $shortErr"

        if ($shortErr -match "(?i)^traceback") {
            $script:LastAuthMessage = "Database check failed (runtime error)."
        }
        elseif ($shortErr -match "No such file|cannot find|not recognized|python") {
            $script:LastAuthMessage = "Python runtime unavailable for DB check."
        }
        else {
            $script:LastAuthMessage = "Database check runtime error: $shortErr"
        }
        return $false
    }
}

# ================= PYTHON AUTH =================
function Test-Login($userInput, $passwordInput) {
    $script:LastAuthMessage = ""

    try {
        $exitCode = 1
        $authText = ""
        $inlineAuthScript = @'
import hashlib
import os
import sys
import psycopg2

username = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
password = sys.argv[2] if len(sys.argv) > 2 else ""
if not username or not password:
    print("AUTH_FAIL: missing username/password")
    raise SystemExit(1)

conn = psycopg2.connect(
    host=os.getenv("KIOSK_DB_HOST"),
    port=os.getenv("KIOSK_DB_PORT"),
    user=os.getenv("KIOSK_DB_USER"),
    password=os.getenv("KIOSK_DB_PASSWORD"),
    dbname=os.getenv("KIOSK_DB_NAME"),
)
try:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM users WHERE username = %s AND password_hash = %s LIMIT 1",
            (username, hashlib.sha256(password.encode("utf-8")).hexdigest()),
        )
        ok = cur.fetchone() is not None
    print("AUTH_OK" if ok else "AUTH_FAIL: invalid user credentials")
    raise SystemExit(0 if ok else 1)
finally:
    conn.close()
'@
        if ($AUTH_SCRIPT -and (Test-Path $AUTH_SCRIPT)) {
            $authExt = [System.IO.Path]::GetExtension($AUTH_SCRIPT)
            if ($authExt -ieq ".exe") {
                # Unlock should accept kiosk users only, not admin accounts.
                try {
                    $authResult = Invoke-HiddenProcess -FilePath $AUTH_SCRIPT -Arguments @("user-auth", $userInput, $passwordInput)
                    $exitCode = $authResult.ExitCode
                    $authText = $authResult.Output
                }
                catch {
                    Write-Log ("Auth exe launch error: " + $_.Exception.Message)
                    if ($PYTHON_EXE) {
                        Write-Log "Falling back to inline Python auth after exe launch failure."
                        $authOutput = & $PYTHON_EXE -c $inlineAuthScript $userInput $passwordInput 2>&1
                        $exitCode = $LASTEXITCODE
                        if ($authOutput) {
                            $authText = ($authOutput | Out-String).Trim()
                        }
                    }
                    else {
                        throw
                    }
                }
            }
            else {
                if (-not $PYTHON_EXE) {
                    $script:LastAuthMessage = "Python runtime not found."
                    Write-Log "Auth script requires Python but runtime unavailable."
                    return $false
                }
                $authOutput = & $PYTHON_EXE $AUTH_SCRIPT user-auth $userInput $passwordInput 2>&1
                $exitCode = $LASTEXITCODE
                if ($authOutput) {
                    $authText = ($authOutput | Out-String).Trim()
                }
            }
        }
        else {
            # Fallback: validate kiosk user directly from DB when auth_login.py is not deployed.
            if (-not $PYTHON_EXE) {
                $script:LastAuthMessage = "Authentication service unavailable."
                Write-Log "Auth fallback requires Python but runtime unavailable."
                return $false
            }
            $authOutput = & $PYTHON_EXE -c $inlineAuthScript $userInput $passwordInput 2>&1
            $exitCode = $LASTEXITCODE
            if ($authOutput) {
                $authText = ($authOutput | Out-String).Trim()
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($authText)) {
            Write-Log ("Auth script: " + $authText)
            if ($authText -match "database error") {
                $script:LastAuthMessage = "Database error during login."
            }
            elseif ($authText -match "(?i)missing username/password") {
                $script:LastAuthMessage = "Enter username and password."
            }
            elseif ($authText -match "(?i)AUTH_FAIL:\s*(.+)") {
                $script:LastAuthMessage = $matches[1].Trim()
            }
            elseif ($authText -match "(?i)is not recognized|cannot find|no such file|dll|traceback|exception") {
                $script:LastAuthMessage = "Authentication service unavailable."
            }
        }

        Write-Log ("Auth exit code: " + $exitCode)

        if (($exitCode -ne 0) -and [string]::IsNullOrWhiteSpace($script:LastAuthMessage)) {
            $script:LastAuthMessage = "Invalid credentials."
        }
        return ($exitCode -eq 0)
    }
    catch {
        $rawError = "$($_.Exception.Message)"
        Write-Log "Auth runtime exception: $rawError"

        if ($rawError -match '(?i)file\s+"<string>"\s*,?\s*line\s*\d+') {
            $script:LastAuthMessage = "Authentication runtime error on this PC (Python execution issue)."
        }
        elseif ($rawError -match "(?i)cannot find|not recognized|no such file") {
            $script:LastAuthMessage = "Authentication service file missing."
        }
        elseif ($rawError -match "(?i)0xc000007b|side-by-side|application was unable to start correctly|dll") {
            $script:LastAuthMessage = "Authentication service failed to start (runtime dependency missing)."
        }
        elseif (-not [string]::IsNullOrWhiteSpace($rawError)) {
            $script:LastAuthMessage = "Authentication error: $rawError"
        }
        else {
            $script:LastAuthMessage = "Authentication failed. Please try again."
        }
        return $false
    }
}

# ================= KEY BLOCKER =================
Add-Type @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class KeyboardBlocker {
    private static IntPtr _hookId = IntPtr.Zero;
    private static LowLevelKeyboardProc _proc = HookCallback;

    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int VK_TAB = 0x09;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12;

    private static HashSet<int> BlockedKeys = new HashSet<int>() {
        VK_TAB,
        VK_LWIN, VK_RWIN,
        0xA2, 0xA3, // left/right Ctrl
        0xA4, 0xA5, // left/right Alt
        0x70, 0x71, 0x72, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B // F1-F12
    };

    public static void Start() {
        if (_hookId != IntPtr.Zero) return;
        _hookId = SetHook(_proc);
    }

    public static void Stop() {
        if (_hookId == IntPtr.Zero) return;
        UnhookWindowsHookEx(_hookId);
        _hookId = IntPtr.Zero;
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN)) {
            int vkCode = Marshal.ReadInt32(lParam);

            bool ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
            bool altDown = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;

            if (BlockedKeys.Contains(vkCode) || ctrlDown || altDown) {
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);
}
"@

# ================= LOCK SYSTEM =================
function Lock-System {
    try {
        if (Get-Process explorer -ErrorAction SilentlyContinue) {
            Stop-Process -Name explorer -Force
            Write-Log "System locked"
        }
    }
    catch {}
}

function Unlock-System {
    Start-Process explorer.exe
    Write-Log "System unlocked"
}

function Start-ReaderProcess($username) {
    $readerExe = $null
    if (Test-Path $READER_EXE_PRIMARY) {
        $readerExe = $READER_EXE_PRIMARY
    }
    elseif (Test-Path $READER_EXE_LEGACY) {
        $readerExe = $READER_EXE_LEGACY
    }

    if ($readerExe) {
        Start-Process -FilePath $readerExe -ArgumentList @($username) -WorkingDirectory (Split-Path -Parent $readerExe)
        Write-Log "Reader started from exe: $readerExe"
        return
    }

    if ($PYTHON_EXE -and (Test-Path $PYTHON_SCRIPT)) {
        Start-Process -FilePath $PYTHON_EXE -ArgumentList @($PYTHON_SCRIPT, $username) -WorkingDirectory $PYTHON_DIR
        Write-Log "Reader started from python script: $PYTHON_SCRIPT"
        return
    }

    Write-Log "Reader start failed: no exe or python script available."
}

# ================= STA CHECK =================
if ([System.Threading.Thread]::CurrentThread.ApartmentState -ne "STA") {
    [System.Windows.MessageBox]::Show("Run with:`npowershell -STA -ExecutionPolicy Bypass -File `"$PSCommandPath`"")
    return
}

# ================= LOGIN UI =================
[xml]$xaml = @"
<Window xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
        Title='Kiosk Lock'
        WindowStyle='None'
        ResizeMode='NoResize'
        Topmost='True'
        WindowState='Maximized'
        Background='Black'
        ShowInTaskbar='False'>
    <Grid>
        <Border Width='400'
                Padding='20'
                CornerRadius='15'
                Background='#222222'
                HorizontalAlignment='Center'
                VerticalAlignment='Center'>
            <StackPanel>
                <TextBlock Text='SYSTEM LOCKED'
                           FontSize='32'
                           FontWeight='Bold'
                           Foreground='White'
                           HorizontalAlignment='Center'
                           Margin='0,0,0,25'/>
                <TextBlock Text='Username:' Foreground='Silver'/>
                <TextBox Name='userBox'
                         Width='300'
                         Height='40'
                         FontSize='18'
                         Background='#333333'
                         Foreground='White'/>
                <TextBlock Text='Password:' Foreground='Silver' Margin='0,10,0,0'/>
                <PasswordBox Name='passBox'
                             Width='300'
                             Height='40'
                             FontSize='18'
                             Background='#333333'
                             Foreground='White'/>
                <StackPanel Orientation='Horizontal'
                            HorizontalAlignment='Center'
                            Margin='0,20'>
                    <Button Name='loginBtn'
                            Content='UNLOCK'
                            Width='130'
                            Height='45'
                            Background='#28a745'
                            Foreground='White'/>
                    <Button Name='restartBtn'
                            Content='RESTART'
                            Width='130'
                            Height='45'
                            Margin='10,0,0,0'
                            Background='#dc3545'
                            Foreground='White'/>
                </StackPanel>
                <TextBlock Name='msg'
                           Foreground='#ff4444'
                           HorizontalAlignment='Center'/>
            </StackPanel>
        </Border>
    </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

$userBox = $window.FindName("userBox")
$passBox = $window.FindName("passBox")
$loginBtn = $window.FindName("loginBtn")
$restartBtn = $window.FindName("restartBtn")
$msg = $window.FindName("msg")

$window.Add_Deactivated({
        $window.Topmost = $true
        $window.Activate() | Out-Null
    })

$loginBtn.Add_Click({
        $username = $userBox.Text.Trim()
        $password = $passBox.Password

        if ([string]::IsNullOrWhiteSpace($username) -or [string]::IsNullOrWhiteSpace($password)) {
            $msg.Text = "Enter username and password"
            return
        }

        # Run DB check for diagnostics only; do not block a valid login on pre-check noise.
        if (-not (Test-DatabaseConnection)) {
            Write-Log ("Pre-check warning: " + $script:LastAuthMessage)
        }

        if (Test-Login $username $password) {
            Write-Log "User unlock success: $username"
            [KeyboardBlocker]::Stop()
            Unlock-System
            Start-ReaderProcess $username
            $window.Close()
        }
        else {
            if ([string]::IsNullOrWhiteSpace($script:LastAuthMessage)) {
                $msg.Text = "Invalid Credentials"
            }
            else {
                $msg.Text = $script:LastAuthMessage
            }
            $passBox.Clear()
        }
    })

$restartBtn.Add_Click({
        [KeyboardBlocker]::Stop()
        Start-Process powershell -ArgumentList "-STA -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        $window.Close()
    })

Lock-System
[KeyboardBlocker]::Start()

try {
    $window.ShowDialog() | Out-Null
}
finally {
    [KeyboardBlocker]::Stop()
}
}
catch {
    $fatalMessage = $_.Exception.Message
    if ([string]::IsNullOrWhiteSpace($fatalMessage)) {
        $fatalMessage = "Unknown startup error"
    }

    try {
        if (Get-Command Write-Log -ErrorAction SilentlyContinue) {
            Write-Log "Fatal error: $fatalMessage"
        }
        else {
            $fallbackLogRoot = if ($env:USERPROFILE -and $env:USERPROFILE.Trim().Length -gt 0) {
                Join-Path $env:USERPROFILE "AppData\LocalLow\Microsoft\KioskLock\logs"
            }
            else {
                "C:\Users\Public\AppData\LocalLow\Microsoft\KioskLock\logs"
            }
            if (-not (Test-Path $fallbackLogRoot)) {
                New-Item -Path $fallbackLogRoot -ItemType Directory -Force | Out-Null
            }
            $fallbackLogPath = Join-Path $fallbackLogRoot "kiosk.log"
            $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            "$ts Fatal error: $fatalMessage" | Add-Content -Path $fallbackLogPath
        }
    }
    catch {}

    [System.Windows.MessageBox]::Show(
        "Kiosk Lock failed to start.`n`nError: $fatalMessage`n`nCheck log: AppData\\LocalLow\\Microsoft\\KioskLock\\logs\\kiosk.log",
        "Kiosk Lock Error",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
}
