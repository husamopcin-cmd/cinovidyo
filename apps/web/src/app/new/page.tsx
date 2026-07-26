"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const START_MODES = [
  { id: "gorsel", label: "🖼️ Görseller ile Başla", desc: "Fotoğrafları yükle, hareketli 9:16 video yap" },
  { id: "metin", label: "📝 Hikaye / Metin ile Başla", desc: "Senaryo veya hikayeyi yaz, AI sahnelere bölsün" },
  { id: "pdf", label: "📄 PDF / Ders Notu ile Başla", desc: "Ders belgeni yükle, anlatımlı eğitici video yap" },
  { id: "video", label: "📹 Hazır Video Düzenle", desc: "Kendi videona altyazı, ses ve AI efekti giydir" },
];

export default function NewVideo() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<15 | 30 | 60>(15);
  const [mode, setMode] = useState("gorsel");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Proje adı boş olamaz.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = "proj_" + Math.random().toString(36).substr(2, 9);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: name.trim(), status: "DRAFT", duration }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Proje oluşturulamadı");
      }

      router.push(`/editor/${id}?mode=${mode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 mt-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Ana Sayfa
        </Link>
        <span className="text-xs text-gray-600">CinoVidyo AI Studio</span>
      </div>

      <div className="w-full max-w-2xl fade-in">
        <h1 className="text-3xl font-black mb-1 gradient-text">Yeni Video Başlat</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Fikir, ders notu, metin veya görsellerinizden akıllı video oluşturun
        </p>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Proje adı */}
          <div className="glass-card p-5">
            <label className="block mb-2 text-sm font-semibold text-gray-300">
              Proje Başlığı
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 p-3 rounded-lg text-white placeholder-gray-600 outline-none transition-all"
              placeholder="Örn: Tarih Ders Notları, Ürün Tanıtımı, Instagram Kurgusu..."
            />
          </div>

          {/* Başlangıç Yöntemi */}
          <div className="glass-card p-5">
            <label className="block mb-3 text-sm font-semibold text-gray-300">
              Başlangıç Yöntemi
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {START_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className="text-left px-4 py-3 rounded-xl transition-all duration-200 flex flex-col justify-between"
                  style={{
                    background:
                      mode === m.id
                        ? "rgba(124,58,237,0.15)"
                        : "rgba(255,255,255,0.03)",
                    border:
                      mode === m.id
                        ? "1px solid rgba(124,58,237,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <p className="font-semibold text-sm text-gray-200">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Süre */}
          <div className="glass-card p-5">
            <label className="block mb-3 text-sm font-semibold text-gray-300">
              Hedef Video Süresi
            </label>
            <div className="flex gap-3">
              {([15, 30, 60] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200"
                  style={{
                    background:
                      duration === d
                        ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                        : "rgba(255,255,255,0.04)",
                    border:
                      duration === d
                        ? "1px solid #7c3aed"
                        : "1px solid rgba(255,255,255,0.08)",
                    color: duration === d ? "white" : "#9ca3af",
                  }}
                >
                  {d} Saniye
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-glow w-full py-4 rounded-xl font-bold text-lg tracking-wide"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Hazırlanıyor...
              </span>
            ) : (
              "🚀 Editörü Aç & AI Asistanı Başlat"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
