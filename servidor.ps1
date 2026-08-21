$ErrorActionPreference = "Stop"

$nodeDirectory = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$env:PATH = "$nodeDirectory;$env:PATH"
$env:WRANGLER_LOG_PATH = Join-Path $PSScriptRoot ".wrangler\wrangler.log"

Set-Location -LiteralPath $PSScriptRoot
& ".\node_modules\.bin\vinext.cmd" dev
