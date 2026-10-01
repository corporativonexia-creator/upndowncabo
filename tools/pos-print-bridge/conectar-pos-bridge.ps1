$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$file = Join-Path $root 'src\app\pos\page.tsx'
$text = [IO.File]::ReadAllText($file)

$old = @'
      let printNote = "";
      if (completedSale) {
        try {
          printReceipt(completedSale);
          printNote = " · Ticket listo para imprimir en POS-80C.";
        } catch (printError) {
          printNote = ` · Venta guardada, pero no se abrió impresión: ${readableError(printError)}`;
        }
      } else {
        printNote = " · Venta guardada; usa Ticket PDF en el historial si necesitas imprimirla.";
      }
'@

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
              `Print Bridge respondió ${bridgeResponse.status}${bridgeBody ? `: ${bridgeBody}` : ""}`,
            );
          }

          printNote = " · Impresión OK: cliente + comercio + cajón.";
        } catch (printError) {
          printNote = ` · VENTA GUARDADA, PERO NO SE IMPRIMIÓ. Verifica POS-80C y Print Bridge. ${readableError(printError)}`;
        }
      } else {
        printNote = " · Venta guardada; no se encontró el comprobante para impresión automática.";
      }
'@

if (-not $text.Contains($old)) {
  if ($text.Contains('http://127.0.0.1:18181/print-sale')) {
    Write-Host 'OK: el POS ya está conectado al Print Bridge.' -ForegroundColor Green
    exit 0
  }
  throw 'No encontré el bloque esperado. No se modificó ningún archivo.'
}

$text = $text.Replace($old, $new)
[IO.File]::WriteAllText($file, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host 'OK: /pos ahora usa Print Bridge ESC/POS directo.' -ForegroundColor Green
Write-Host 'La venta se guarda primero; un fallo de impresión NO repite el cobro.' -ForegroundColor Cyan
