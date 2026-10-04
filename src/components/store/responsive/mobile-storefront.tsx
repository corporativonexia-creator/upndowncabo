"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { MobileHeader } from "./mobile-header";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.getElementById("udsMobileCatalogPager58")?.remove();
  }, []);

  return (
    <div className="uds-device-ux uds-device-ux--mobile" data-storefront-ux="mobile">
      <style>{`
        html,body{margin:0!important;padding:0!important;overflow-x:clip!important}
        .uds-device-ux--mobile{margin:0!important;padding:0!important;overflow:visible!important;transform:none!important;contain:none!important}
        .uds-device-ux--mobile .uds-announcement{display:none!important}
        .uds-device-ux--mobile #updown-store{margin:0!important;padding:0!important;overflow-x:clip!important;overflow-y:visible!important;transform:none!important;contain:none!important;perspective:none!important;filter:none!important}

        /* Legacy header remains in the DOM only as a control host for the runtime. */
        .uds-device-ux--mobile #updown-store>.uds-header{display:none!important}

        .uds-native-mobile-header{
          position:fixed;
          top:0;
          left:0;
          right:0;
          z-index:2147483000;
          height:58px;
          margin:0;
          padding:0 12px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          background:rgba(248,246,242,.82);
          color:#143E35;
          border-bottom:1px solid rgba(20,62,53,.12);
          box-shadow:0 8px 24px rgba(20,62,53,.08);
          backdrop-filter:blur(18px) saturate(140%);
          -webkit-backdrop-filter:blur(18px) saturate(140%);
        }
        .uds-native-mobile-logo{
          width:76px;
          height:34px;
          display:flex;
          align-items:center;
          justify-content:flex-start;
          color:#143E35;
          text-decoration:none;
          flex:0 0 auto;
        }
        .uds-native-mobile-logo svg{display:block;width:72px;height:28px}
        .uds-native-mobile-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
        .uds-native-mobile-actions button{
          width:38px;
          height:38px;
          padding:0;
          display:grid;
          place-items:center;
          border:1px solid rgba(20,62,53,.12);
          border-radius:999px;
          background:rgba(255,255,255,.68);
          color:#143E35;
          box-shadow:none;
          cursor:pointer;
        }
        .uds-native-mobile-actions svg{
          width:18px;
          height:18px;
          fill:none;
          stroke:currentColor;
          stroke-width:1.8;
          stroke-linecap:round;
          stroke-linejoin:round;
        }

        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:58px!important}
      `}</style>
      <MobileHeader />
      {children}
    </div>
  );
}
