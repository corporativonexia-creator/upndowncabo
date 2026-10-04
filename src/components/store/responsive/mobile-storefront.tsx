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
        .uds-device-ux--mobile #updown-store>.uds-header{display:none!important}

        .uds-native-mobile-header{
          position:fixed;top:0;left:0;right:0;z-index:2147483000;height:58px;margin:0;padding:0 12px;
          display:flex;align-items:center;justify-content:space-between;gap:12px;
          background:rgba(248,246,242,.82);color:#143E35;border-bottom:1px solid rgba(20,62,53,.12);
          box-shadow:0 8px 24px rgba(20,62,53,.08);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);
        }
        .uds-native-mobile-logo{width:76px;height:34px;display:flex;align-items:center;justify-content:flex-start;color:#143E35;text-decoration:none;flex:0 0 auto}
        .uds-native-mobile-logo svg{display:block;width:72px;height:28px}
        .uds-native-mobile-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
        .uds-native-mobile-actions button{width:38px;height:38px;padding:0;display:grid;place-items:center;border:1px solid rgba(20,62,53,.12);border-radius:999px;background:rgba(255,255,255,.68);color:#143E35;box-shadow:none;cursor:pointer}
        .uds-native-mobile-actions svg,.uds-native-search-bar svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

        .uds-native-search{position:fixed;inset:0;z-index:2147483640;background:#0b0d0c;color:#f7f7f5;padding:24px 22px;overflow:auto}
        .uds-native-search-bar{display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.18);padding:18px 38px 14px 0;margin-right:30px}
        .uds-native-search-bar input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:600 30px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:0}
        .uds-native-search-bar input::placeholder{color:#6f706f}
        .uds-native-search-clear,.uds-native-search-close{border:0;background:transparent;color:#d6d7d5;font:400 36px/1 system-ui;cursor:pointer;padding:0}
        .uds-native-search-clear{font-size:28px;color:#4d7fc1}
        .uds-native-search-close{position:absolute;right:24px;top:22px}
        .uds-native-search-body{padding-top:50px}
        .uds-native-search-label{font:500 17px/1.2 system-ui;color:#747674;margin-bottom:18px}
        .uds-native-search-links{display:flex;flex-direction:column;gap:0}
        .uds-native-search-links button{display:flex;align-items:center;gap:14px;width:100%;padding:16px 0;border:0;background:transparent;color:#e7e8e6;text-align:left;font:700 18px/1.25 system-ui;cursor:pointer}
        .uds-native-search-links button>span{display:block}
        .uds-native-search-empty{padding:14px 0;color:#818381;font:500 16px/1.4 system-ui}

        .uds-native-menu{position:fixed;inset:0;z-index:2147483630;background:#faf9f6;color:#163f36;padding:18px 16px 28px;overflow:auto}
        .uds-native-menu-head{display:flex;align-items:center;justify-content:space-between;padding:6px 0 14px;border-bottom:1px solid rgba(20,62,53,.12);letter-spacing:.12em;font:700 14px/1.2 system-ui}
        .uds-native-menu-head button{width:38px;height:38px;border:1px solid rgba(20,62,53,.12);border-radius:999px;background:#fff;color:#163f36;font-size:24px;line-height:1;cursor:pointer}
        .uds-native-menu-search{margin:16px 0;width:100%;display:flex;align-items:center;justify-content:space-between;padding:16px 14px;border:1px solid rgba(20,62,53,.12);border-radius:16px;background:#fff;color:#65736f;text-align:left;font:500 16px/1.2 system-ui}
        .uds-native-menu-shortcuts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
        .uds-native-menu-shortcuts button,.uds-native-menu-shortcuts a{min-height:78px;padding:13px;border:1px solid rgba(20,62,53,.12);border-radius:16px;background:#fff;color:#163f36;text-decoration:none;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;text-align:left}
        .uds-native-menu-shortcuts small{font:600 9px/1.2 Georgia,serif;letter-spacing:.12em;color:#82908c}
        .uds-native-menu-shortcuts strong{font:700 15px/1.2 Georgia,serif}
        .uds-native-menu-list{border-top:1px solid rgba(20,62,53,.12)}
        .uds-native-menu-list button{width:100%;display:flex;justify-content:space-between;align-items:center;padding:17px 0;border:0;border-bottom:1px solid rgba(20,62,53,.12);background:transparent;color:#163f36;font:700 15px/1.25 Georgia,serif;text-align:left;cursor:pointer}
        .uds-native-menu-foot{margin-top:28px;padding-top:18px;border-top:1px solid rgba(20,62,53,.12);color:#71807c;font:500 12px/1.5 Georgia,serif}

        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:58px!important}
      `}</style>
      <MobileHeader />
      {children}
    </div>
  );
}
