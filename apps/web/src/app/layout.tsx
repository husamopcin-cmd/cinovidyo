import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CinoVid AI Studio — Tarayıcıda AI destekli dikey video stüdyosu",
  description:
    "Metin, PDF ders notu, görsel veya videodan 9:16 dikey video üret. Her şey tarayıcında çalışır: sunucu yok, hesap yok, ücret yok.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070510",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
