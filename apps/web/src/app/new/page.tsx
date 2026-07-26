"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TEMPLATES = [
  { id: "emlak", label: "🏠 Emlak İlanı", desc: "Dış cephe → Salon → Mutfak → Kapanis" },
  { id: "urun", label: "🛍️ Ürün Tanıtımı", desc: "Hero → Problem → Özellikler → CTA" },
  { id: "dugun", label: "💍 Düğün", desc: "Çift hero → Hazırlık → Tören → Kutlama" },
  { id: "yemek", label: "🍽️ Yemek Tarifi", desc: "Son ürün → Malzeme → Pişirme → Kapanis" },
  { id: "bos", label: "✏️ Boş Başla", desc: "Kendi sahne yapını oluştur" },
];

export default function NewVideo() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<15 | 30>(15);
  const [template, setTemplate] = useState("bos");
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

      router.push(`/editor/${id}`);
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
        <span className="text-xs text-gray-600">CinoVidyo</span>
      </div>

      <div className="w-full max-w-2xl fade-in">
        <h1 className="text-3xl font-black mb-1 gradient-text">Yeni Video Projesi</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Görsellerinizi yükleyip saniyeler içinde gerçek MP4 oluşturun
        </p>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Proje adı */}
          <div className="glass-card p-5">
            <label className="block mb-2 text-sm font-semibold text-gray-300">
              Proje Adı
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 p-3 rounded-lg text-white placeholder-gray-600 outline-none transition-all"
              placeholder="Örn: Tatil Vlog, Ürün Lansmanı..."
            />
          </div>

          {/* Süre */}
          <div className="glass-card p-5">
            <label className="block mb-3 text-sm font-semibold text-gray-300">
              Video Süresi
            </label>
            <div className="flex gap-3">
              {([15, 30] as const).map((d) => (
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
                    boxShadow: duration === d ? "0 0 20px rgba(124,58,237,0.3)" : "none",
                  }}
                >
                  {d} Saniye
                </button>
              ))}
            </div>
          </div>

          {/* Şablon seçimi */}
          <div className="glass-card p-5">
            <label className="block mb-3 text-sm font-semibold text-gray-300">
              Başlangıç Şablonu
            </label>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-start gap-3"
                  style={{
                    background:
                      template === t.id
                        ? "rgba(124,58,237,0.15)"
                        : "rgba(255,255,255,0.03)",
                    border:
                      template === t.id
                        ? "1px solid rgba(124,58,237,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-200">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                  </div>
                  {template === t.id && (
                    <span className="text-violet-400 text-xs font-bold mt-0.5">✓</span>
                  )}
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
                Proje Oluşturuluyor...
              </span>
            ) : (
              "🎬 Projeyi Oluştur ve Editöre Geç"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
