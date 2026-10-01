from pathlib import Path

root = Path(__file__).resolve().parents[2]
p = root / "src" / "app" / "pos" / "page.tsx"
s = p.read_text(encoding="utf-8")

marker = "  async function checkoutSale() {"
helper = '''  async function printNewSaleViaBridge(sale: ShiftSale) {
    const response = await fetch("http://127.0.0.1:18181/print-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sale, access }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `Print Bridge HTTP ${response.status}`);
    }
    return response.json().catch(() => ({ ok: true }));
  }

'''
if "async function printNewSaleViaBridge" not in s:
    if marker not in s:
        raise SystemExit("ERROR: no encontre checkoutSale")
    s = s.replace(marker, helper + marker, 1)

old = '''      const result = data as {
        sale_number?: number;
        total?: number | string;
      } | null;

      const change ='''
new = '''      const result = data as {
        sale_number?: number;
        total?: number | string;
      } | null;

      const saleForPrint: ShiftSale = {
        id: "",
        sale_number: Number(result?.sale_number ?? 0),
        status: "completed",
        currency: "MXN",
        subtotal: Number(total.toFixed(2)),
        discount_amount: 0,
        total: numeric(result?.total ?? total),
        created_at: new Date().toISOString(),
        items: cart.map((item) => ({
          product_id: item.product.id,
          sku: item.product.sku,
          product_name: item.product.name,
          unit_price: productPrice(item.product),
          quantity: item.quantity,
          line_total: Number((productPrice(item.product) * item.quantity).toFixed(2)),
        })),
        payments: [{
          method: paymentMethod,
          amount: Number(total.toFixed(2)),
          reference: paymentReference.trim() || null,
        }],
      };

      let printWarning = "";
      try {
        await printNewSaleViaBridge(saleForPrint);
      } catch (printError) {
        printWarning = ` · AVISO: venta guardada, pero no se pudo imprimir: ${readableError(printError)}`;
      }

      const change ='''
if "const saleForPrint: ShiftSale" not in s:
    if old not in s:
        raise SystemExit("ERROR: no encontre el bloque result")
    s = s.replace(old, new, 1)

checkout_pos = s.index("  async function checkoutSale() {")
old2 = '''        }.`,
      );'''
new2 = '''        }.${printWarning}`,
      );'''
pos = s.find(old2, checkout_pos)
if pos != -1 and "${printWarning}" not in s[pos-200:pos+200]:
    s = s[:pos] + new2 + s[pos+len(old2):]

p.write_text(s, encoding="utf-8")
print("OK: /pos conectado al Print Bridge local")
