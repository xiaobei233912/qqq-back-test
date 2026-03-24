param(
    [string]$Symbol = "QQQ",
    [string]$OutputPath = "data/qqq-monthly.json"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Convert-FromUnixTime {
    param([long]$Timestamp)
    [DateTimeOffset]::FromUnixTimeSeconds($Timestamp).UtcDateTime
}

function Get-YearMonth {
    param([datetime]$Date)
    $Date.ToString("yyyy-MM")
}

$uri = "https://query1.finance.yahoo.com/v8/finance/chart/${Symbol}?range=max&interval=1mo&includePrePost=false&events=div%2Csplits"
$response = Invoke-RestMethod -Uri $uri
$result = $response.chart.result[0]

if (-not $result) {
    throw "Yahoo Finance returned no result for symbol $Symbol."
}

$timestamps = $result.timestamp
$quote = $result.indicators.quote[0]
$adjclose = $result.indicators.adjclose[0].adjclose

if (-not $timestamps -or -not $adjclose) {
    throw "Yahoo Finance monthly series is incomplete."
}

$latestCompleteMonth = (Get-Date).AddDays(1 - (Get-Date).Day).AddMonths(-1)
$records = @()
$previousAdjClose = $null

for ($i = 0; $i -lt $timestamps.Count; $i++) {
    $adj = $adjclose[$i]
    $close = $quote.close[$i]

    if ($null -eq $adj -or $null -eq $close) {
        continue
    }

    $date = Convert-FromUnixTime -Timestamp $timestamps[$i]
    if ($date -gt $latestCompleteMonth) {
        continue
    }

    $monthlyReturn = $null
    if ($null -ne $previousAdjClose -and $previousAdjClose -ne 0) {
        $monthlyReturn = [math]::Round((($adj / $previousAdjClose) - 1), 8)
    }

    $records += [pscustomobject]@{
        date = Get-YearMonth -Date $date
        timestamp = [int64]$timestamps[$i]
        year = $date.Year
        month = $date.Month
        closeUsd = [math]::Round([double]$close, 4)
        adjCloseUsd = [math]::Round([double]$adj, 4)
        price = [math]::Round([double]$adj, 4)
        monthlyReturn = $monthlyReturn
        isYearEnd = ($date.Month -eq 12)
    }

    $previousAdjClose = $adj
}

if ($records.Count -lt 2) {
    throw "The generated dataset has too few records to run a backtest."
}

$payload = [pscustomobject]@{
    meta = [pscustomobject]@{
        symbol = $result.meta.symbol
        longName = $result.meta.longName
        displayCurrency = "CNY"
        source = "Yahoo Finance"
        priceBasis = "Adjusted close"
        underlyingCurrency = $result.meta.currency
        interval = "1mo"
        firstTradeDate = (Convert-FromUnixTime -Timestamp $result.meta.firstTradeDate).ToString("yyyy-MM-dd")
        retrievedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        startDate = $records[0].date
        endDate = $records[-1].date
        recordCount = $records.Count
        assumptions = @(
            "QQQ returns use Yahoo Finance adjusted close monthly data.",
            "Portfolio amounts are displayed as CNY labels, but returns use the raw QQQ monthly total-return path without FX conversion.",
            "Current incomplete month is excluded.",
            "Cash return is set to 0%."
        )
    }
    records = $records
}

$jsonOutputPath = Join-Path (Get-Location) $OutputPath
$outputDirectory = Split-Path -Parent $jsonOutputPath

if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$json = $payload | ConvertTo-Json -Depth 8
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($jsonOutputPath, $json, $utf8NoBom)

$jsOutputPath = Join-Path $outputDirectory "$($Symbol.ToLowerInvariant())-history.js"
$jsContent = "window.__QQQ_MONTHLY_DATA__ = $json;"
[System.IO.File]::WriteAllText($jsOutputPath, $jsContent, $utf8NoBom)

Write-Host "Saved $($records.Count) monthly records to $jsonOutputPath"
Write-Host "Saved browser dataset to $jsOutputPath"

