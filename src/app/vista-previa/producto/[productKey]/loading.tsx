import "@/components/store/product-detail.css";

/** Visible immediately during a Next.js route transition; no product data exposed. */
export default function LoadingProduct() {
  return <main className="ud-product-loading" role="status" aria-live="polite" aria-label="Cargando ficha del producto">
    <header className="ud-product-loading-top">
      <strong>UP AND DOWN <span>CABO · GOLF SHOP</span></strong>
      <span>Preparando ficha del producto…</span>
    </header>
    <div className="ud-product-loading-wrap">
      <div className="ud-product-loading-breadcrumb" />
      <div className="ud-product-loading-card">
        <div className="ud-product-loading-photo" />
        <div className="ud-product-loading-copy">
          <div className="ud-product-loading-line is-small" />
          <div className="ud-product-loading-line is-title" />
          <div className="ud-product-loading-line is-title-short" />
          <div className="ud-product-loading-line is-price" />
          <div className="ud-product-loading-grid">
            <div /><div /><div /><div />
          </div>
          <div className="ud-product-loading-line is-action" />
        </div>
      </div>
    </div>
  </main>;
}
