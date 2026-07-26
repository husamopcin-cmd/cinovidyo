"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import TopBar from "../../components/TopBar";
import { extractPdfText } from "../../lib/pdf";
import { planFromAssets, planFromText } from "../../lib/planner";
import { putAsset, saveProject } from "../../lib/store";
import {
  DEFAULT_SUBTITLE_STYLE,
  newId,
  type Asset,
  type Project,
  type Scene,
} from "../../lib/types";

type Mode = "text" | "pdf" | "images" | "video" | "chat";

const MODES: Array<{ id: Mode; icon: string; title: string; desc: string }> = [
  { id: "text", icon: "📝", title: "Metin / Hikaye", desc: "Yazdığın metni sahnelere böleyim." },
  { id: "pdf", icon: "📄", title: "PDF / Ders notu", desc: "PDF'ten metni çıkarıp anlatayım." },
  { id: "images", icon: "🖼️", title: "Görseller", desc: "Fotoğraflarını hareketli videoya çevireyim." },
  { id: "video", icon: "🎬", title: "Hazır video", desc: "Videonun üstüne altyazı ve müzik ekleyeyim." },
  { id: "chat", icon: "💬", title: "Boş proje", desc: "Editörde AI asistanla sıfırdan kur." },
];

const TONES = [
  { id: "energetic", label: "Tempolu (Reels/TikTok)" },
  { id: "educational", label: "Anlatım / eğitim" },
  { id: "calm", label: "Sakin & sinematik" },
] as const;

export default function NewProject() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("educational");
  const [target, setTarget] = useState(30);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const accept =
    mode === "pdf" ? "application/pdf" : mode === "images" ? "image/*" : mode === "video" ? "video/*" : "";

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (mode === "images" && picked.length > 20) {
      setError("En fazla 20 görsel yükleyebilirsin.");
      setFiles(picked.slice(0, 20));
      return;
    }
    setError("");
    setFiles(mode === "images" ? picked : picked.slice(0, 1));
  }

  async function create() {
    setError("");
    setBusy(true);
    try {
      const projectId = newId("prj");
      let scenes: Scene[] = [];
      const assets: Asset[] = [];
      let source: Project["source"] = "chat";
      let sourceText = "";

      if (mode === "text") {
        if (text.trim().length < 20) throw new Error("En az 20 karakterlik bir metin yaz.");
        source = "text";
        sourceText = text;
      } else if (mode === "pdf") {
        if (files.length === 0) throw new Error("Bir PDF dosyası seç.");
        setStatus("PDF okunuyor…");
        sourceText = await extractPdfText(files[0]);
        source = "pdf";
      } else if (mode === "images" || mode === "video") {
        if (files.length === 0) throw new Error("En az bir dosya seç.");
        setStatus("Dosyalar kaydediliyor…");
        source = mode === "images" ? "images" : "video";
        for (const file of files) {
          const asset: Asset = {
            id: newId("ast"),
            projectId,
            name: file.name,
            mime: file.type,
            kind: mode === "images" ? "image" : "video",
            blob: file,
            createdAt: new Date().toISOString(),
          };
          await putAsset(asset);
          assets.push(asset);
        }
      }

      setStatus("Sahneler kuruluyor…");
      if (sourceText) {
        scenes = planFromText(sourceText, {
          tone,
          targetDuration: target > 0 ? target : undefined,
          title: name.trim() || undefined,
          maxScenes: mode === "pdf" ? 16 : 12,
        });
        if (scenes.length === 0) throw new Error("Metinden sahne çıkarılamadı.");
      } else if (assets.length > 0) {
        scenes = planFromAssets(assets, mode === "video" ? 8 : 4);
      }

      const now = new Date().toISOString();
      const project: Project = {
        id: projectId,
        name: name.trim() || defaultName(mode),
        source,
        scenes,
        chat: [],
        versions: [],
        subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
        createdAt: now,
        updatedAt: now,
      };
      await saveProject(project);
      router.push(`/editor/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proje oluşturulamadı.");
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <>
      <TopBar />
      <main className="shell" style={{ maxWidth: 880 }}>
        <h1 className="hero-title" style={{ fontSize: "2rem", margin: "26px 0 8px" }}>
          Nasıl başlayalım?
        </h1>
        <p className="lead" style={{ marginBottom: 22 }}>
          Kaynağını seç — sahneleri senin için kurayım, sonra editörde istediğin gibi değiştir.
        </p>

        <div className="grid grid-2" style={{ marginBottom: 22 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setFiles([]);
                setError("");
              }}
              className="card card-hover"
              style={{
                textAlign: "left",
                cursor: "pointer",
                borderColor: mode === m.id ? "rgba(139,92,246,0.7)" : undefined,
                background: mode === m.id ? "rgba(139,92,246,0.1)" : undefined,
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{m.title}</div>
              <div className="tiny">{m.desc}</div>
            </button>
          ))}
        </div>

        <div className="card stack">
          <div>
            <label className="label" htmlFor="pname">
              Proje adı (isteğe bağlı)
            </label>
            <input
              id="pname"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName(mode)}
            />
          </div>

          {mode === "text" && (
            <div>
              <label className="label" htmlFor="ptext">
                Metnin / hikayen
              </label>
              <textarea
                id="ptext"
                className="textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Örnek: Sabah 5'te kalkmanın 3 faydası. Birincisi, zihnin en dinç anıdır..."
              />
              <p className="tiny" style={{ marginTop: 6 }}>
                {text.trim().length} karakter — kısa bir konu yazarsan otomatik olarak çok sahneli bir akış hazırlanır.
              </p>
            </div>
          )}

          {(mode === "pdf" || mode === "images" || mode === "video") && (
            <div>
              <label className="label">Dosya</label>
              <div className="dropzone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>
                  {mode === "pdf" ? "📄" : mode === "images" ? "🖼️" : "🎬"}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {files.length > 0
                    ? `${files.length} dosya seçildi`
                    : mode === "images"
                      ? "Görselleri seç (en fazla 20)"
                      : "Dosya seç"}
                </div>
                <div className="tiny" style={{ marginTop: 4 }}>
                  Dosyalar sadece bu cihazda saklanır, internete yüklenmez.
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={accept}
                multiple={mode === "images"}
                onChange={(e) => pickFiles(e.target.files)}
              />
              {files.length > 0 && (
                <p className="tiny" style={{ marginTop: 8 }}>
                  {files.map((f) => f.name).join(", ")}
                </p>
              )}
            </div>
          )}

          {(mode === "text" || mode === "pdf") && (
            <>
              <div>
                <label className="label" htmlFor="ptone">
                  Anlatım tarzı
                </label>
                <select
                  id="ptone"
                  className="select"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                >
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pdur">
                  Hedef süre: {target > 0 ? `${target} saniye` : "otomatik"}
                </label>
                <input
                  id="pdur"
                  type="range"
                  className="range"
                  min={0}
                  max={180}
                  step={5}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </div>
            </>
          )}

          {error && <div className="notice notice-error">{error}</div>}

          <button className="btn btn-primary btn-lg" onClick={create} disabled={busy}>
            {busy ? (
              <>
                <span className="spin" /> {status || "Hazırlanıyor…"}
              </>
            ) : (
              "Projeyi oluştur →"
            )}
          </button>
        </div>
      </main>
    </>
  );
}

function defaultName(mode: Mode): string {
  switch (mode) {
    case "text":
      return "Metinden video";
    case "pdf":
      return "Ders notu videosu";
    case "images":
      return "Görsel videosu";
    case "video":
      return "Video düzenleme";
    default:
      return "Yeni proje";
  }
}
