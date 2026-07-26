import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway ve benzeri platformlarda dinamik PORT kullan
  experimental: {
    serverExternalPackages: ["better-sqlite3"],
  },
  // Output standalone: Railway'de dosya boyutunu küçültür
  output: "standalone",
};

export default nextConfig;
