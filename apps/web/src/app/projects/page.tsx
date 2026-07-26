"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface Project {
  id: string;
  name: string;
  status: string;
  duration: number;
  date: string;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-gray-400 bg-gray-800",
  RENDERING: "text-yellow-400 bg-yellow-400/10",
  COMPLETED: "text-green-400 bg-green-400/10",
  FAILED: "text-red-400 bg-red-400/10",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  RENDERING: "Render...",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (err) {
      console.error("Projeler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" projesini silmek istediğinizden emin misiniz?`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Silme hatası:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 mt-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-white text-sm transition-colors">
              ← Ana Sayfa
            </Link>
            <span className="text-gray-700">/</span>
            <h1 className="text-2xl font-black gradient-text">Projelerim</h1>
          </div>
          <Link href="/new" className="btn-glow px-5 py-2.5 rounded-xl font-semibold text-sm">
            + Yeni Proje
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="text-6xl opacity-20">🎬</div>
            <p className="text-gray-500">Henüz proje yok.</p>
            <Link href="/new" className="btn-glow px-6 py-3 rounded-xl font-semibold text-sm">
              İlk Projeyi Oluştur
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: Project, i) => (
              <div
                key={p.id}
                className="glass-card p-5 fade-in hover:border-violet-500/30 transition-all duration-200 group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h2 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors truncate max-w-[180px]">
                    {p.name}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      STATUS_COLOR[p.status] ?? "text-gray-400 bg-gray-800"
                    }`}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-1">{p.id}</p>
                <p className="text-xs text-gray-500 mb-4">
                  {formatDate(p.date)} · {p.duration ?? 15}s
                </p>

                <div className="flex gap-2">
                  <Link
                    href={`/editor/${p.id}`}
                    className="flex-1 text-center py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                    style={{
                      background: "rgba(124,58,237,0.15)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#a78bfa",
                    }}
                  >
                    Düzenle
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    className="px-3 py-2 rounded-lg text-sm transition-all duration-200 text-gray-600 hover:text-red-400 hover:bg-red-400/10"
                  >
                    {deleting === p.id ? "..." : "🗑"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
