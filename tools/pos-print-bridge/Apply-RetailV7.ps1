# Up & Down POS - Retail v7
# Alinea a la izquierda todos los renglones del total con letra.
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'UpNDownPrintBridge.ps1'
if (-not (Test-Path $target)) { throw "No se encontro $target" }
$text = [IO.File]::ReadAllText($target, [Text.Encoding]::UTF8)

# Retail v6 local deja el bloque de AmountWords precedido por CENTER.
$old = 'AddBytes $b $CENTER;$words=AmountWords $total;'
$new = 'AddBytes $b $LEFT;$words=AmountWords $total;'

if ($text.Contains($old)) {
  $text = $text.Replace($old, $new)
} elseif (-not $text.Contains($new)) {
  throw 'No se encontro el bloque esperado del total con letra. No se modifico el Bridge.'
}

# Acepta tanto una instalacion v5 parcheada a v6 como una que ya reporte v6.
$text = $text.Replace('"receipt":"retail-v5"','"receipt":"retail-v7"')
$text = $text.Replace('"receipt":"retail-v6"','"receipt":"retail-v7"')

[IO.File]::WriteAllText($target, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host 'LISTO: Retail v7 aplicado. Total con letra alineado a la izquierda en todos los renglones.' -ForegroundColor Green
