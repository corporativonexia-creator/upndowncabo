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

        /* Mobile first: full-bleed video, readable copy and no artificial width. */
        @media (max-width:1023px){
          #updown-store .uds-hero{
            width:100%!important;
            max-width:none!important;
            min-height:600px!important;
            margin:0!important;
            display:flex!important;
            align-items:flex-end!important;
          }
          #updown-store .uds-hero-video{
            left:0!important;
            right:0!important;
            width:100%!important;
            height:100%!important;
            min-width:100%!important;
            min-height:100%!important;
            object-fit:cover!important;
            object-position:46% 50%!important;
            transform:none!important;
          }
          #updown-store .uds-hero::before{
            width:100%!important;
            left:0!important;
            right:0!important;
            transform:none!important;
            background:
              linear-gradient(180deg,
                rgba(5,19,15,0) 0%,
                rgba(5,19,15,.03) 28%,
                rgba(5,19,15,.16) 48%,
                rgba(5,19,15,.64) 70%,
                rgba(5,19,15,.94) 100%)!important;
          }
          #updown-store .uds-hero-inner{
            width:100%!important;
            max-width:none!important;
            box-sizing:border-box!important;
            margin:0!important;
            padding:285px 20px 42px!important;
          }
          #updown-store .uds-hero h1{
            margin-top:10px!important;
            margin-bottom:14px!important;
          }
          #updown-store .uds-hero-copy{margin-top:0!important}
          #updown-store .uds-hero-actions{margin-top:22px!important}
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
