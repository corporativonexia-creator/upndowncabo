import { ImageResponse } from "next/og";
import { findShareableProduct } from "@/lib/storefront/get-shareable-product";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ productKey: string }> }) {
  const product = await findShareableProduct((await params).productKey);
  if (!product) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div style={{
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      width: "100%", height: "100%", padding: 78,
      background: "#143e35", color: "#ffffff", fontFamily: "sans-serif"
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6 }}>UP AND DOWN</div>
        <div style={{ fontSize: 17, letterSpacing: 3, color: "#d1dfd7" }}>CABO · GOLF SHOP</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 24, letterSpacing: 2, color: "#c8a86b", textTransform: "uppercase" }}>{product.category || "EQUIPO DE GOLF"}</div>
        <div style={{
          fontSize: product.name.length > 66 ? 42 : product.name.length > 42 ? 51 : 62,
          fontWeight: 700, lineHeight: 1.12, letterSpacing: -1, overflow: "hidden"
        }}>{product.name.slice(0, 100)}</div>
        <div style={{ fontSize: 25, color: "#e2eae6" }}>Conoce detalles y disponibilidad en UP AND DOWN Cabo</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, color: "#bcd1c5" }}>
        <span>GOLF · LOS CABOS</span><span>upndowncabo.com</span>
      </div>
    </div>, { width: 1200, height: 630 }
  );
}
