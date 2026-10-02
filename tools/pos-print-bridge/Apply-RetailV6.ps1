# Up & Down POS - Retail v6 safe total-in-words wrapping
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'UpNDownPrintBridge.ps1'
if (-not (Test-Path $target)) { throw "No se encontro $target" }
$text = [IO.File]::ReadAllText($target, [Text.Encoding]::UTF8)
$old = 'AddBytes $b $CENTER;AddText $b ((AmountWords $total)+"`n");AddBytes $b $LEFT;'
$new = @'
AddBytes $b $CENTER;$words=AmountWords $total;$wordLine='';foreach($word in ($words -split ' ')){if($wordLine.Length -eq 0){$wordLine=$word}elseif(($wordLine.Length+1+$word.Length)-le 38){$wordLine+=' '+$word}else{AddText $b ($wordLine+"`n");$wordLine=$word}};if($wordLine){AddText $b ($wordLine+"`n")};AddBytes $b $LEFT;
'@
if (-not $text.Contains($old)) {
  if ($text.Contains('receipt":"retail-v6')) { Write-Host 'Retail v6 ya estaba aplicado.' -ForegroundColor Green; exit 0 }
  throw 'No se encontro el bloque esperado de total con letra. No se modifico el Bridge.'
}
$text = $text.Replace($old, $new.Trim())
$text = $text.Replace('"receipt":"retail-v5"','"receipt":"retail-v6"')
[IO.File]::WriteAllText($target, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host 'LISTO: Retail v6 aplicado. Total con letra limitado a 38 caracteres por renglon.' -ForegroundColor Green
