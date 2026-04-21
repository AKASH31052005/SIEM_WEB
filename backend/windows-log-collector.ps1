param(
    [string]$BackendUrl = "http://localhost:5000"
)

Write-Host "======================================"
Write-Host "  SecureWatch SIEM Windows Agent v3.0"
Write-Host "======================================"
Write-Host "Backend: $BackendUrl"
Write-Host ""

$agentUrl = "$BackendUrl/api/agent"
$metricsUrl = "$BackendUrl/api/agent/metrics"

$securityEventIDs = @(4624, 4625, 4634, 4647, 4648, 4672, 4720, 4726, 4732, 4740, 4688, 4697, 1102)
$systemEventIDs = @(6005, 6006, 41, 7045)

function Get-LatestRecordId([string]$logName) {
    try {
        $latest = Get-WinEvent -LogName $logName -MaxEvents 1 -ErrorAction Stop | Select-Object -First 1
        if ($null -ne $latest -and $null -ne $latest.RecordId) {
            return [long]$latest.RecordId
        }
    } catch {
    }
    return [long]0
}

function Send-LogToSIEM($body) {
    try {
        $body.collector = "windows-agent"
        $json = $body | ConvertTo-Json -Depth 6 -Compress
        Invoke-RestMethod -Uri $agentUrl -Method Post -Body $json -ContentType "application/json" -ErrorAction Stop | Out-Null
    } catch {
    }
}

function Send-MetricsToSIEM() {
    try {
        $cpuLoad = 0
        try {
            $cpuRaw = (Get-WmiObject -Class Win32_Processor -ErrorAction Stop | Measure-Object -Property LoadPercentage -Average).Average
            if ($null -ne $cpuRaw) { $cpuLoad = [math]::Round([double]$cpuRaw, 1) }
        } catch {
        }

        $totalMem = 0
        $freeMem = 0
        $usedMem = 0
        $memPct = 0
        $os = $null
        try {
            $os = Get-WmiObject -Class Win32_OperatingSystem -ErrorAction Stop
            $totalMem = [math]::Round([double]$os.TotalVisibleMemorySize * 1KB)
            $freeMem = [math]::Round([double]$os.FreePhysicalMemory * 1KB)
            $usedMem = $totalMem - $freeMem
            $memPct = if ($totalMem -gt 0) { [math]::Round(($usedMem / $totalMem) * 100, 1) } else { 0 }
        } catch {
        }

        $drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object {
            $used = $_.Used
            $free = $_.Free
            $total = $used + $free
            $pct = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 1) } else { 0 }
            @{
                fs = $_.Name + ":"
                mount = $_.Root
                size = $total
                used = $used
                available = $free
                usedPercent = $pct
                type = "NTFS"
            }
        }

        $adapters = @()
        try {
            $adapters = Get-NetAdapterStatistics -ErrorAction Stop | Where-Object { $_ -ne $null } | Select-Object -First 3
        } catch {
        }
        $netStats = $adapters | ForEach-Object {
            @{
                iface = $_.Name
                tx_bytes = $_.SentBytes
                rx_bytes = $_.ReceivedBytes
                tx_sec = 0
                rx_sec = 0
            }
        }

        $compSys = $null
        try {
            $compSys = Get-WmiObject -Class Win32_ComputerSystem -ErrorAction Stop
        } catch {
        }

        $uptimeSeconds = 0
        try {
            $boot = (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime
            if ($boot) {
                $uptime = (Get-Date) - $boot
                $uptimeSeconds = [math]::Round($uptime.TotalSeconds)
            }
        } catch {
        }

        $osInfo = @{
            platform = "win32"
            distro = if ($os) { $os.Caption } else { "unknown" }
            release = if ($os) { $os.Version } else { "unknown" }
            arch = if ($compSys) { $compSys.SystemType } else { "unknown" }
            hostname = $env:COMPUTERNAME
            uptime = $uptimeSeconds
        }

        $payload = @{
            agentType = "windows_collector"
            cpu = @{ currentLoad = $cpuLoad }
            mem = @{
                total = $totalMem
                used = $usedMem
                free = $freeMem
                usedPercent = $memPct
            }
            disk = @($drives)
            net = @($netStats)
            os = $osInfo
            timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        }

        $json = $payload | ConvertTo-Json -Depth 8 -Compress
        Invoke-RestMethod -Uri $metricsUrl -Method Post -Body $json -ContentType "application/json" -ErrorAction Stop | Out-Null

        $timeNow = Get-Date -Format "HH:mm:ss"
        Write-Host ("Metrics sent - CPU: {0}% | RAM: {1}% | {2}" -f $cpuLoad, $memPct, $timeNow)
    } catch {
        Write-Host ("Metrics send failed: " + $_.Exception.Message)
    }
}

function Extract-Username([string]$message) {
    if ([string]::IsNullOrWhiteSpace($message)) { return "unknown" }

    $accountMatches = [regex]::Matches($message, 'Account Name:\s+([^\s]+)')
    foreach ($match in $accountMatches) {
        $candidate = $match.Groups[1].Value
        if ($candidate -and $candidate -ne "-" -and $candidate -ne "ANONYMOUS") {
            return $candidate
        }
    }

    return "unknown"
}

function Extract-SourceIp([string]$message) {
    if ([string]::IsNullOrWhiteSpace($message)) { return "unknown" }
    if ($message -match 'Source Network Address:\s+(\d+\.\d+\.\d+\.\d+)') {
        return $Matches[1]
    }
    return "unknown"
}

$lastSecurityId = Get-LatestRecordId "Security"
$lastSystemId = Get-LatestRecordId "System"
$loopCount = 0

Write-Host ("Starting cursors - Security: {0}, System: {1}" -f $lastSecurityId, $lastSystemId)
Write-Host "Agent started. Monitoring Windows events and system metrics..."
Write-Host ""

while ($true) {
    $loopCount++

    try {
        $securityEvents = Get-WinEvent -FilterHashtable @{ LogName = "Security"; ID = $securityEventIDs } -MaxEvents 300 -ErrorAction SilentlyContinue |
            Sort-Object RecordId |
            Where-Object { $_.RecordId -gt $lastSecurityId }

        $maxSecurityId = $lastSecurityId
        foreach ($event in $securityEvents) {
            $msg = ($event.Message -replace "`r`n", " " -replace "`n", " ").Trim()
            if ($msg.Length -gt 500) { $msg = $msg.Substring(0, 500) + "..." }

            $body = @{
                LogType = "Security"
                EventRecordID = $event.RecordId
                EventID = $event.Id
                TimeCreated = $event.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ss")
                Level = $event.LevelDisplayName
                MachineName = $event.MachineName
                Message = $msg
                Username = (Extract-Username $msg)
                SourceIP = (Extract-SourceIp $msg)
                Category = $event.TaskDisplayName
            }

            Send-LogToSIEM $body
            if ($event.RecordId -gt $maxSecurityId) {
                $maxSecurityId = $event.RecordId
            }
        }
        $lastSecurityId = $maxSecurityId

        $systemEvents = Get-WinEvent -FilterHashtable @{ LogName = "System"; ID = $systemEventIDs } -MaxEvents 200 -ErrorAction SilentlyContinue |
            Sort-Object RecordId |
            Where-Object { $_.RecordId -gt $lastSystemId }

        $maxSystemId = $lastSystemId
        foreach ($event in $systemEvents) {
            $msg = ($event.Message -replace "`r`n", " " -replace "`n", " ").Trim()
            if ($msg.Length -gt 500) { $msg = $msg.Substring(0, 500) + "..." }

            $body = @{
                LogType = "System"
                EventRecordID = $event.RecordId
                EventID = $event.Id
                TimeCreated = $event.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ss")
                Level = $event.LevelDisplayName
                MachineName = $event.MachineName
                Message = $msg
                SourceIP = "local"
                Category = $event.TaskDisplayName
            }

            Send-LogToSIEM $body
            if ($event.RecordId -gt $maxSystemId) {
                $maxSystemId = $event.RecordId
            }
        }
        $lastSystemId = $maxSystemId
    } catch {
        Write-Host ("Event collection error: " + $_.Exception.Message)
    }

    if ($loopCount % 2 -eq 0) {
        Send-MetricsToSIEM
    }

    Start-Sleep -Seconds 5
}
