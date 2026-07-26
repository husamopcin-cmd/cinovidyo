"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, #7c3aed 0%, #4f46e5 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-5 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, #2563eb 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Logo & brand */}
      <div
        className={`flex flex-col items-center gap-4 z-10 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-2 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            boxShadow: "0 0 40px rgba(124,58,237,0.5)",
          }}
        >
          🎬
        </div>

        <h1 className="text-6xl font-black tracking-tight gradient-text">CinoVidyo</h1>
        <p className="text-xl text-gray-400 text-center max-w-md leading-relaxed">
          Görsellerinizden{" "}
          <span className="text-violet-400 font-semibold">saniyeler içinde</span>{" "}
          9:16 dikey, altyazılı MP4 video oluşturun
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {["Sürükle & Bırak", "Gerçek Render", "MP4 İndir", "9:16 Dikey"].map((f) => (
            <span
              key={f}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.3)",
                color: "#a78bfa",
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 mt-8">
          <Link
            href="/projects"
            className="px-6 py-3 rounded-xl font-semibold text-gray-300 hover:text-white transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            📁 Projelerim
          </Link>
          <Link href="/new" className="btn-glow px-8 py-3 rounded-xl font-bold text-white">
            ✨ Yeni Video Oluştur
          </Link>
        </div>

        {/* Stats */}
        <div className="flex gap-8 mt-12 text-center opacity-50">
          <div>
            <p className="text-2xl font-bold">9:16</p>
            <p className="text-xs text-gray-500">Dikey Format</p>
          </div>
          <div className="w-px bg-gray-700" />
          <div>
            <p className="text-2xl font-bold">5</p>
            <p className="text-xs text-gray-500">Max Görsel</p>
          </div>
          <div className="w-px bg-gray-700" />
          <div>
            <p className="text-2xl font-bold">30s</p>
            <p className="text-xs text-gray-500">Max Süre</p>
          </div>
        </div>
      </div>
    </div>
  );
}
