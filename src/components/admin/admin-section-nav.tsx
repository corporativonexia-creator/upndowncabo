import Link from "next/link";

const items = [
  { label: "Productos", href: "/admin" },
  { label: "Categorías y servicios", href: "/admin/categorias" },
  { label: "Alta rápida", href: "/admin/productos/alta-rapida" },
  { label: "Inventario", href: "/admin/inventario" },
  { label: "POS / Caja", href: "/admin?section=pos" },
  { label: "Pedidos", href: "/admin?section=orders" },
  { label: "Vendedores", href: "/admin?section=vendedores" },
  { label: "Clases", href: "/admin?section=classes" },
  { label: "Contenido", href: "/admin?section=content" },
  { label: "Tienda ↗", href: "/" },
  { label: "Panel vendedor ↗", href: "/vendedor" },
];

export default function AdminSectionNav({ active }: { active?: string }) {
  return (
    <div className="admin-section-shell">
      <div className="admin-section-brand">
        <div className="admin-section-logo">UP AND DOWN</div>
        <div className="admin-section-caption">PANEL ADMINISTRATIVO</div>
      </div>
      <nav className="admin-section-nav" aria-label="Panel administrativo">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={active === item.label ? "active" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <style>{`
        .admin-section-shell{max-width:1280px;margin:0 auto 18px;padding:0 2px 14px;border-bottom:1px solid rgba(20,62,53,.12);font-family:Inter,Arial,sans-serif}
        .admin-section-brand{padding:0 8px 13px}
        .admin-section-logo{font-family:Georgia,serif;font-size:27px;letter-spacing:.13em;color:#143e35;line-height:1}
        .admin-section-caption{margin-top:6px;font-size:8px;font-weight:900;letter-spacing:.22em;color:#2f6f5b}
        .admin-section-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 8px}
        .admin-section-nav a{display:inline-flex;align-items:center;min-height:34px;padding:0 15px;border:1px solid rgba(20,62,53,.15);border-radius:12px;background:#fff;color:#143e35;text-decoration:none;font-size:11px;font-weight:800;box-shadow:0 3px 10px rgba(20,62,53,.03)}
        .admin-section-nav a:hover{background:#f4f7f5}
        .admin-section-nav a.active{background:#143e35;color:#fff;border-color:#143e35}
        @media(max-width:800px){.admin-section-shell{overflow:hidden}.admin-section-nav{flex-wrap:nowrap;overflow-x:auto;padding-bottom:5px}.admin-section-nav a{white-space:nowrap;flex:0 0 auto}.admin-section-logo{font-size:23px}}
      `}</style>
    </div>
  );
}
