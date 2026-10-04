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
    video.playsInline = true;

    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };

    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", tryPlay, { once: true });
    tryPlay();

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hero]);

  return (
    <>
      <style>{`
        #updown-store .uds-hero-video{
          position:absolute;
          inset:0;
          z-index:0;
          width:100%;
          height:100%;
          object-fit:cover;
          object-position:center 52%;
          pointer-events:none;
          background:#0c211c;
        }
        #updown-store .uds-hero::before{
          z-index:1!important;
          background:
            linear-gradient(180deg,rgba(5,19,15,.03) 0%,rgba(5,19,15,.10) 28%,rgba(5,19,15,.38) 56%,rgba(5,19,15,.92) 100%),
            linear-gradient(90deg,rgba(5,19,15,.48) 0%,rgba(5,19,15,.08) 72%)!important;
          transform:none!important;
          animation:none!important;
          pointer-events:none!important;
        }
        #updown-store .uds-hero::after{z-index:1!important}
        #updown-store .uds-hero-inner{z-index:2!important}
        #updown-store .uds-scroll-note{z-index:3!important}

        @media (max-width:1023px){
          #updown-store .uds-hero{
            min-height:560px!important;
            display:flex!important;
            align-items:flex-end!important;
          }
          #updown-store .uds-hero-video{
            object-position:42% 50%!important;
          }
          #updown-store .uds-hero-inner{
            width:100%!important;
            margin:0!important;
            padding:255px 18px 34px!important;
          }
          #updown-store .uds-hero h1{margin-top:12px!important;margin-bottom:14px!important}
          #updown-store .uds-hero-copy{margin-top:0!important}
          #updown-store .uds-hero-actions{margin-top:22px!important}
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
              <source src="/assets/hero-cabo.mp4?v=4" type="video/mp4" />
            </video>,
            hero,
          )
        : null}
    </>
  );
}
