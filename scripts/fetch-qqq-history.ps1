param(
    [string]$Symbol = "QQQ",
    [string]$OutputPath = "data/qqq-monthly.json"
)

$scriptPath = Join-Path $PSScriptRoot "refresh-qqq-data.ps1"
& $scriptPath -Symbol $Symbol -OutputPath $OutputPath
