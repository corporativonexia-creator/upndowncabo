import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#143E35",
};
export const metadata: Metadata = {
  title: "UP AND DOWN · Cabo Golf Shop by Coque",
  description: "Equipo de golf nuevo, seminuevo y piezas seleccionadas con atención personalizada en Los Cabos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publicConfig = `window.__UPDOWN_SUPABASE_URL__=${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || "")};window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__=${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "")};`;
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#143E35" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: publicConfig }} />
        <script src="/updown-pos-scanner-v1.js?v=scanner-v1" defer />
        <script src="/updown-pos-autoprint-v1.js?v=pos-autoprint-v1" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
