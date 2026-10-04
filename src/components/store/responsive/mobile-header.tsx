"use client";

function clickLegacyControl(id: string) {
  document.getElementById(id)?.click();
}

export function MobileHeader() {
  return (
    <header className="uds-native-mobile-header" aria-label="Navegación móvil">
      <a className="uds-native-mobile-logo" href="#udsHome" aria-label="UP AND DOWN, inicio">
        <svg viewBox="0 0 1919 633" aria-hidden="true" focusable="false">
          <path d="M 1918 573 L 1904 569 L 1809 588 L 1686 599 L 1532 592 L 1346 552 L 1103 476 L 1103 216 L 1351 136 L 1364 126 L 1106 5 L 1084 0 L 1075 5 L 1072 468 L 960 443 L 863 432 L 774 430 L 641 440 L 442 480 L 124 574 L 9 596 L 0 610 L 15 617 L 118 601 L 551 492 L 670 474 L 755 469 L 892 474 L 1004 492 L 1343 594 L 1436 615 L 1548 630 L 1655 632 L 1751 623 L 1913 587 Z" fill="currentColor" />
        </svg>
      </a>

      <nav className="uds-native-mobile-actions" aria-label="Acciones rápidas">
        <button type="button" aria-label="Buscar" onClick={() => clickLegacyControl("udsSearchTop")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
        </button>
        <button type="button" aria-label="Carrito" onClick={() => clickLegacyControl("udsCartButton")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
        </button>
        <button type="button" aria-label="Menú" onClick={() => clickLegacyControl("udsMenuButton")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </nav>
    </header>
  );
}
