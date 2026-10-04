"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const HERO_POSTER = "https://assets.cdn.filesafe.space/8Lo9S9qjQlin7rbzFWW8/media/6a95dadd02832ae8617d41f5.jpg";

export function HeroVideo() {
  const [hero, setHero] = useState<Element | null>(null);

  useEffect(() => {
    setHero(document.querySelector("#updown-store .uds-hero"));
  }, []);

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
        @media (prefers-reduced-motion:reduce){
          #updown-store .uds-hero-video{display:none!important}
          #updown-store .uds-hero::before{
            background:
              linear-gradient(180deg,rgba(5,19,15,.08) 0%,rgba(5,19,15,.12) 32%,rgba(5,19,15,.82) 100%),
              linear-gradient(90deg,rgba(5,19,15,.56) 0%,rgba(5,19,15,.10) 68%),
              url("${HERO_POSTER}") center 58%/cover no-repeat!important;
          }
        }
      `}</style>
      {hero
        ? createPortal(
            <video
              className="uds-hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
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
