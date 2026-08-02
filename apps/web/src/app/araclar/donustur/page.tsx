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

export default function Donustur() {
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("bekliyor");
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [container, setContainer] = useState<"mp4" | "webm">("mp4");
  const [dimension, setDimension] = useState<number | "original">("original");
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
    const maxDim = dimension === "original" ? null : Number(dimension);
    return {
      maxDimension: maxDim,
      videoBitrate: info ? info.bitrateBps : 2_500_000,
      audioBitrate: 128_000,
      container,
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
      setResult({ url, sizeBytes: res.sizeBytes, name: `${base}-donusturuldu.${container}` });
      setPhase("bitti");
    } catch (err) {
      setPhase("hazir");
      if (err instanceof TranscodeCancelledError) {
        setError("İşlem iptal edildi.");
      } else if (err instanceof TranscodeUnsupportedError) {
        setError(err.message);
      } else {
        setError(`Dönüştürme başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`);
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
            Format ve Çözünürlük Dönüştürücü
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Videonu MP4 veya WebM formatına çevir, çözünürlüğünü değiştir. İşlemler tarayıcında yapılır.
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
                <div style={{ fontSize: 24, marginBottom: 6 }}>🎬</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {file ? file.name : "Video dosyası seç"}
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
                <div className="section-title">2 · Çıktı Ayarları</div>
                <div className="stack" style={{ gap: 16 }}>
                  <div>
                    <label className="label">Hedef Format</label>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <label className={`scene-item ${container === "mp4" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer" }}>
                        <input type="radio" name="format" checked={container === "mp4"} onChange={() => setContainer("mp4")} />
                        <strong>MP4</strong>
                        <div className="tiny">En iyi uyumluluk</div>
                      </label>
                      <label className={`scene-item ${container === "webm" ? "active" : ""}`} style={{ flex: 1, cursor: "pointer" }}>
                        <input type="radio" name="format" checked={container === "webm"} onChange={() => setContainer("webm")} />
                        <strong>WebM</strong>
                        <div className="tiny">Web için ideal</div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="label">Çözünürlük</label>
                    <select className="select" value={dimension} onChange={(e) => setDimension(e.target.value === "original" ? "original" : Number(e.target.value))}>
                      <option value="original">Orijinalini Koru ({info.width}x{info.height})</option>
                      <option value="2160">4K (2160p)</option>
                      <option value="1080">Full HD (1080p)</option>
                      <option value="720">HD (720p)</option>
                      <option value="480">SD (480p)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {info && (
              <div className="card stack">
                <div className="section-title">3 · Dönüştür</div>
                {phase !== "calisiyor" ? (
                  <button className="btn btn-primary btn-lg" onClick={() => void start()}>
                    Dönüştürmeyi başlat
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
                      Dönüştürme tamamlandı! ({formatBytes(result.sizeBytes)})
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
                            style={{ flex: 1, backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                            onClick={() => {
                              setPhase("bekliyor");
                              setFile(null);
                              setInfo(null);
                              setResult(null);
                            }}
                          >
                            🔄 Yeni Video
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
