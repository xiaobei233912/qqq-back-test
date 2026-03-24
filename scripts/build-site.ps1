param(
    [string]$OutputDir = "site"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root $OutputDir
$dataTarget = Join-Path $target "data"

if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
}

New-Item -ItemType Directory -Path $dataTarget | Out-Null

$filesToCopy = @(
    "index.html",
    "styles.css",
    "app.js",
    "README.md"
)

foreach ($file in $filesToCopy) {
    Copy-Item -Path (Join-Path $root $file) -Destination (Join-Path $target $file)
}

Copy-Item -Path (Join-Path $root "data\qqq-history.js") -Destination (Join-Path $dataTarget "qqq-history.js")
Copy-Item -Path (Join-Path $root "data\qqq-monthly.json") -Destination (Join-Path $dataTarget "qqq-monthly.json")

New-Item -ItemType File -Path (Join-Path $target ".nojekyll") | Out-Null

Write-Host "Built static site to $target"
