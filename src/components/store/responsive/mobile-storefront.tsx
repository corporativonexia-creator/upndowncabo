"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { MobileHeader } from "./mobile-header";
import { HeroVideo } from "./hero-video";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.getElementById("udsMobileCatalogPager58")?.remove();
  }, []);

  return (
    <div className="uds-device-ux uds-device-ux--mobile" data-storefront-ux="mobile">
      <style>{`
        html,body{margin:0!important;padding:0!important;overflow-x:clip!important}
        .uds-device-ux--mobile{--uds-mobile-header-height:64px;margin:0!important;padding:0!important;overflow:visible!important;transform:none!important;contain:none!important}
        .uds-device-ux--mobile .uds-announcement{display:none!important}
        .uds-device-ux--mobile #updown-store{margin:0!important;padding:0!important;overflow-x:clip!important;overflow-y:visible!important;transform:none!important;contain:none!important;perspective:none!important;filter:none!important}
        .uds-device-ux--mobile #updown-store>.uds-header{display:none!important}


        /* Compact mobile home: discovery remains in the DOM for header search. */
        .uds-device-ux--mobile #updown-store.uds-ux-v3 #udsExploreButton,
        .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero-actions,
        .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-discovery{
          display:none!important;
        }
        .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero-inner{
          padding-bottom:14px!important;
        }
        .uds-device-ux--mobile #updown-store.uds-ux-v3 #udsCategories{
          margin-top:0!important;
          padding-top:20px!important;
        }

        .uds-native-mobile-header{
          pointer-events:auto;
          position:fixed;top:0;left:0;right:0;z-index:2147483000;height:var(--uds-mobile-header-height);box-sizing:border-box;margin:0;padding:0 12px;
          display:flex;align-items:center;justify-content:space-between;gap:6px;
          background:rgba(248,246,242,.82);color:#143E35;border-bottom:1px solid rgba(20,62,53,.12);
          box-shadow:0 8px 24px rgba(20,62,53,.08);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);
        }
        .uds-native-mobile-logo{width:auto;min-width:0;gap:6px;height:34px;display:flex;align-items:center;justify-content:flex-start;color:#143E35;text-decoration:none;flex:0 0 auto}
        .uds-native-mobile-logo svg{display:block;width:36px;height:26px;flex:0 0 auto}
        .uds-native-mobile-wordmark{font:700 clamp(11px,3vw,14px)/1 "Cormorant Garamond",Georgia,serif;letter-spacing:.035em;white-space:nowrap}
        .uds-native-mobile-actions{pointer-events:auto;display:flex;align-items:center;gap:6px;margin-left:auto}
        .uds-native-mobile-actions button{position:relative;z-index:2;touch-action:manipulation;width:34px;height:34px;padding:0;display:grid;place-items:center;border:1px solid rgba(20,62,53,.12);border-radius:999px;background:rgba(255,255,255,.68);color:#143E35;box-shadow:none;cursor:pointer}
        .uds-native-language{display:flex;align-items:center;border:1px solid rgba(20,62,53,.15);border-radius:999px;overflow:hidden;background:rgba(255,255,255,.5)}
        .uds-native-mobile-actions .uds-native-language button{width:29px;height:32px;border:0;border-radius:0;background:transparent;font:700 10px/1 system-ui}
        .uds-native-mobile-actions .uds-native-language button[aria-pressed="true"]{background:#143e35;color:#fff}
        .uds-native-mobile-actions svg,.uds-native-search-bar svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

        @media(max-width:360px){
          .uds-native-mobile-header{padding:0 10px;gap:5px}
          .uds-native-mobile-logo{gap:4px}
          .uds-native-mobile-logo svg{width:30px}
          .uds-native-mobile-actions{gap:4px}
          .uds-native-mobile-actions button{width:30px;height:32px}
          .uds-native-mobile-actions .uds-native-language button{width:25px}
        }

        /* Mobile actions stay in order: language, GHIN, VS Golf, search, cart, menu. */
        .uds-native-mobile-header{padding:0 10px;gap:5px}
        .uds-native-mobile-logo{flex:0 1 auto;gap:4px}
        .uds-native-mobile-logo svg{width:28px;height:26px}
        .uds-native-mobile-wordmark{font-size:clamp(11px,2.9vw,14px);letter-spacing:.01em}
        .uds-native-mobile-actions{flex:0 0 auto;gap:4px}
        .uds-native-mobile-actions button{width:34px;height:36px}
        .uds-native-mobile-actions .uds-native-language button{width:27px;height:34px}
        .uds-native-mobile-actions .uds-native-service-logo{overflow:hidden;width:36px;height:36px;flex-shrink:0;background:#fff;padding:4px}
        .uds-native-service-logo img{display:block;width:100%;height:100%;object-fit:contain}
        .uds-native-mobile-actions .uds-native-service-logo.is-vs-golf{padding:0;background:#111}
        .uds-native-service-logo.is-vs-golf img{object-fit:cover}
        .uds-native-mobile-actions button:disabled{opacity:.45;cursor:wait}
        .uds-native-mobile-actions button:focus-visible{outline:2px solid #b39459;outline-offset:2px}
        @media(max-width:389px){
          .uds-device-ux--mobile{--uds-mobile-header-height:104px}
          .uds-native-mobile-header{flex-wrap:wrap;align-content:center;gap:5px;padding:8px 12px}
          .uds-native-mobile-logo{flex-basis:100%;height:28px;justify-content:center}
          .uds-native-mobile-logo svg{width:32px}
          .uds-native-mobile-wordmark{font-size:14px}
          .uds-native-mobile-actions{width:100%;justify-content:space-between;gap:5px}
          .uds-native-mobile-actions button,.uds-native-mobile-actions .uds-native-service-logo{width:40px;height:40px}
          .uds-native-mobile-actions .uds-native-language button{width:28px;height:38px}
        }
        .uds-device-ux--mobile #udsServices [data-service-card]{scroll-margin-top:calc(var(--uds-mobile-header-height) + 16px)!important}

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
        .uds-native-menu-shortcuts .uds-native-service-card{display:flex;overflow:hidden;padding:0;min-height:0;border-radius:16px;background:#fff;box-shadow:0 5px 15px rgba(20,62,53,.04)}
        .uds-native-service-media{position:relative;flex-shrink:0;width:100%;aspect-ratio:16/10;background:#e9eee7}
        .uds-native-service-media img{object-fit:cover}
        .uds-native-service-copy{position:relative;padding:12px 30px 13px 12px;width:100%;box-sizing:border-box}
        .uds-native-menu-shortcuts .uds-native-service-copy small{display:block;font:600 9px/1.4 Inter,Arial,sans-serif;letter-spacing:.06em;color:#66786e;margin-bottom:6px}
        .uds-native-menu-shortcuts .uds-native-service-copy strong{display:block;font:700 18px/1.15 "Cormorant Garamond",Georgia,serif;color:#143e35}
        .uds-native-service-copy>span{position:absolute;right:12px;bottom:13px;font-size:18px;color:#8b7648}
        .uds-native-menu-shortcuts .uds-native-service-card:last-child:nth-child(odd){grid-column:1/-1;flex-direction:row;align-items:center}
        .uds-native-menu-shortcuts .uds-native-service-card:last-child:nth-child(odd) .uds-native-service-media{width:36%;aspect-ratio:4/3}
        .uds-native-menu-shortcuts .uds-native-service-card:last-child:nth-child(odd) .uds-native-service-copy{flex:1}
        .uds-native-service-card:focus-visible{outline:3px solid #b39459;outline-offset:2px}
        .uds-native-menu-list{border-top:1px solid rgba(20,62,53,.12)}
        .uds-native-menu-list button{width:100%;display:flex;justify-content:space-between;align-items:center;padding:17px 0;border:0;border-bottom:1px solid rgba(20,62,53,.12);background:transparent;color:#163f36;font:700 15px/1.25 Georgia,serif;text-align:left;cursor:pointer}
        .uds-native-menu-foot{margin-top:28px;padding-top:18px;border-top:1px solid rgba(20,62,53,.12);color:#71807c;font:500 12px/1.5 Georgia,serif}

        /* Keep the cart close control visible below the fixed mobile header. */
        .uds-device-ux--mobile #udsCart{padding-top:var(--uds-mobile-header-height)!important}
        .uds-device-ux--mobile #udsCart .uds-cart-head{
          display:flex!important;align-items:center!important;justify-content:space-between!important;
          position:sticky!important;top:0!important;z-index:5!important;
          min-height:58px!important;padding:10px 14px!important;margin:0!important;
          background:rgba(250,249,246,.96)!important;border-bottom:1px solid rgba(20,62,53,.12)!important;
          backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;
        }
        .uds-device-ux--mobile #udsCart .uds-cart-head h3{margin:0!important;color:#163f36!important}
        .uds-device-ux--mobile #udsCloseCart{
          display:grid!important;place-items:center!important;flex:0 0 auto!important;
          width:40px!important;height:40px!important;padding:0!important;margin:0!important;
          border:1px solid rgba(20,62,53,.14)!important;border-radius:999px!important;
          background:#fff!important;color:#163f36!important;font:400 26px/1 system-ui!important;
          cursor:pointer!important;box-shadow:0 4px 14px rgba(20,62,53,.08)!important;
        }

        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:var(--uds-mobile-header-height)!important}
      `}</style>
      <MobileHeader />
      {children}
      <HeroVideo />
    </div>
  );
}

