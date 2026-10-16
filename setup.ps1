# Local Transcriber: check this Windows computer, install what is missing, and install the app.
# Run from the project folder in PowerShell:   .\setup.ps1
# If PowerShell refuses to run it:             powershell -ExecutionPolicy Bypass -File .\setup.ps1
# Add -Llm to also build the highlights/summaries engine (needs Visual Studio Build Tools; see docs/troubleshooting.md).
# Add -Start to start the app when the install is done.
param([switch]$Llm, [switch]$Start)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Say($m)  { Write-Host "  $m" }
function Ok($m)   { Write-Host "  [ok]   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Bad($m)  { Write-Host "  [stop] $m" -ForegroundColor Red }
function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host ""
Write-Host "Local Transcriber setup" -ForegroundColor Cyan
Write-Host ""

# 1. The computer ------------------------------------------------------------------------------
Write-Host "1. This computer"
$os = Get-CimInstance Win32_OperatingSystem
$ramGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$drive = (Get-Item $PSScriptRoot).PSDrive
$freeGb = [math]::Round($drive.Free / 1GB, 1)
$cores = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
$gpu = (Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }) -join ", "
Say "Memory: $ramGb GB, processor threads: $cores, free disk on $($drive.Name): $freeGb GB"
Say "Graphics: $gpu"

if ($freeGb -lt 8) { Bad "Less than 8 GB free on this drive. The install and the first model need about 8 GB. Free some space and run this again."; exit 1 }
elseif ($freeGb -lt 15) { Warn "$freeGb GB free is enough for the install and the Small model, but not for large models." }
else { Ok "Disk space" }

if ($ramGb -lt 4) { Warn "Under 4 GB of memory. Use the Tiny or Base model size, and close other programs while transcribing." }
elseif ($ramGb -lt 8) { Warn "$ramGb GB of memory: Small works; avoid Medium and Large." }
else { Ok "Memory" }

if ($gpu -notmatch "NVIDIA") { Say "No NVIDIA graphics card found: transcription will run on the processor. Use the Small model size." }

# 2. The tools ---------------------------------------------------------------------------------
Write-Host ""
Write-Host "2. Tools (Node.js 22.12 or newer, uv)"
$needWinget = @()

function Node-Ok {
    if (-not (Have "node")) { return $false }
    $v = (node --version).TrimStart("v").Split(".")
    return ([int]$v[0] -gt 22) -or ([int]$v[0] -eq 22 -and [int]$v[1] -ge 12)
}
if (Node-Ok) { Ok "Node.js $(node --version)" } else { $needWinget += "OpenJS.NodeJS.LTS" }
if (Have "uv") { Ok "uv $((uv --version))" } else { $needWinget += "astral-sh.uv" }

if ($needWinget.Count -gt 0) {
    if (-not (Have "winget")) {
        Bad "Missing: $($needWinget -join ', '), and winget is not available. Install Node.js (nodejs.org) and uv (docs.astral.sh/uv) by hand, then run this again."
        exit 1
    }
    foreach ($id in $needWinget) {
        Say "Installing $id with winget (this can take a few minutes)..."
        winget install --id $id -e --accept-package-agreements --accept-source-agreements
    }
    Refresh-Path
    if (-not (Node-Ok)) { Bad "Node.js is installed but this window cannot see version 22.12 or newer yet. Close PowerShell, open it again, and run .\setup.ps1 again."; exit 1 }
    if (-not (Have "uv")) { Bad "uv is installed but this window cannot see it yet. Close PowerShell, open it again, and run .\setup.ps1 again."; exit 1 }
}

# 3. The app -----------------------------------------------------------------------------------
Write-Host ""
Write-Host "3. Installing the app (downloads a few GB, once)"
Push-Location engine
try {
    if ($Llm) { Say "uv sync --extra llm"; uv sync --extra llm } else { Say "uv sync"; uv sync }
    if ($LASTEXITCODE -ne 0) { throw "uv sync failed" }
} finally { Pop-Location }
Push-Location app
try {
    Say "npm ci"
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} finally { Pop-Location }

Write-Host ""
Ok "Installed."
if (-not $Llm) { Say "Highlights and summaries are not installed (they need a C++ compiler). Transcripts, speakers and exports work. To add them later: .\setup.ps1 -Llm" }
Write-Host ""
Say "To start the app:   cd app; npm run dev"
Say "First screen: download the Small model (about 480 MB), then add a recording."

if ($Start) { Set-Location app; npm run dev }
