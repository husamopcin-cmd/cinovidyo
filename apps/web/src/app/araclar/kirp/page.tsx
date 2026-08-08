"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TopBar from "../../../components/TopBar";
import {
  TranscodeCancelledError,
  TranscodeUnsupportedError,
  analyze,
  compress,
  formatBytes,
  formatDuration,
  checkSupport,
  type CompressOptions,
  type MediaInfo,
  type SupportInfo,
} from "../../../lib/transcode";
import { putAsset, saveProject } from "../../../lib/store";
import { DEFAULT_SUBTITLE_STYLE, newId, type Asset, type Project } from "../../../lib/types";
import { planFromAssets } from "../../../lib/planner";

type Phase = "bekliyor" | "analiz" | "hazir" | "calisiyor" | "bitti";

export default function Kirp() {
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("bekliyor");
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  /** "oran" = en-boy oranı kırpma, "zaman" = belirli bir zaman aralığını alma */
  const [mode, setMode] = useState<"oran" | "zaman">("oran");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url?: string; sizeBytes: number; name: string; blob?: Blob } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const resultUrlRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    void checkSupport().then(setSupport);
  }, []);

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  function currentOptions(): CompressOptions {
    // Zaman modunda çözünürlüğe dokunulmaz; yalnızca seçilen aralık alınır.
    if (mode === "zaman") {
      return {
        maxDimension: null,
        videoBitrate: info ? info.bitrateBps : 2_500_000,
        audioBitrate: 128_000,
        trimStartSec: trimStart,
        trimEndSec: trimEnd,
        container: "mp4",
      };
    }

    let cropWidth = 1080;
    let cropHeight = 1920;

    if (aspect === "1:1") {
      cropWidth = 1080;
      cropHeight = 1080;
    } else if (aspect === "16:9") {
      cropWidth = 1920;
      cropHeight = 1080;
    }

    return {
      maxDimension: null,
      videoBitrate: info ? info.bitrateBps : 2_500_000,
      audioBitrate: 128_000,
      cropWidth,
      cropHeight,
      fit: "cover",
      container: "mp4",
    };
  }

  async function pickFile(f: File | undefined) {
    if (!f) return;
    setError("");
    setResult(null);
    setProgress(0);
    setFile(f);
    setPhase("analiz");
    try {
      const media = await analyze(f);
      setInfo(media);
      // Zaman aralığı varsayılanı: videonun tamamı.
      setTrimStart(0);
      setTrimEnd(Math.round(media.durationSec * 10) / 10);
      setPhase("hazir");
    } catch (err) {
      setInfo(null);
      setPhase("bekliyor");
      setError(err instanceof Error ? err.message : "Dosya çözümlenemedi.");
    }
  }

  async function sendToStudio() {
    if (!result?.blob) return;
    setError("");
    setPhase("calisiyor");
    try {
      const projectId = newId("prj");
      const assetId = newId("ast");
      
      const asset: Asset = {
        id: assetId,
        projectId,
        name: result.name,
        mime: result.blob.type || "video/mp4",
        kind: "video",
        blob: result.blob,
        createdAt: new Date().toISOString(),
      };
      await putAsset(asset);
      
      const scenes = planFromAssets([asset], 8);
      
      const now = new Date().toISOString();
      const project: Project = {
        id: projectId,
        name: "Kırpılmış Video",
        source: "video",
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
      setError(err instanceof Error ? err.message : "Stüdyoya aktarılırken hata oluştu.");
      setPhase("bitti");
    }
  }

  async function start() {
    if (!file || !info) return;
    setError("");
    setProgress(0);
    setPhase("calisiyor");
    cancelRef.current = { cancelled: false };

    try {
      const res = await compress(
        file,
        currentOptions(),
        { onProgress: setProgress, signal: cancelRef.current },
        info
      );

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
      
      let url: string | undefined;
      if (res.blob) {
        url = URL.createObjectURL(res.blob);
        resultUrlRef.current = url;
      }

      const base = file.name.replace(/\.[^.]+$/, "");
      const ek = mode === "zaman" ? "-kesit" : "-kirpildi";
      setResult({ url, sizeBytes: res.sizeBytes, name: `${base}${ek}.mp4`, blob: res.blob });
      setPhase("bitti");
    } catch (err) {
      setPhase("hazir");
      if (err instanceof TranscodeCancelledError) {
        setError("İşlem iptal edildi.");
      } else if (err instanceof TranscodeUnsupportedError) {
        setError(err.message);
      } else {
        setError(`İşlem başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`);
      }
    }
  }

  return (
    <>
      <TopBar />
      <main className="shell stack" style={{ maxWidth: 780 }}>
        <div>
          <Link href="/araclar" className="tiny">
            ← Araçlar
          </Link>
          <h1 className="h2" style={{ marginTop: 8, fontSize: "1.6rem" }}>
            Video Kırpıcı
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            İki şekilde kırpabilirsin: <strong>görüntü oranı</strong> (yatay videoyu dikey/kare
            yap) veya <strong>zaman aralığı</strong> (videonun sadece istediğin bölümünü al).
          </p>
        </div>

        {support && !support.supported && (
          <div className="notice notice-error">{support.reason}</div>
        )}

        {support?.supported && (
          <>
            <div className="card stack">
              <div className="section-title">1 · Dosya seç</div>
              <div className="dropzone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>✂️</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {file ? file.name : "Kırpılacak videoyu seç"}
                </div>
                <div className="tiny" style={{ marginTop: 4 }}>
                  {file ? `${formatBytes(file.size)}` : "MP4, MOV, WebM, MKV"}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {phase === "analiz" && (
                <div className="row tiny">
                  <span className="spin" /> Dosya çözümleniyor…
                </div>
              )}
              {info && (
                <div className="notice">
                  <strong>{info.width}×{info.height}</strong> · {formatDuration(info.durationSec)} · {formatBytes(info.sizeBytes)}
                </div>
              )}
              {/* Analiz hatası burada gösterilir: dosya çözülemediğinde info null
                  olduğu için aşağıdaki adımlar hiç çizilmez; hata orada kalsaydı
                  kullanıcı hiçbir açıklama görmeden tıkanırdı. */}
              {error && !info && <div className="notice notice-error">{error}</div>}
            </div>

            {info && (
              <div className="card stack">
                <div className="section-title">2 · Ne yapmak istiyorsun?</div>
                <div className="stack" style={{ gap: 16 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <label
                      className={`scene-item ${mode === "oran" ? "active" : ""}`}
                      style={{ flex: 1, cursor: "pointer", textAlign: "center" }}
                    >
                      <input
                        type="radio"
                        name="kirpModu"
                        checked={mode === "oran"}
                        onChange={() => setMode("oran")}
                      />
                      <strong>🖼️ Görüntü oranı</strong>
                      <div className="tiny">Yatayı dikey yap, kareye çevir</div>
                    </label>
                    <label
                      className={`scene-item ${mode === "zaman" ? "active" : ""}`}
                      style={{ flex: 1, cursor: "pointer", textAlign: "center" }}
                    >
                      <input
                        type="radio"
                        name="kirpModu"
                        checked={mode === "zaman"}
                        onChange={() => setMode("zaman")}
                      />
                      <strong>⏱️ Zaman aralığı</strong>
                      <div className="tiny">Sadece istediğin bölümü al</div>
                    </label>
                  </div>

                  {mode === "zaman" && (
                    <div className="stack" style={{ gap: 12 }}>
                      <div>
                        <label className="label">Başlangıç: {formatDuration(trimStart)}</label>
                        <input
                          type="range"
                          className="range"
                          min={0}
                          max={Math.max(0, info.durationSec - 0.5)}
                          step={0.1}
                          value={trimStart}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setTrimStart(v);
                            // Başlangıç bitişi geçemez; en az 0.5 sn aralık kalsın.
                            if (v >= trimEnd - 0.5) {
                              setTrimEnd(Math.min(info.durationSec, v + 0.5));
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="label">Bitiş: {formatDuration(trimEnd)}</label>
                        <input
                          type="range"
                          className="range"
                          min={0.5}
                          max={Math.round(info.durationSec * 10) / 10}
                          step={0.1}
                          value={trimEnd}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setTrimEnd(v);
                            if (v <= trimStart + 0.5) {
                              setTrimStart(Math.max(0, v - 0.5));
                            }
                          }}
                        />
                      </div>
                      <div className="notice notice-ok">
                        Seçilen aralık: <strong>{formatDuration(trimEnd - trimStart)}</strong>{" "}
                        ({formatDuration(trimStart)} → {formatDuration(trimEnd)})
                        <div className="tiny" style={{ marginTop: 4 }}>
                          Çözünürlük ve en-boy oranı değişmez; yalnızca bu aralık alınır.
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === "oran" && (
                  <div>
                    <label className="label">Hedef Format</label>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <label className={`scene-item ${aspect === "9:16" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer", textAlign: "center" }}>
                        <input type="radio" name="aspect" checked={aspect === "9:16"} onChange={() => setAspect("9:16")} />
                        <strong>📱 Dikey (9:16)</strong>
                        <div className="tiny">Tiktok, Reels, Shorts</div>
                      </label>
                      <label className={`scene-item ${aspect === "1:1" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer", textAlign: "center" }}>
                        <input type="radio" name="aspect" checked={aspect === "1:1"} onChange={() => setAspect("1:1")} />
                        <strong>🔲 Kare (1:1)</strong>
                        <div className="tiny">Instagram Feed</div>
                      </label>
                      <label className={`scene-item ${aspect === "16:9" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer", textAlign: "center" }}>
                        <input type="radio" name="aspect" checked={aspect === "16:9"} onChange={() => setAspect("16:9")} />
                        <strong>📺 Yatay (16:9)</strong>
                        <div className="tiny">YouTube, Web</div>
                      </label>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}

            {info && (
              <div className="card stack">
                <div className="section-title">3 · Başlat</div>
                {phase !== "calisiyor" ? (
                  <button className="btn btn-primary btn-lg" onClick={() => void start()}>
                    {mode === "zaman" ? "Aralığı Kes ve Kaydet" : "Videoyu Kırp"}
                  </button>
                ) : (
                  <>
                    <div className="progress">
                      <div style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <div className="row">
                      <span className="tiny">%{Math.round(progress * 100)} tamamlandı</span>
                      <div className="spacer" />
                      <button className="btn btn-sm btn-danger" onClick={() => { cancelRef.current.cancelled = true; }}>
                        İptal
                      </button>
                    </div>
                  </>
                )}
                {error && <div className="notice notice-error">{error}</div>}
                {result && phase === "bitti" && (
                  <div className="stack" style={{ gap: 12 }}>
                    <div className="notice notice-ok">
                      Kırpma tamamlandı! ({formatBytes(result.sizeBytes)})
                    </div>
                    {result.url && (
                      <>
                        <video src={result.url} controls style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 400 }} />
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <a className="btn btn-primary" style={{ flex: 1, textAlign: "center" }} href={result.url} download={result.name}>
                            ⬇️ Videoyu İndir
                          </a>
                          <button
                            className="btn"
                            style={{ flex: 1 }}
                            onClick={() => {
                              setPhase("bekliyor");
                              setFile(null);
                              setInfo(null);
                              setResult(null);
                            }}
                          >
                            🔄 Yeni Video
                          </button>
                          <button
                            className="btn" style={{ flex: 1 }}
                            onClick={() => void sendToStudio()}
                          >
                            🎬 Stüdyoya Git
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
