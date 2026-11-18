import StorefrontParity from "@/components/store/storefront-parity";
import PremiumFilterAutoCollapse from "./vista-previa/preview-filter-auto-collapse";
import PremiumDesktopSearchFocus from "./vista-previa/preview-desktop-search-focus";
import "./vista-previa/preview-header.css";
import "./vista-previa/premium-white.css";

// Public storefront stays behind src/proxy.ts's UNDER_CONSTRUCTION gate.
// UI components share only presentation; preview authorization and catalog
// mode are never enabled here.
export default function HomePage() {
  return (
    <>
      <StorefrontParity />
      <PremiumFilterAutoCollapse />
      <PremiumDesktopSearchFocus />
    </>
  );
}
