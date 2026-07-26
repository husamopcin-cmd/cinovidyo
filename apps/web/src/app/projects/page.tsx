"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TopBar from "../../components/TopBar";
import { deleteProject, listProjects, storageEstimate } from "../../lib/store";
import { totalDuration, type Project } from "../../lib/types";

export default function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [quota, setQuota] = useState<{ usedMB: number; quotaMB: number } | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setQuota(await storageEstimate());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Projeler okunamadı.");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function remove(p: Project) {
    if (!confirm(`"${p.name}" projesi ve yüklediğin dosyalar silinsin mi? Bu geri alınamaz.`)) return;
    try {
      await deleteProject(p.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proje silinemedi.");
    }
  }

  return (
    <>
      <TopBar />
      <main className="shell" style={{ maxWidth: 900 }}>
        <div className="row" style={{ margin: "26px 0 18px" }}>
          <h1 className="hero-title" style={{ fontSize: "2rem" }}>
            Projelerim
          </h1>
          <div className="spacer" />
          {quota && (
            <span className="badge">
              {quota.usedMB} MB / {quota.quotaMB} MB cihaz deposu
            </span>
          )}
        </div>

        {error && (
          <div className="notice notice-error" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        {projects === null && <div className="muted">Yükleniyor…</div>}

        {projects?.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🎬</div>
            <div className="h2" style={{ marginBottom: 6 }}>
              Henüz proje yok
            </div>
            <p className="muted" style={{ marginBottom: 16 }}>
              İlk videonu oluşturmak birkaç saniye sürüyor.
            </p>
            <Link href="/new" className="btn btn-primary">
              Yeni video oluştur
            </Link>
          </div>
        )}

        <div className="stack">
          {projects?.map((p) => (
            <div key={p.id} className="card row fade-in">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{p.name}</div>
                <div className="tiny">
                  {p.scenes.length} sahne · {totalDuration(p.scenes).toFixed(1)} sn ·{" "}
                  {new Date(p.updatedAt).toLocaleString("tr-TR")}
                </div>
              </div>
              <Link href={`/editor/${p.id}`} className="btn btn-sm btn-primary">
                Aç
              </Link>
              <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>
                Sil
              </button>
            </div>
          ))}
        </div>

        <p className="tiny" style={{ marginTop: 24 }}>
          Projeler bu tarayıcının yerel deposunda (IndexedDB) tutulur. Başka cihazda görünmez;
          tarayıcı verilerini temizlersen silinir.
        </p>
      </main>
    </>
  );
}
