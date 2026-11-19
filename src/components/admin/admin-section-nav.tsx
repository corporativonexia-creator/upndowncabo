"use client";

import Link from "next/link";

const groups = [
  { name: "Productos e inventario", items: [
    { label: "Productos", href: "/admin" },
    { label: "Inventario", href: "/admin/inventario" },
    { label: "Categorías y servicios", href: "/admin/categorias" },
  ] },
  { name: "Ventas y POS", items: [
    { label: "Administración POS", href: "/admin?section=pos" },
    { label: "Pedidos", href: "/admin?section=orders" },
    { label: "Abrir caja / POS ↗", href: "/pos" },
    { label: "Recepción de equipos ↗", href: "/pos/recepciones" },
    { label: "Promociones y servicios POS", href: "/admin/pos/promociones" },
  ] },
  { name: "Comercial", items: [
    { label: "Vendedores", href: "/admin?section=vendedores" },
    { label: "Clases", href: "/admin?section=clases" },
    { label: "Panel vendedor ↗", href: "/vendedor" },
  ] },
  { name: "Sitio y contenidos", items: [
    { label: "Contenido", href: "/admin?section=contenido" },
    { label: "Tienda ↗", href: "/" },
  ] },
];

export default function AdminSectionNav({ activePath, onNavigate }: { activePath: string; onNavigate?: () => void }) {
  return (
    <nav className="ud-admin-section-nav" aria-label="Áreas de administración de UpNDown Cabo">
      <a href="/admin" onClick={onNavigate} className="ud-admin-section-brand">
        <strong>UP AND DOWN</strong>
        <small>PANEL ADMINISTRATIVO</small>
      </a>
      {groups.map(group => (
        <details key={group.name} className="ud-admin-section-group" open={group.items.some(item => item.href === activePath)}>
          <summary>{group.name}</summary>
          <div className="ud-admin-section-items">
            {group.items.map(item => {
              const props = {
                onClick: onNavigate,
                "aria-current": item.href === activePath ? "page" as const : undefined,
                className: item.href === activePath ? "is-active" : "",
              };
              // The legacy /admin runtime is document-scoped and must boot fresh
              // after returning from another Next route. A full navigation is required.
              return item.href === "/admin" || item.href.startsWith("/admin?")
                ? <a key={item.href} href={item.href} {...props}>{item.label}</a>
                : <Link key={item.href} href={item.href} {...props}>{item.label}</Link>;
            })}
          </div>
        </details>
      ))}
    </nav>
  );
}
