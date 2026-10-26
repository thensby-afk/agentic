$ErrorActionPreference = 'Stop'

$slug    = 'html-garage'
$pat     = 'YOUR_PROD_PAT_HERE'   # Get from Tile dashboard → Settings → Access tokens
$base    = "https://tile.accenture.com/mapi/v1/pages/$slug"
$html    = Join-Path $PSScriptRoot '..\harrys-garage-embedded.html'
$headers = @{ Authorization = "Bearer $pat" }

if (-not (Test-Path $html)) {
    Write-Error "Run embed-images.ps1 first to generate harrys-garage-embedded.html"
    exit 1
}

Write-Host "Uploading to PROD site ($slug)..."
$body     = [System.IO.File]::ReadAllBytes($html)
$upload   = Invoke-RestMethod -Uri "$base/upload" -Method Post `
              -Headers ($headers + @{ 'Content-Type' = 'text/html' }) `
              -Body $body
$uploadId = $upload.upload_id
Write-Host "  upload_id: $uploadId"

Write-Host "Finalising..."
$finalize = Invoke-RestMethod -Uri "$base/finalize" -Method Post `
              -Headers ($headers + @{ 'Content-Type' = 'application/json' }) `
              -Body (ConvertTo-Json @{ upload_id = $uploadId })
Write-Host "  published after finalize: $($finalize.published)"

Write-Host "Publishing..."
$publish  = Invoke-RestMethod -Uri "$base/publish" -Method Post -Headers $headers

if ($publish.published -eq $true) {
    Write-Host "`nDONE. Open: https://tile.accenture.com/view/$slug/"
} else {
    Write-Host "WARNING: published flag not true — check Tile UI"
}
