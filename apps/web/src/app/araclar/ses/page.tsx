"use client";

import Link from "next/link";
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

type Phase = "bekliyor" | "analiz" | "hazir" | "calisiyor" | "bitti";

export default function SesAyikla() {
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("bekliyor");
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [mode, setMode] = useState<"extract" | "remove">("extract");
  const [audioBitrate, setAudioBitrate] = useState<number>(128_000);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url?: string; sizeBytes: number; name: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    void checkSupport().then(setSupport);
  }, []);

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  function currentOptions(): CompressOptions {
    if (mode === "remove") {
      return {
        maxDimension: null,
        videoBitrate: info ? info.bitrateBps : 2_500_000,
        audioBitrate: 0,
        removeAudio: true,
        container: "mp4",
      };
    } else {
      // Ses ayıklama (Video atılır)
      return {
        maxDimension: null,
        videoBitrate: 0,
        audioBitrate,
        extractAudioOnly: true,
        container: "m4a", // .m4a uzantısı için
      };
    }
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
      if (!media.hasAudio) {
        throw new Error("Bu videoda ses izi bulunmuyor.");
      }
      setPhase("hazir");
    } catch (err) {
      setInfo(null);
      setPhase("bekliyor");
      setError(err instanceof Error ? err.message : "Dosya çözümlenemedi.");
    }
  }

  async function start() {
    if (!file || !info) return;
    setError("");
    setProgress(0);
    setPhase("calisiyor");
    cancelRef.current = { cancelled: false };

    try {
      const res = await compress(file, currentOptions(), {
        onProgress: setProgress,
        signal: cancelRef.current,
      });

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
      const ext = mode === "remove" ? ".mp4" : ".m4a";
      const suffix = mode === "remove" ? "-sessiz" : "-ses";
      setResult({ url, sizeBytes: res.sizeBytes, name: `${base}${suffix}${ext}` });
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
            Ses Ayıklama ve Sessizleştirme
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Videodaki sesi yüksek kaliteli olarak dışarı çıkar (.m4a) veya videonun sesini tamamen sil.
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
                <div style={{ fontSize: 24, marginBottom: 6 }}>🎧</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {file ? file.name : "İçinde ses olan bir video seç"}
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
            </div>

            {info && (
              <div className="card stack">
                <div className="section-title">2 · İşlem Türü</div>
                <div className="stack" style={{ gap: 16 }}>
                  <div>
                    <label className="label">Ne yapmak istiyorsun?</label>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <label className={`scene-item ${mode === "extract" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer" }}>
                        <input type="radio" name="mode" checked={mode === "extract"} onChange={() => setMode("extract")} />
                        <strong>🎵 Sesi Dışarı Çıkar</strong>
                        <div className="tiny">Görüntü atılır, sadece ses (.m4a)</div>
                      </label>
                      <label className={`scene-item ${mode === "remove" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer" }}>
                        <input type="radio" name="mode" checked={mode === "remove"} onChange={() => setMode("remove")} />
                        <strong>🔇 Sesi Sil</strong>
                        <div className="tiny">Ses silinir, sessiz video (.mp4)</div>
                      </label>
                    </div>
                  </div>

                  {mode === "extract" && (
                    <div>
                      <label className="label">Ses Kalitesi</label>
                      <select className="select" value={audioBitrate} onChange={(e) => setAudioBitrate(Number(e.target.value))}>
                        <option value={320_000}>Stüdyo (320 kbps)</option>
                        <option value={192_000}>Yüksek (192 kbps)</option>
                        <option value={128_000}>Normal (128 kbps)</option>
                        <option value={64_000}>Düşük (64 kbps)</option>
                      </select>
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
                    {mode === "extract" ? "Sesi Ayıkla" : "Sesi Sil ve Kaydet"}
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
                      İşlem tamamlandı! ({formatBytes(result.sizeBytes)})
                    </div>
                    {result.url && (
                      <>
                        {mode === "extract" ? (
                          <audio src={result.url} controls style={{ width: "100%" }} />
                        ) : (
                          <video src={result.url} controls style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 400 }} />
                        )}
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <a className="btn btn-primary" style={{ flex: 1, textAlign: "center" }} href={result.url} download={result.name}>
                            ⬇️ {mode === "extract" ? "Sesi İndir" : "Videoyu İndir"}
                          </a>
                          <button
                            className="btn"
                            style={{ flex: 1, backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                            onClick={() => {
                              setPhase("bekliyor");
                              setFile(null);
                              setInfo(null);
                              setResult(null);
                            }}
                          >
                            🔄 Yeni Dosya
                          </button>
                          <Link href="/new" className="btn" style={{ flex: 1, backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
                            🎬 Stüdyoya Git
                          </Link>
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
