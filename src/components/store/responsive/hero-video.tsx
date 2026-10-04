"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HERO_POSTER = "https://assets.cdn.filesafe.space/8Lo9S9qjQlin7rbzFWW8/media/6a95dadd02832ae8617d41f5.jpg";

export function HeroVideo() {
  const [hero, setHero] = useState<Element | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setHero(document.querySelector("#updown-store .uds-hero"));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      const result = video.play();
      if (result && typeof result.catch === "function") result.catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };

    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tryPlay);
    window.addEventListener("pointerdown", tryPlay, { once: true });
    tryPlay();

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tryPlay);
      window.removeEventListener("pointerdown", tryPlay);
    };
  }, [hero]);

  return (
    <>
      <style>{`
        #updown-store .uds-hero{
          position:relative!important;
          overflow:hidden!important;
          isolation:isolate!important;
        }

        #updown-store .uds-hero-video{
          position:absolute!important;
          inset:0!important;
          display:block!important;
          z-index:0!important;
          width:100%!important;
          height:100%!important;
          min-width:100%!important;
          min-height:100%!important;
          max-width:none!important;
          max-height:none!important;
          object-fit:cover!important;
          object-position:center 52%!important;
          transform:none!important;
          pointer-events:none!important;
          background:#0c211c;
        }

        /* Override legacy image-band dimensions so the tint has no hard edge. */
        #updown-store.uds-ux-v3 .uds-hero::after{display:none!important;content:none!important;}
        #updown-store.uds-ux-v3 .uds-hero::before{
          content:""!important;position:absolute!important;inset:0!important;
          width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
          display:block!important;z-index:1!important;opacity:1!important;
          background:linear-gradient(180deg,transparent 35%,rgba(12,33,28,.28) 100%)!important;
          transform:none!important;filter:none!important;animation:none!important;pointer-events:none!important;
        }
        #updown-store.uds-ux-v3 .uds-hero-inner{
          position:relative!important;z-index:2!important;background:transparent!important;
          box-shadow:none!important;backdrop-filter:none!important;
        }
        #updown-store.uds-ux-v3 .uds-hero-inner::before,
        #updown-store.uds-ux-v3 .uds-hero-inner::after{content:none!important;display:none!important;}
        #updown-store.uds-ux-v3 .uds-hero h1,
        #updown-store.uds-ux-v3 .uds-hero h1 span,
        #updown-store.uds-ux-v3 .uds-hero-copy{
          background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;
          color:#fffaf0!important;text-shadow:0 2px 10px rgba(12,33,28,.55)!important;
        }
        #updown-store.uds-ux-v3 .uds-hero h1{
          font-family:"Cormorant Garamond",Georgia,serif!important;font-weight:600!important;
          font-size:clamp(40px,5vw,72px)!important;line-height:1.06!important;letter-spacing:.015em!important;
        }
        #updown-store.uds-ux-v3 .uds-hero h1 span{
          font-family:"Cormorant Garamond",Georgia,serif!important;font-size:clamp(28px,3vw,42px)!important;
          font-weight:500!important;font-style:italic!important;line-height:1.15!important;letter-spacing:0!important;
        }
        #updown-store .uds-scroll-note{z-index:3!important}

        /* Mobile keeps the complete video frame; copy sits over its lower edge. */
        @media (max-width:1023px){
          #updown-store.uds-ux-v3 .uds-hero{
            width:100%!important;max-width:none!important;min-height:0!important;
            height:auto!important;margin:0!important;padding:0!important;
            display:block!important;aspect-ratio:16 / 9!important;background:#0c211c!important;
          }
          #updown-store.uds-ux-v3 .uds-hero-video{
            position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
            min-width:0!important;min-height:0!important;max-width:100%!important;max-height:none!important;
            object-fit:contain!important;object-position:center!important;transform:none!important;
          }
          #updown-store.uds-ux-v3 .uds-hero::before{
            display:block!important;content:""!important;inset:0!important;z-index:1!important;
            width:100%!important;height:100%!important;filter:none!important;
            background:linear-gradient(180deg,transparent 45%,rgba(12,33,28,.24) 100%)!important;
          }
          #updown-store.uds-ux-v3 .uds-hero::after{display:none!important;content:none!important;}
          .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero-inner{
            position:absolute!important;inset:auto 0 0!important;z-index:2!important;
            width:100%!important;max-width:none!important;box-sizing:border-box!important;
            margin:0!important;padding:10px 18px 14px!important;background:transparent!important;
          }
          .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero h1{
            margin:0 0 8px!important;font-size:clamp(25px,6.4vw,38px)!important;line-height:1.04!important;letter-spacing:0!important;
          }
          .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero h1 span{
            margin:5px 0 0!important;font-size:clamp(19px,4.8vw,28px)!important;line-height:1.1!important;font-style:italic!important;
          }
          .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero-copy{
            width:100%!important;max-width:none!important;margin:0!important;
            font-size:clamp(11px,2.8vw,13px)!important;font-weight:500!important;line-height:1.45!important;letter-spacing:.015em!important;color:#fffaf0!important;
          }
          #updown-store.uds-ux-v3 .uds-hero-actions,
          #updown-store.uds-ux-v3 .uds-scroll-note{display:none!important;}
        }

        @media (min-width:1024px){
          #updown-store .uds-hero{
            width:100%!important;
            max-width:none!important;
          }
          #updown-store .uds-hero-video{
            width:100%!important;
            height:100%!important;
            object-position:center 52%!important;
          }
        }
      `}</style>

      {hero
        ? createPortal(
            <video
              ref={videoRef}
              className="uds-hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={HERO_POSTER}
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src="/assets/hero-cabo.mp4?v=7" type="video/mp4" />
            </video>,
            hero,
          )
        : null}
    </>
  );
}

