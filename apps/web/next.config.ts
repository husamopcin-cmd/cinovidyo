import type { NextConfig } from "next";

// CinoVid AI Studio istemci tarafında çalışır: sunucu veritabanı, disk yazımı
// veya ağır render işi yoktur. Vercel/Netlify ücretsiz katmanına uygundur.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
