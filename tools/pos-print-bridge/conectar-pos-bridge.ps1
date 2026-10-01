$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$file = Join-Path $root 'src\app\pos\page.tsx'
$text = [IO.File]::ReadAllText($file)

if ($text.Contains('http://127.0.0.1:18181/print-sale')) {
  Write-Host 'OK: el POS ya esta conectado al Print Bridge.' -ForegroundColor Green
  exit 0
}

$pattern = '(?s)      let printNote = "";\s*      if \(completedSale\) \{\s*        try \{\s*          printReceipt\(completedSale\);\s*          printNote = " · Ticket listo para imprimir en POS-80C\.";\s*        \} catch \(printError\) \{\s*          printNote = ` · Venta guardada, pero no se abrió impresión: \$\{readableError\(printError\)\}`;\s*        \}\s*      \} else \{\s*        printNote = " · Venta guardada; usa Ticket PDF en el historial si necesitas imprimirla\.";\s*      \}'

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

$updated = [Text.RegularExpressions.Regex]::Replace($text, $pattern, $new, 1)
if ($updated -eq $text) {
  throw 'No encontre el bloque de impresion esperado. No se modifico ningun archivo.'
}

[IO.File]::WriteAllText($file, $updated, (New-Object Text.UTF8Encoding($false)))
Write-Host 'OK: /pos ahora usa Print Bridge ESC/POS directo.' -ForegroundColor Green
Write-Host 'La venta se guarda primero; un fallo de impresion NO repite el cobro.' -ForegroundColor Cyan
