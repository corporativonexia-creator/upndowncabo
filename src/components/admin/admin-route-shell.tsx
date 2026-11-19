"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import AdminSectionNav from "./admin-section-nav";

/** Nested admin routes keep their original modules; only navigation is shared. */
export default function AdminRouteShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  // The /admin landing page owns legacy DOM-bound actions and its A2 sidebar.
  if (pathname === "/admin") return <>{children}</>;
  return <NestedAdminShell pathname={pathname} key={pathname}>{children}</NestedAdminShell>;
}

function NestedAdminShell({ pathname, children }: Readonly<{ pathname: string; children: React.ReactNode }>) {
  const [open, setOpen] = useState(false);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  return (
    <div className="ud-admin-route-shell" onKeyDown={event => {
      if (event.key === "Escape" && open) { setOpen(false); mobileToggle.current?.focus(); }
    }}>
      <button
        type="button"
        ref={mobileToggle}
        className="ud-admin-route-mobile-toggle"
        aria-expanded={open}
        aria-controls="udAdminRouteNavigation"
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">☰</span> Menú del administrador <span aria-hidden="true">{open ? "×" : "⌄"}</span>
      </button>
      {open ? <button type="button" className="ud-admin-route-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} /> : null}
      <aside id="udAdminRouteNavigation" className={`ud-admin-route-sidebar${open ? " is-open" : ""}`}>
        <AdminSectionNav activePath={pathname} onNavigate={() => setOpen(false)} />
      </aside>
      <div className="ud-admin-route-content">{children}</div>
    </div>
  );
}
