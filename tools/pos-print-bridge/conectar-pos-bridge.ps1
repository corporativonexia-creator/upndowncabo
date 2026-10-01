$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$file = Join-Path $root 'src\app\pos\page.tsx'
$text = [IO.File]::ReadAllText($file)

if ($text.Contains('http://127.0.0.1:18181/print-sale')) {
  Write-Host 'OK: el POS ya esta conectado al Print Bridge.' -ForegroundColor Green
  exit 0
}

$startMarker = '      let printNote = "";'
$endMarker = '      setMessage('
$start = $text.IndexOf($startMarker)
if ($start -lt 0) { throw 'No encontre el inicio del bloque printNote. No se modifico ningun archivo.' }
$end = $text.IndexOf($endMarker, $start)
if ($end -lt 0) { throw 'No encontre setMessage despues de printNote. No se modifico ningun archivo.' }

$new = @'
      let printNote = "";
      if (completedSale) {
        try {
          const bridgeResponse = await fetch("http://127.0.0.1:18181/print-sale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sale: completedSale, access }),
          });

          if (!bridgeResponse.ok) {
            const bridgeBody = await bridgeResponse.text();
            throw new Error(
              `Print Bridge respondio ${bridgeResponse.status}${bridgeBody ? `: ${bridgeBody}` : ""}`,
            );
          }

          printNote = " · Impresion OK: cliente + comercio + cajon.";
        } catch (printError) {
          printNote = ` · VENTA GUARDADA, PERO NO SE IMPRIMIO. Verifica POS-80C y Print Bridge. ${readableError(printError)}`;
        }
      } else {
        printNote = " · Venta guardada; no se encontro el comprobante para impresion automatica.";
      }

'@

$updated = $text.Substring(0, $start) + $new + $text.Substring($end)
[IO.File]::WriteAllText($file, $updated, (New-Object Text.UTF8Encoding($false)))

if (-not ([IO.File]::ReadAllText($file).Contains('http://127.0.0.1:18181/print-sale'))) {
  throw 'La verificacion final fallo. Revisa page.tsx antes de continuar.'
}

Write-Host 'OK: /pos ahora usa Print Bridge ESC/POS directo.' -ForegroundColor Green
Write-Host 'La venta se guarda primero; un fallo de impresion NO repite el cobro.' -ForegroundColor Cyan
