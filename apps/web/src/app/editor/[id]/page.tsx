"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ───────────────────────────────────────────────
interface Asset {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  mime_type: string;
}

interface Scene {
  id: string;
  assetId: string | null;
  durationInFrames: number;
  motion: string;
  transition: string;
  subtitle: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  duration: number;
  date: string;
}

// ─── Sortable Item ────────────────────────────────────────
function SortableScene({
  scene,
  index,
  assets,
  onChange,
}: {
  scene: Scene;
  index: number;
  assets: Asset[];
  onChange: (id: string, field: string, value: string | number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: scene.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const assignedAsset = assets.find((a) => a.id === scene.assetId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-card p-3 mb-3 fade-in"
      {...attributes}
    >
      {/* Drag handle + title */}
      <div
        className="flex items-center gap-2 mb-3 cursor-grab active:cursor-grabbing"
        {...listeners}
      >
        <span className="text-gray-600 select-none">⠿</span>
        <span className="text-xs font-bold text-gray-300">Sahne {index + 1}</span>
        <div className="flex-1" />
        {assignedAsset && (
          <span className="text-xs text-violet-400 truncate max-w-[100px]">
            🖼 {assignedAsset.name}
          </span>
        )}
      </div>

      {/* Controls — stop event propagation so dnd doesn't capture clicks */}
      <div
        className="space-y-2 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asset selector */}
        <select
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1.5 text-gray-300 focus:border-violet-500 outline-none"
          value={scene.assetId ?? ""}
          onChange={(e) => onChange(scene.id, "assetId", e.target.value || null)}
        >
          <option value="">— Görsel Seç —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Duration */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-12">Süre (s)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={Math.round(scene.durationInFrames / 30)}
            onChange={(e) =>
              onChange(scene.id, "durationInFrames", Number(e.target.value) * 30)
            }
            className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white focus:border-violet-500 outline-none"
          />
        </div>

        {/* Motion */}
        <select
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1.5 text-gray-300 focus:border-violet-500 outline-none"
          value={scene.motion}
          onChange={(e) => onChange(scene.id, "motion", e.target.value)}
        >
          <option value="zoom_in">🔍 Zoom In</option>
          <option value="zoom_out">🔎 Zoom Out</option>
          <option value="pan_left">⬅️ Pan Sol</option>
          <option value="pan_right">➡️ Pan Sağ</option>
          <option value="none">⏹ Sabit</option>
        </select>

        {/* Transition */}
        <select
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1.5 text-gray-300 focus:border-violet-500 outline-none"
          value={scene.transition}
          onChange={(e) => onChange(scene.id, "transition", e.target.value)}
        >
          <option value="fade">🌅 Fade Geçiş</option>
          <option value="cut">✂️ Kesme</option>
        </select>

        {/* Subtitle */}
        <input
          type="text"
          placeholder="Altyazı metni..."
          value={scene.subtitle}
          onChange={(e) => onChange(scene.id, "subtitle", e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 focus:border-violet-500 outline-none"
        />
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────
export default function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [renderStatus, setRenderStatus] = useState<
    "DRAFT" | "SAVING" | "RENDERING" | "COMPLETED" | "FAILED"
  >("DRAFT");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Load project data ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error("Proje bulunamadı");
        const data = await res.json();
        setProject(data.project);
        setAssets(data.assets ?? []);

        if (data.scenes && data.scenes.length > 0) {
          setScenes(
            data.scenes.map((s: {
              id: string;
              asset_id: string | null;
              duration_in_frames: number;
              motion: string;
              transition: string;
              subtitle: string;
            }) => ({
              id: s.id,
              assetId: s.asset_id,
              durationInFrames: s.duration_in_frames,
              motion: s.motion,
              transition: s.transition,
              subtitle: s.subtitle ?? "",
            }))
          );
        } else {
          // Default 3 sahne
          setScenes([
            { id: "s1", assetId: null, durationInFrames: 150, motion: "zoom_in", transition: "fade", subtitle: "" },
            { id: "s2", assetId: null, durationInFrames: 150, motion: "zoom_out", transition: "cut", subtitle: "" },
            { id: "s3", assetId: null, durationInFrames: 150, motion: "pan_left", transition: "fade", subtitle: "" },
          ]);
        }
      } catch (err) {
        console.error("Project load error:", err);
      } finally {
        setLoadingProject(false);
      }
    };
    load();
  }, [projectId]);

  // ── DnD ──
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setScenes((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // ── Update scene field ──
  const updateScene = (id: string, field: string, value: string | number | null) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // ── Add scene ──
  const addScene = () => {
    const newId = "s_" + Math.random().toString(36).substr(2, 6);
    setScenes((prev) => [
      ...prev,
      { id: newId, assetId: null, durationInFrames: 150, motion: "zoom_in", transition: "fade", subtitle: "" },
    ]);
  };

  // ── Remove scene ──
  const removeScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Upload images ──
  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));

    try {
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız");

      // Refresh assets
      const projRes = await fetch(`/api/projects/${projectId}`);
      const projData = await projRes.json();
      setAssets(projData.assets ?? []);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Yükleme hatası");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Save + Render ──
  const handleRender = async () => {
    setRenderStatus("SAVING");
    setRenderError(null);

    try {
      // 1. Sahneleri kaydet
      await fetch(`/api/projects/${projectId}/scenes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes }),
      });

      // 2. Render başlat
      setRenderStatus("RENDERING");
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scenes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Render başarısız");
      }

      setRenderStatus("COMPLETED");
      if (data.videoUrl) setVideoUrl(data.videoUrl);
    } catch (err) {
      setRenderStatus("FAILED");
      setRenderError(err instanceof Error ? err.message : "Render hatası");
    }
  };

  // ── Total duration ──
  const totalSeconds = scenes.reduce((acc, s) => acc + Math.round(s.durationInFrames / 30), 0);

  // ─────────────────────────────────────────────────────────
  if (loadingProject) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-gray-500 hover:text-white text-sm transition-colors">
            ← Projeler
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-bold text-sm truncate max-w-[200px]">
            {project?.name ?? projectId}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>{scenes.length} sahne</span>
          <span>·</span>
          <span>{totalSeconds}s</span>
          <span>·</span>
          <span>{assets.length}/5 görsel</span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Scenes ── */}
        <aside className="w-72 flex flex-col border-r overflow-y-auto"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
        >
          {/* Upload */}
          <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
              Görseller ({assets.length}/5)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || assets.length >= 5}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: "rgba(124,58,237,0.1)",
                border: "1px dashed rgba(124,58,237,0.4)",
                color: assets.length >= 5 ? "#6b7280" : "#a78bfa",
                cursor: assets.length >= 5 ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? (
                <>
                  <span className="inline-block w-3 h-3 border border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>📷 Görsel Yükle</>
              )}
            </button>
            {uploadError && (
              <p className="text-xs text-red-400 mt-1.5">{uploadError}</p>
            )}
            {assets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {assets.map((a) => (
                  <span
                    key={a.id}
                    className="text-xs px-2 py-0.5 rounded-full truncate max-w-[100px]"
                    style={{
                      background: "rgba(124,58,237,0.15)",
                      border: "1px solid rgba(124,58,237,0.2)",
                      color: "#a78bfa",
                    }}
                    title={a.name}
                  >
                    🖼 {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scene list */}
          <div className="p-4 flex-1">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Sahneler
              </p>
              <button
                onClick={addScene}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                + Ekle
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={scenes.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {scenes.map((scene, i) => (
                  <div key={scene.id} className="relative group">
                    <SortableScene
                      scene={scene}
                      index={i}
                      assets={assets}
                      onChange={updateScene}
                    />
                    {scenes.length > 1 && (
                      <button
                        onClick={() => removeScene(scene.id)}
                        className="absolute top-2 right-2 text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Sahneyi Sil"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </aside>

        {/* ── Center: Preview + Render ── */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          {/* Video preview area */}
          <div
            className="relative rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              width: 270,
              height: 480,
              background: "linear-gradient(145deg, #111827 0%, #030712 100%)",
              border: "2px solid rgba(255,255,255,0.06)",
              boxShadow: "0 0 60px rgba(124,58,237,0.15)",
            }}
          >
            {renderStatus === "COMPLETED" && videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full h-full object-contain"
              />
            ) : renderStatus === "RENDERING" || renderStatus === "SAVING" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-400 loading-pulse">
                  {renderStatus === "SAVING" ? "Kaydediliyor..." : "Render ediliyor..."}
                </p>
                <p className="text-xs text-gray-600">Bu 1-2 dakika sürebilir</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="text-5xl opacity-20">🎬</div>
                <p className="text-sm text-gray-500">
                  {scenes.length} sahne · {totalSeconds}s
                </p>
                <p className="text-xs text-gray-700">
                  {assets.length === 0
                    ? "Görsel yükleyip render başlatın"
                    : "Sahnelere görsel atayıp render edin"}
                </p>
              </div>
            )}

            {/* 9:16 badge */}
            <span
              className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#6b7280",
              }}
            >
              9:16
            </span>
          </div>

          {/* Render error */}
          {renderStatus === "FAILED" && renderError && (
            <div className="max-w-xs text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-center">
              ⚠️ {renderError}
            </div>
          )}

          {/* Render button */}
          <button
            onClick={handleRender}
            disabled={renderStatus === "RENDERING" || renderStatus === "SAVING"}
            className="btn-glow px-10 py-4 rounded-full font-bold text-lg min-w-[220px]"
          >
            {renderStatus === "RENDERING"
              ? "⏳ Render Ediliyor..."
              : renderStatus === "SAVING"
              ? "💾 Kaydediliyor..."
              : renderStatus === "COMPLETED"
              ? "🔄 Tekrar Render Et"
              : "▶ Videoyu Render Et"}
          </button>

          {/* Download */}
          {renderStatus === "COMPLETED" && videoUrl && (
            <a
              href={videoUrl}
              download="output.mp4"
              className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold transition-colors"
            >
              ⬇️ MP4 İndir
            </a>
          )}

          {/* Scene timeline summary */}
          {scenes.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {scenes.map((s, i) => {
                const w = Math.max(32, Math.round((s.durationInFrames / 30) * 10));
                return (
                  <div
                    key={s.id}
                    title={`Sahne ${i + 1}: ${Math.round(s.durationInFrames / 30)}s`}
                    className="h-5 rounded-md text-xs flex items-center justify-center text-gray-600 font-bold transition-all"
                    style={{
                      width: w,
                      background: s.assetId
                        ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                        : "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
