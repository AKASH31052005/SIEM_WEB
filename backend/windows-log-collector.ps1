# =====================================================
#   SecureWatch SIEM - Windows Agent v2.1 (FIXED)
# =====================================================

param(
    [string]$BackendUrl = "http://localhost:5000"
)

Write-Host "======================================"
Write-Host "  SecureWatch SIEM Windows Agent v2.1"
Write-Host "======================================"
Write-Host "Backend: $BackendUrl"
Write-Host ""

# ✅ USE SAME BASE URL EVERYWHERE
$agentUrl   = "$BackendUrl/api/agent"
$metricsUrl = "$BackendUrl/api/agent/metrics"

$securityEventIDs = @(4624, 4625, 4634, 4647, 4648, 4672, 4720, 4726, 4732, 4740, 4688, 4697, 1102)
$systemEventIDs   = @(6005, 6006, 41, 7045)

$lastSecurityId    = 0
$lastSystemId      = 0
$lastApplicationId = 0

# ===============================
# SEND LOG FUNCTION
# ===============================
function Send-LogToSIEM($body) {
    try {
        $json = $body | ConvertTo-Json -Depth 6 -Compress
        Invoke-RestMethod -Uri $agentUrl -Method Post -Body $json -ContentType "application/json" -ErrorAction Stop | Out-Null
    } catch {
        # silent fail
    }
}

# ===============================
# SEND METRICS FUNCTION
# ===============================
function Send-MetricsToSIEM() {
    try {
        # CPU
        $cpuLoad = (Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average

        # Memory
        $os       = Get-WmiObject -Class Win32_OperatingSystem
        $totalMem = [math]::Round($os.TotalVisibleMemorySize * 1KB)
        $freeMem  = [math]::Round($os.FreePhysicalMemory * 1KB)
        $usedMem  = $totalMem - $freeMem
        $memPct   = if ($totalMem -gt 0) { [math]::Round(($usedMem / $totalMem) * 100, 1) } else { 0 }

        # Disk
        $drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object {
            $used  = $_.Used
            $free  = $_.Free
            $total = $used + $free
            $pct   = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 1) } else { 0 }
            @{
                fs           = $_.Name + ":"
                mount        = $_.Root
                size         = $total
                used         = $used
                available    = $free
                usedPercent  = $pct
                type         = "NTFS"
            }
        }

        # Network
        $adapters = Get-NetAdapterStatistics | Where-Object { $_ -ne $null } | Select-Object -First 3
        $netStats = $adapters | ForEach-Object {
            @{
                iface    = $_.Name
                tx_bytes = $_.SentBytes
                rx_bytes = $_.ReceivedBytes
                tx_sec   = 0
                rx_sec   = 0
            }
        }

        # OS Info
        $compSys  = Get-WmiObject -Class Win32_ComputerSystem
        $uptime   = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime

        $osInfo   = @{
            platform = "win32"
            distro   = $os.Caption
            release  = $os.Version
            arch     = $compSys.SystemType
            hostname = $env:COMPUTERNAME
            uptime   = [math]::Round($uptime.TotalSeconds)
        }

        $payload = @{
            cpu = @{ currentLoad = $cpuLoad }
            mem = @{
                total       = $totalMem
                used        = $usedMem
                free        = $freeMem
                usedPercent = $memPct
            }
            disk      = @($drives)
            net       = @($netStats)
            os        = $osInfo
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

# ===============================
# MAIN LOOP
# ===============================
$loopCount = 0
Write-Host "Agent started. Monitoring Windows events and system metrics..."
Write-Host ""

while ($true) {

    $loopCount++

    try {
        # SECURITY EVENTS
        $securityEvents = Get-WinEvent -LogName Security -MaxEvents 30 -ErrorAction SilentlyContinue |
                          Where-Object { $_.RecordId -gt $lastSecurityId -and $securityEventIDs -contains $_.Id }

        foreach ($event in $securityEvents) {

            $msg = ($event.Message -replace "`r`n", " " -replace "`n", " ").Trim()
            if ($msg.Length -gt 500) { $msg = $msg.Substring(0, 500) + "..." }

            $sourceIP = "unknown"
            if ($msg -match 'Source Network Address:\s+(\d+\.\d+\.\d+\.\d+)') {
                $sourceIP = $Matches[1]
            }

            $username = "-"
            if ($msg -match 'Account Name:\s+(\S+)') { $username = $Matches[1] }

            $body = @{
                LogType       = "Security"
                EventRecordID = $event.RecordId
                EventID       = $event.Id
                TimeCreated   = $event.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ss")
                Level         = $event.LevelDisplayName
                MachineName   = $event.MachineName
                Message       = $msg
                Username      = $username
                SourceIP      = $sourceIP
                Category      = $event.TaskDisplayName
            }

            Send-LogToSIEM $body
            $lastSecurityId = $event.RecordId
        }

        # SYSTEM EVENTS
        $systemEvents = Get-WinEvent -LogName System -MaxEvents 20 -ErrorAction SilentlyContinue |
                        Where-Object { $_.RecordId -gt $lastSystemId -and $systemEventIDs -contains $_.Id }

        foreach ($event in $systemEvents) {

            $msg = ($event.Message -replace "`r`n", " ").Trim()

            $body = @{
                LogType       = "System"
                EventRecordID = $event.RecordId
                EventID       = $event.Id
                TimeCreated   = $event.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ss")
                Level         = $event.LevelDisplayName
                MachineName   = $event.MachineName
                Message       = $msg
                SourceIP      = "local"
            }

            Send-LogToSIEM $body
            $lastSystemId = $event.RecordId
        }

    } catch {
        Write-Host ("Event collection error: " + $_.Exception.Message)
    }

    if ($loopCount % 2 -eq 0) {
        Send-MetricsToSIEM
    }

    Start-Sleep -Seconds 5
}