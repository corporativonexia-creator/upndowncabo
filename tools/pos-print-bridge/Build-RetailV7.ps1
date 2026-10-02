# Up & Down POS - consolidador Retail v7
# Convierte el Bridge base retail-v5 en la version final retail-v7.
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'UpNDownPrintBridge.ps1'
if (-not (Test-Path $target)) { throw "No se encontro $target" }
$text = [IO.File]::ReadAllText($target, [Text.Encoding]::UTF8)

$old = 'AddBytes $b $CENTER;AddText $b ((AmountWords $total)+"`n");AddBytes $b $LEFT;'
$new = 'AddBytes $b $LEFT;$words=AmountWords $total;$wordLine='''';foreach($word in ($words -split '' '')){if($wordLine.Length -eq 0){$wordLine=$word}elseif(($wordLine.Length+1+$word.Length)-le 38){$wordLine+=''' '+$word}else{AddText $b ($wordLine+"`n");$wordLine=$word}};if($wordLine){AddText $b ($wordLine+"`n")};AddBytes $b $LEFT;'

if ($text.Contains($old)) {
  $text = $text.Replace($old, $new)
} elseif (-not ($text.Contains('$words=AmountWords $total') -and $text.Contains('$LEFT;$words=AmountWords $total'))) {
  throw 'No se encontro un bloque compatible de AmountWords. Build detenido.'
}

$text = $text.Replace('"receipt":"retail-v5"','"receipt":"retail-v7"')
$text = $text.Replace('"receipt":"retail-v6"','"receipt":"retail-v7"')

if (-not $text.Contains('"receipt":"retail-v7"')) { throw 'No se pudo marcar Retail v7.' }
if ($text.Contains('"receipt":"retail-v5"') -or $text.Contains('"receipt":"retail-v6"')) { throw 'Quedaron referencias a versiones anteriores.' }

[IO.File]::WriteAllText($target, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host 'OK: Bridge consolidado en Retail v7.' -ForegroundColor Green
