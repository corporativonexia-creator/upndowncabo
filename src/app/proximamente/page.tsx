import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Próximamente · UP AND DOWN",
  description: "Nuestro sitio web abrirá próximamente. Equipo, servicios y experiencia de golf en Los Cabos.",
};

export default function ComingSoonPage() {
  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <svg viewBox="0 0 100 60" aria-hidden="true">
          <path d="M5 48 Q30 32 51 43 T95 44" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M51 42V9L72 15L51 23" fill="currentColor" />
        </svg>
        <div><strong>UP AND DOWN</strong><span>CABO GOLF SHOP BY COQUE</span></div>
      </header>
      <section className={styles.content} aria-labelledby="coming-soon-title">
        <p className={styles.eyebrow}><span /> LOS CABOS · PRÓXIMAMENTE</p>
        <h1 id="coming-soon-title">Tu próxima ronda<br />empieza <em>aquí.</em></h1>
        <p className={styles.opening}>Nuestro sitio web abrirá próximamente.</p>
        <p className={styles.description}>Estamos preparando un nuevo espacio para encontrar tu equipo, cuidar tu juego y disfrutar el golf en Los Cabos.</p>
        <a className={styles.contact} href="https://wa.me/526243554700?text=Hola%20UP%20AND%20DOWN%2C%20quiero%20informaci%C3%B3n%20sobre%20equipo%20y%20servicios%20de%20golf." target="_blank" rel="noopener noreferrer">
          Hablar con un asesor <span aria-hidden="true">↗</span>
        </a>
        <p className={styles.phone}>WhatsApp · +52 624 355 4700</p>
      </section>
      <footer className={styles.footer}><span>EQUIPO · SERVICIOS · EXPERIENCIA LOCAL</span><span>UP AND DOWN · LOS CABOS</span></footer>
    </main>
  );
}
