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

        /* One premium overlay across the whole hero. The legacy ::after block
           was masking the lower half of the video on mobile. */
        #updown-store .uds-hero::after{
          display:none!important;
          content:none!important;
        }
        #updown-store .uds-hero::before{
          content:""!important;
          position:absolute!important;
          inset:0!important;
          display:block!important;
          z-index:1!important;
          background:
            linear-gradient(180deg,
              rgba(5,19,15,.02) 0%,
              rgba(5,19,15,.04) 30%,
              rgba(5,19,15,.18) 55%,
              rgba(5,19,15,.62) 78%,
              rgba(5,19,15,.88) 100%),
            linear-gradient(90deg,
              rgba(5,19,15,.34) 0%,
              rgba(5,19,15,.08) 56%,
              rgba(5,19,15,.02) 100%)!important;
          transform:none!important;
          animation:none!important;
          pointer-events:none!important;
        }

        #updown-store .uds-hero-inner{
          position:relative!important;
          z-index:2!important;
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
            background:linear-gradient(180deg,rgba(5,19,15,0) 20%,rgba(5,19,15,.08) 40%,rgba(5,19,15,.78) 100%)!important;
          }
          #updown-store.uds-ux-v3 .uds-hero::after{display:none!important;content:none!important;}
          .uds-device-ux--mobile #updown-store.uds-ux-v3 .uds-hero-inner{
            position:absolute!important;inset:auto 0 0!important;z-index:2!important;
            width:100%!important;max-width:none!important;box-sizing:border-box!important;
            margin:0!important;padding:12px 16px 14px!important;background:transparent!important;
          }
          #updown-store.uds-ux-v3 .uds-hero h1{
            margin:0 0 7px!important;font-size:clamp(19px,4.8vw,30px)!important;line-height:1.15!important;
          }
          #updown-store.uds-ux-v3 .uds-hero h1 span{
            margin:6px 0 0!important;font-size:clamp(12px,3.3vw,18px)!important;line-height:1.25!important;
          }
          #updown-store.uds-ux-v3 .uds-hero-copy{
            width:100%!important;max-width:none!important;margin:0!important;
            font-size:clamp(9px,2.4vw,12px)!important;line-height:1.5!important;color:rgba(255,255,255,.9)!important;
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

