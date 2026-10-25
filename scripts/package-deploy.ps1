# Create a VPS deploy zip from the repo WITHOUT overwriting server-only files.
# Excludes: node_modules, .next, .git, docker-compose.yml, .env, uploads, prior zips.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\package-deploy.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$DistDir = Join-Path $Root "dist"
$ZipPath = Join-Path $DistDir "tms-deploy-$Timestamp.zip"
$Staging = Join-Path $env:TEMP "tms-deploy-$Timestamp"

if (Test-Path $Staging) {
  Remove-Item -Recurse -Force $Staging
}
New-Item -ItemType Directory -Path $Staging -Force | Out-Null
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null

$excludeDirs = @(
  "node_modules", ".next", "out", "build", ".git", "dist",
  ".cursor", "terminals", "coverage", "public\uploads"
)

$excludeFiles = @("docker-compose.yml", ".env", ".env.production", ".env.local")

Write-Host "Staging deploy bundle from $Root ..."

robocopy $Root $Staging /E /XD $excludeDirs /XF $excludeFiles "*.zip" /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}
Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipPath -CompressionLevel Optimal

Remove-Item -Recurse -Force $Staging

Write-Host ""
Write-Host "Created: $ZipPath"
Write-Host "Upload this zip to the VPS, extract into your app directory (docker-compose.yml on the server is NOT included)."
Write-Host "On VPS: unzip -o tms-deploy-*.zip && docker compose build && docker compose up -d"
