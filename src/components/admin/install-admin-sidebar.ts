/**
 * A1/A2 · Navigation-only adapter for the existing admin runtime.
 * Moves original DOM nodes without cloning or replacing their event handlers.
 * No Supabase calls, mutations, product or POS business logic.
 */
export function installAdminSidebar(): void {
  const root = document.getElementById("updown-admin");
  const nav = root?.querySelector<HTMLElement>(".u-admin-nav");
  if (!root || !nav || nav.dataset.premiumSidebar === "ready") return;

  const originals = Array.from(nav.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  const used = new Set<HTMLElement>();
  const takeId = (id: string) => {
    const element = originals.find((node) => node.id === id);
    if (element) used.add(element);
    return element;
  };
  const takeHref = (href: string) => {
    const element = originals.find((node) => node.getAttribute("href") === href);
    if (element) used.add(element);
    return element;
  };
  const quickLink = (label: string, href: string) => {
    const a = document.createElement("a");
    a.className = "u-tab ud-side-link";
    a.href = href;
    a.textContent = label;
    return a;
  };
  // A10.1: own the three navigation-only behaviors previously patched by
  // updown-inventory-nav.js. No late DOM polling or runtime reordering.
  const inventoryLink = takeId("udInventoryMainNav") || quickLink("Inventario", "/admin/inventario");
  inventoryLink.id = "udInventoryMainNav";
  const oldNew = root.querySelector<HTMLElement>("#udNew");
  if (oldNew) oldNew.style.display = "none"; // Duplicates the unified product entry.
  const hasSellerTab = originals.some((node) => node.id === "udv2SellersTab");
  if (hasSellerTab) takeId("udAffiliatesLink"); // The seller tab already handles this route.
  const section = (key: string, label: string, nodes: Array<HTMLElement | undefined>) => {
    const details = document.createElement("details");
    details.className = "ud-side-group";
    details.dataset.sidebarSection = key;
    const summary = document.createElement("summary");
    summary.textContent = label;
    const contents = document.createElement("div");
    contents.className = "ud-side-items";
    nodes.filter((node): node is HTMLElement => Boolean(node)).forEach((node) => contents.appendChild(node));
    details.append(summary, contents);
    return details;
  };

  const sections = [
    section("products", "Productos e inventario", [
      takeId("udProductsTab"), inventoryLink, takeHref("/admin/categorias"),
    ]),
    section("sales", "Ventas y POS", [
      takeId("udv2PosTab"), takeId("udOrdersTab"),
      quickLink("Abrir caja / POS", "/pos"),
      quickLink("Recepción de equipos", "/pos/recepciones"),
      quickLink("Promociones y servicios POS", "/admin/pos/promociones"),
    ]),
    section("commercial", "Comercial", [
      takeId("udv2SellersTab"), takeId("udv2LessonsTab"),
      takeId("udSellerPortalLink"), hasSellerTab ? undefined : takeId("udAffiliatesLink"),
    ]),
    section("website", "Sitio y contenidos", [
      takeId("udv2ContentTab"), takeId("udStoreLink"),
    ]),
  ];

  const remaining = originals.filter((node) => !used.has(node) && node.isConnected);
  if (remaining.length) sections.push(section("other", "Más herramientas", remaining));

  const current = new URLSearchParams(window.location.search).get("section") || "";
  const selected = current === "pos" || current === "orders" ? "sales"
    : current === "vendedores" || current === "sellers" || current === "clases" ? "commercial"
    : current === "contenido" || current === "content" ? "website" : "products";
  sections.find((node) => node.dataset.sidebarSection === selected)?.setAttribute("open", "");

  nav.replaceChildren(...sections);
  nav.dataset.premiumSidebar = "ready";
  nav.setAttribute("aria-label", "Áreas de administración de UpNDown Cabo");
  root.classList.add("ud-premium-white");

  // Native <details> handles keyboard access and expanded/collapsed state.
  // Preserve all original click listeners; only coordinate expanded groups.
  sections.forEach((group) => group.addEventListener("toggle", () => {
    if (!group.open) return;
    sections.forEach((other) => { if (other !== group) other.open = false; });
  }));
}
