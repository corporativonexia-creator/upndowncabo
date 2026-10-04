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

    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    window.addEventListener("pageshow", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);
    document.addEventListener("pointerdown", tryPlay, { once: true, passive: true });
    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      window.removeEventListener("pageshow", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
      document.removeEventListener("pointerdown", tryPlay);
      document.removeEventListener("touchstart", tryPlay);
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
            linear-gradient(180deg,rgba(5,19,15,.08) 0%,rgba(5,19,15,.14) 34%,rgba(5,19,15,.84) 100%),
            linear-gradient(90deg,rgba(5,19,15,.58) 0%,rgba(5,19,15,.12) 68%)!important;
          transform:none!important;
          animation:none!important;
          pointer-events:none!important;
        }
        #updown-store .uds-hero::after{z-index:1!important}
        #updown-store .uds-hero-inner{z-index:2!important}
        #updown-store .uds-scroll-note{z-index:3!important}
        @media (max-width:1023px){
          #updown-store .uds-hero-video{object-position:47% 50%}
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
              <source src="/assets/hero-cabo.mp4" type="video/mp4" />
            </video>,
            hero,
          )
        : null}
    </>
  );
}
