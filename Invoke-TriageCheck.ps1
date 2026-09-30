#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Read-only incident triage: can we build a storyline on this host, and from what?
.DESCRIPTION
    Built-in Windows tools only - no third-party binaries.
      1. Host context (role, last boot, time zone)
      2. Logging switches (audit policy summary, 4688 cmdline, script block logging)
      3. Event log coverage (size, full?, oldest/newest, days back)
      4. Log clear events (1102 / 104)
      5. Non-log evidence sources (Prefetch, Amcache, SRUM, VSS, PSReadLine, USN, Defender MPLog)
      6. EDR / log-shipping agents (is there telemetry off this box?)
    NOTE: Running this on a suspect host leaves its own footprint (4688, 4104, Prefetch).
    Record the time you ran it in your case notes.
.EXAMPLE
    .\Invoke-TriageCheck.ps1
    .\Invoke-TriageCheck.ps1 -OutputPath C:\IR\case01      # also saves a transcript
    Invoke-Command -ComputerName HOST01 -FilePath .\Invoke-TriageCheck.ps1
#>
param([string]$OutputPath)
$ErrorActionPreference = 'SilentlyContinue'

if ($OutputPath) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Start-Transcript -Path (Join-Path $OutputPath ('{0}_triage_{1:yyyyMMdd_HHmm}.txt' -f $env:COMPUTERNAME, (Get-Date))) | Out-Null
}

function H($t)   { Write-Host "`n[$t]" -ForegroundColor Cyan }
function Out-T($o) { Write-Host (($o | Format-Table -AutoSize -Wrap | Out-String).TrimEnd()) }
function R($p, $n) { $v = (Get-ItemProperty $p -Name $n).$n; if ($null -eq $v) { 'Not set' } else { $v } }
function D($dt)  { if ($dt) { $dt.ToString('yyyy-MM-dd HH:mm') } }

# ---------------- 1. Host context ----------------
$os   = Get-CimInstance Win32_OperatingSystem
$cs   = Get-CimInstance Win32_ComputerSystem
$role = @('Workstation', 'Workstation', 'Server', 'Server', 'DC', 'DC')[[int]$cs.DomainRole]
$tz   = Get-TimeZone

Write-Host "`n=== Triage: $env:COMPUTERNAME ===" -ForegroundColor Cyan
Write-Host "  OS         : $($os.Caption) (build $($os.BuildNumber)) - $role"
Write-Host "  Domain     : $($cs.Domain)"
Write-Host "  Last boot  : $(D $os.LastBootUpTime)   (memory/volatile evidence before this is gone)"
Write-Host "  Checked at : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')   TZ: $($tz.Id), UTC offset $($tz.BaseUtcOffset)"

# ---------------- 2. Logging switches ----------------
H 'Logging switches'
$ap  = auditpol /get /category:*
$on  = @($ap | Where-Object { $_ -match '\S\s{2,}(Success|Failure)' }).Count
$off = @($ap | Where-Object { $_ -match 'No Auditing' }).Count
Write-Host "  Audit subcategories on/off : $on / $off"
foreach ($s in 'Logon', 'Special Logon', 'Process Creation', 'Security System Extension', 'Other Object Access Events', 'Audit Policy Change') {
    $e = [regex]::Escape($s)
    $v = ($ap | Where-Object { $_ -match "^\s+$e\s{2,}" }) -replace "^\s+$e\s+", ''
    Write-Host ('    {0,-28} {1}' -f $s, $(if ($v) { $v } else { 'n/a' }))
}
Write-Host "  4688 command line          : $(R 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit' 'ProcessCreationIncludeCmdLine_Enabled')"
Write-Host "  Script block (WinPS)       : $(R 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging' 'EnableScriptBlockLogging')"
Write-Host "  Script block (pwsh 7)      : $(R 'HKLM:\SOFTWARE\Policies\Microsoft\PowerShellCore\ScriptBlockLogging' 'EnableScriptBlockLogging')"

# ---------------- 2b. Full audit policy ----------------
H 'Full audit policy (auditpol /get /category:*)'
$ap | ForEach-Object { Write-Host "  $_" }

# ---------------- 3. Event log coverage ----------------
H 'Event log coverage'
$Logs = @(
    'Security', 'System',
    'Windows PowerShell', 'Microsoft-Windows-PowerShell/Operational', 'PowerShellCore/Operational',
    'Microsoft-Windows-TaskScheduler/Operational',
    'Microsoft-Windows-TerminalServices-LocalSessionManager/Operational',
    'Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational',
    'Microsoft-Windows-WMI-Activity/Operational',
    'Microsoft-Windows-Windows Defender/Operational',
    'Microsoft-Windows-Sysmon/Operational'
)
$rows = foreach ($name in $Logs) {
    $l = Get-WinEvent -ListLog $name
    $old = $new = $null
    if ($l -and $l.RecordCount) {
        $old = Get-WinEvent -LogName $name -Oldest -MaxEvents 1
        $new = Get-WinEvent -LogName $name -MaxEvents 1
    }
    [pscustomobject]@{
        Log      = $name -replace '^Microsoft-Windows-', '' -replace 'TerminalServices-', 'TS-'
        Enabled  = if ($l) { $l.IsEnabled } else { 'MISSING' }
        MaxMB    = if ($l) { [math]::Round($l.MaximumSizeInBytes / 1MB) }
        UsedMB   = if ($l) { [math]::Round($l.FileSize / 1MB, 1) }
        Full     = if ($l -and $l.FileSize -ge 0.95 * $l.MaximumSizeInBytes) { 'YES' }
        Oldest   = D $(if ($old) { $old.TimeCreated })
        Newest   = D $(if ($new) { $new.TimeCreated })
        DaysBack = if ($old) { [math]::Round(((Get-Date) - $old.TimeCreated).TotalDays, 1) }
    }
}
Out-T $rows
Write-Host '  Full=YES means the log is rolling over: DaysBack is the hard evidence horizon for that log.' -ForegroundColor DarkGray

# ---------------- 4. Log clears ----------------
H 'Log clear events (1102 / 104)'
$clr = @(Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 1102 }) +
       @(Get-WinEvent -FilterHashtable @{ LogName = 'System';   Id = 104 })
if ($clr.Count) {
    Out-T ($clr | Sort-Object TimeCreated | ForEach-Object {
        $x  = [xml]$_.ToXml()
        $ch = $x.SelectSingleNode("//*[local-name()='UserData']//*[local-name()='Channel']")
        [pscustomobject]@{
            Time    = D $_.TimeCreated
            Id      = $_.Id
            Cleared = if ($ch) { $ch.InnerText } else { 'Security' }
            User    = $x.SelectSingleNode("//*[local-name()='SubjectUserName']").InnerText
        }
    })
    Write-Host '  Logs were cleared: check Volume Shadow Copies for older .evtx copies.' -ForegroundColor Yellow
}
else { Write-Host '  None found' }

# ---------------- 5. Non-log evidence sources ----------------
H 'Non-log evidence sources'
$art = @()

$pfMode = R 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' 'EnablePrefetcher'
$pf = @(Get-ChildItem "$env:SystemRoot\Prefetch\*.pf" -Force)
$art += [pscustomobject]@{ Source = 'Prefetch'; Present = ($pf.Count -gt 0)
    Detail = "EnablePrefetcher=$pfMode (0 = off, common on servers); $($pf.Count) files; oldest write $(D ($pf | Sort-Object LastWriteTime | Select-Object -First 1).LastWriteTime)" }

$am = Get-Item "$env:SystemRoot\AppCompat\Programs\Amcache.hve" -Force
$art += [pscustomobject]@{ Source = 'Amcache'; Present = [bool]$am; Detail = $(if ($am) { "last write $(D $am.LastWriteTime)" }) }

$sr = Get-Item "$env:SystemRoot\System32\sru\SRUDB.dat" -Force
$art += [pscustomobject]@{ Source = 'SRUM'; Present = [bool]$sr; Detail = $(if ($sr) { "$([math]::Round($sr.Length / 1MB)) MB; ~30-60 days of app/network usage" }) }

$vss = @(Get-CimInstance Win32_ShadowCopy | Sort-Object InstallDate)
$art += [pscustomobject]@{ Source = 'Volume Shadow Copies'; Present = ($vss.Count -gt 0)
    Detail = $(if ($vss.Count) { "$($vss.Count) copies; oldest $(D $vss[0].InstallDate), newest $(D $vss[-1].InstallDate)" } else { 'none (or deleted - check for vssadmin/wmic shadowcopy delete)' }) }

$hist = @(Get-ChildItem "$env:SystemDrive\Users\*\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt" -Force)
$art += [pscustomobject]@{ Source = 'PSReadLine history'; Present = ($hist.Count -gt 0)
    Detail = ($hist | ForEach-Object { '{0} ({1} KB, {2})' -f $_.FullName.Split('\')[2], [math]::Ceiling($_.Length / 1KB), $_.LastWriteTime.ToString('yyyy-MM-dd') }) -join ', ' }

$usn = fsutil usn queryjournal $env:SystemDrive
$art += [pscustomobject]@{ Source = "USN journal ($env:SystemDrive)"; Present = ($LASTEXITCODE -eq 0)
    Detail = (($usn | Select-String 'Maximum Size') -replace '\s+', ' ').Trim() }

$mp = @(Get-ChildItem "$env:ProgramData\Microsoft\Windows Defender\Support\MPLog-*.log" -Force)
$art += [pscustomobject]@{ Source = 'Defender MPLog'; Present = ($mp.Count -gt 0)
    Detail = $(if ($mp.Count) { "$($mp.Count) file(s); scans, detections and process activity outside evtx" }) }

Out-T $art

# ---------------- 6. Agents: is telemetry leaving this box? ----------------
H 'EDR / log-shipping agents'
$pat = 'Sentinel|CrowdStrike|Falcon|FortiEDR|Defender for Endpoint|Advanced Threat Protection|Carbon Black|Cortex|Cybereason|Sophos|Trend Micro|Elastic|Sysmon|Velociraptor|Wazuh|Splunk|NXLog|Winlogbeat|Qualys|Tanium|Rapid7'
$svc = Get-CimInstance Win32_Service |
    Where-Object { $_.DisplayName -match $pat -or $_.Name -match '^(Sense|Sysmon\d*)$' } |
    Select-Object Name, DisplayName, State, StartMode
if ($svc) { Out-T $svc }
else { Write-Host '  None matched. Assume no EDR telemetry or off-box log copy unless the client says otherwise.' -ForegroundColor Yellow }
$wef = (Get-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\EventLog\EventForwarding\SubscriptionManager').Property
Write-Host "  WEF subscription manager : $(if ($wef) { 'configured' } else { 'not configured' })"

# ---------------- Bottom line ----------------
H 'Bottom line'
$sec = $rows | Where-Object { $_.Log -eq 'Security' }
Write-Host "  Security log reaches back : $(if ($sec.DaysBack) { "$($sec.DaysBack) days (to $($sec.Oldest))" } else { 'nothing' })"
if ($vss.Count) {
    Write-Host "  Shadow copies reach back  : $([math]::Round(((Get-Date) - $vss[0].InstallDate).TotalDays, 1)) days (older evtx/registry may be recoverable)"
}
Write-Host '  Before these dates, the storyline depends on disk artifacts, EDR telemetry, or off-host logs.'

if ($OutputPath) { Stop-Transcript | Out-Null }
