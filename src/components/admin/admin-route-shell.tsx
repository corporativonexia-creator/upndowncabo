"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AdminParity from "./admin-parity";
import AdminSectionNav from "./admin-section-nav";

/** Keep the legacy document-scoped runtime mounted while visiting nested admin routes. */
export default function AdminRouteShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isRoot = pathname === "/admin";
  const [hasOpenedRoot, setHasOpenedRoot] = useState(isRoot);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mount once on the first visit and retain document-bound listeners.
    if (isRoot) setHasOpenedRoot(true);
  }, [isRoot]);

  return (
    <>
      <div className="ud-admin-root-slot" hidden={!isRoot}>
        {(hasOpenedRoot || isRoot) && <AdminParity active={isRoot} section={searchParams.get("section") || ""} />}
      </div>
      {!isRoot && <NestedAdminShell pathname={pathname}>{children}</NestedAdminShell>}
    </>
  );
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
