import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CinoVidyo AI Studio — Tarayıcıda AI destekli dikey video stüdyosu",
  description:
    "Metin, PDF ders notu, görsel veya videodan 9:16 dikey video üret. Her şey tarayıcında çalışır: sunucu yok, hesap yok, ücret yok.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7fb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('cinovid-theme')==='dark'?'dark':'light'}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
