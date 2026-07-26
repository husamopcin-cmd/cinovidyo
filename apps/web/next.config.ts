import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 sadece server-side çalışır
  serverExternalPackages: ["better-sqlite3"],
  // Standalone output: Railway için optimize
  output: "standalone",
};

export default nextConfig;
