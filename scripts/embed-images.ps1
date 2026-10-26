$ErrorActionPreference = 'Stop'

$htmlPath = Join-Path $PSScriptRoot '..\harrys-garage.html'
$imgDir   = Join-Path $PSScriptRoot '..\images'
$outPath  = Join-Path $PSScriptRoot '..\harrys-garage-embedded.html'

$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

foreach ($n in 1..12) {
    $id      = 'IMG-{0:D2}' -f $n
    $pngPath = Join-Path $imgDir "$id.png"
    if (-not (Test-Path $pngPath)) { Write-Host "MISSING: $id — skipping"; continue }

    $bytes  = [System.IO.File]::ReadAllBytes($pngPath)
    $b64    = [Convert]::ToBase64String($bytes)
    $imgTag = "<img src=`"data:image/png;base64,$b64`" alt=`"$id`" loading=`"lazy`">"

    # Replace the source placeholder comment with the embedded img tag
    $html = $html -replace "<!-- $id image[^>]*-->", $imgTag
    Write-Host "Embedded $id"
}

[System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
Write-Host "`nDone. Embedded HTML written to: $outPath"
Write-Host "File size: $([math]::Round((Get-Item $outPath).Length/1MB,1)) MB"
