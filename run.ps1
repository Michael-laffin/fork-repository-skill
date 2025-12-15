# promptbox.pro - Start Script (Windows PowerShell)

param(
    [switch]$ApiOnly,
    [switch]$UiOnly,
    [int]$ApiPort = 8000,
    [int]$UiPort = 5173
)

$ErrorActionPreference = "Stop"

function Write-Header {
    Write-Host ""
    Write-Host "  ⑂ PROMPTBOX.PRO" -ForegroundColor Cyan
    Write-Host "  Agent Orchestration Command Center" -ForegroundColor DarkGray
    Write-Host ""
}

function Start-Api {
    Write-Host "Starting API server on port $ApiPort..." -ForegroundColor Yellow

    # Check if Python is available
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        $python = Get-Command python3 -ErrorAction SilentlyContinue
    }

    if (-not $python) {
        Write-Host "Error: Python not found. Please install Python 3.8+" -ForegroundColor Red
        exit 1
    }

    # Install dependencies if needed
    if (-not (Test-Path "venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor Gray
        & $python.Source -m venv venv
    }

    # Activate venv and install deps
    & .\venv\Scripts\Activate.ps1
    pip install -q -r requirements.txt

    # Start the API
    uvicorn api.main:app --host 0.0.0.0 --port $ApiPort --reload
}

function Start-Ui {
    Write-Host "Starting UI server on port $UiPort..." -ForegroundColor Yellow

    # Check if npm is available
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Host "Error: npm not found. Please install Node.js" -ForegroundColor Red
        exit 1
    }

    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing npm dependencies..." -ForegroundColor Gray
        npm install
    }

    # Start the UI
    npm run dev -- --port $UiPort
}

Write-Header

if ($ApiOnly) {
    Start-Api
} elseif ($UiOnly) {
    Start-Ui
} else {
    Write-Host "Starting both API and UI servers..." -ForegroundColor Green
    Write-Host ""
    Write-Host "To start only one service, use:" -ForegroundColor DarkGray
    Write-Host "  .\run.ps1 -ApiOnly    # Start API only" -ForegroundColor DarkGray
    Write-Host "  .\run.ps1 -UiOnly     # Start UI only" -ForegroundColor DarkGray
    Write-Host ""

    # Start API in background
    $apiJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        & .\venv\Scripts\Activate.ps1 2>$null
        if (-not $?) {
            python -m venv venv
            & .\venv\Scripts\Activate.ps1
            pip install -q -r requirements.txt
        }
        uvicorn api.main:app --host 0.0.0.0 --port $using:ApiPort --reload
    }

    Write-Host "API server starting in background (Job ID: $($apiJob.Id))..." -ForegroundColor Cyan

    # Give API time to start
    Start-Sleep -Seconds 2

    # Start UI in foreground
    Start-Ui
}
