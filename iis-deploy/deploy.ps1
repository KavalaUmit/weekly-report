# deploy.ps1 - Build and deploy Weekly Report React app to IIS
# Usage: .\deploy.ps1 [-SitePath "C:\inetpub\wwwroot\weekly-report"]

param(
    [string]$SitePath = "C:\inetpub\wwwroot\weekly-report"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== Weekly Report - IIS Deployment ===" -ForegroundColor Cyan
Write-Host "Project : $ProjectRoot"
Write-Host "Target  : $SitePath"
Write-Host ""

# 1. Install dependencies
Write-Host "[1/4] Installing npm dependencies..." -ForegroundColor Yellow
Push-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }

# 2. Build the React app
Write-Host "[2/4] Building React app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "npm run build failed"; exit 1 }
Pop-Location

# 3. Prepare target directory
Write-Host "[3/4] Preparing target directory..." -ForegroundColor Yellow
if (-Not (Test-Path $SitePath)) {
    New-Item -ItemType Directory -Path $SitePath -Force | Out-Null
    Write-Host "  Created $SitePath"
} else {
    Write-Host "  Cleaning $SitePath"
    Remove-Item "$SitePath\*" -Recurse -Force
}

# 4. Copy build output + IIS web.config
Write-Host "[4/4] Copying files to IIS site..." -ForegroundColor Yellow
Copy-Item -Path "$ProjectRoot\build\*" -Destination $SitePath -Recurse -Force

# Overwrite web.config with the IIS-specific one from iis-deploy/
Copy-Item -Path "$PSScriptRoot\web.config" -Destination $SitePath -Force
Write-Host "  Copied web.config (IIS)"

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Site path : $SitePath"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Ensure the IIS site points to: $SitePath"
Write-Host "  - Ensure URL Rewrite Module is installed on IIS"
Write-Host "  - Restart the IIS site/application pool if needed"
