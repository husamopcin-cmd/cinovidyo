"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TopBar from "../../../components/TopBar";
import {
  PRESETS,
  TranscodeCancelledError,
  TranscodeUnsupportedError,
  analyze,
  compress,
  estimateSize,
  formatBytes,
  formatDuration,
  isAlreadySmall,
  targetDimensions,
  type CompressOptions,
  type MediaInfo,
  type PresetId,
  type SupportInfo,
} from "../../../lib/transcode";
import { checkSupport } from "../../../lib/transcode";

type Phase = "bekliyor" | "analiz" | "hazir" | "calisiyor" | "bitti";

export default function Sikistir() {
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("bekliyor");
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [preset, setPreset] = useState<PresetId>("sosyal");
  const [customBitrate, setCustomBitrate] = useState(2_000_000);
  const [customDimension, setCustomDimension] = useState(1280);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url?: string; sizeBytes: number; name: string } | null>(
    null
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    void checkSupport().then(setSupport);
  }, []);

  // Blob URL'lerini sızdırma: yeni sonuç gelince veya sayfadan çıkınca serbest bırak.
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  function currentOptions(): CompressOptions {
    if (preset === "ozel") {
      return {
        maxDimension: customDimension,
        videoBitrate: customBitrate,
        audioBitrate: 128_000,
        removeAudio,
      };
    }
    const p = PRESETS.find((x) => x.id === preset)!;
    return {
      maxDimension: p.maxDimension,
      videoBitrate: p.videoBitrate,
      audioBitrate: p.audioBitrate,
      removeAudio,
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
      setResult({ url, sizeBytes: res.sizeBytes, name: `${base}-kucuk.mp4` });
      setPhase("bitti");
    } catch (err) {
      setPhase("hazir");
      if (err instanceof TranscodeCancelledError) {
        setError("İşlem iptal edildi.");
      } else if (err instanceof TranscodeUnsupportedError) {
        setError(err.message);
      } else {
        setError(
          `Sıkıştırma başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`
        );
      }
    }
  }

  const opts = info ? currentOptions() : null;
  const estimate = info && opts ? estimateSize(info, opts) : 0;
  const dims = info && opts ? targetDimensions(info, opts.maxDimension) : null;
  const savingPct =
    info && estimate > 0 ? Math.max(0, Math.round((1 - estimate / info.sizeBytes) * 100)) : 0;

  return (
    <>
      <TopBar />
      <main className="shell stack" style={{ maxWidth: 780 }}>
        <div>
          <Link href="/araclar" className="tiny">
            ← Araçlar
          </Link>
          <h1 className="h2" style={{ marginTop: 8, fontSize: "1.6rem" }}>
            Video sıkıştır
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Büyük videoyu küçült — paylaşması kolay olsun. Dosya cihazından çıkmaz, sunucuya
            yüklenmez.
          </p>
        </div>

        {support && !support.supported && (
          <div className="notice notice-error">{support.reason}</div>
        )}

        {support?.supported && (
          <>
            {/* 1 — Dosya */}
            <div className="card stack">
              <div className="section-title">1 · Dosya seç</div>
              <div className="dropzone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🎬</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {file ? file.name : "Video dosyası seç"}
                </div>
                <div className="tiny" style={{ marginTop: 4 }}>
                  {file
                    ? `${formatBytes(file.size)}`
                    : "MP4, MOV, WebM, MKV · dosya cihazında kalır"}
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
                  <strong>
                    {info.width}×{info.height}
                  </strong>{" "}
                  · {formatDuration(info.durationSec)} · {formatBytes(info.sizeBytes)} ·{" "}
                  {(info.bitrateBps / 1_000_000).toFixed(1)} Mbps
                  {info.hasAudio ? " · sesli" : " · sessiz"}
                </div>
              )}
              {/* Analiz hatası burada gösterilir: dosya çözülemediğinde info null
                  olduğu için aşağıdaki adımlar hiç çizilmez; hata orada kalsaydı
                  kullanıcı hiçbir açıklama görmeden tıkanırdı. */}
              {error && !info && <div className="notice notice-error">{error}</div>}
            </div>

            {/* 2 — Hedef */}
            {info && (
              <div className="card stack">
                <div className="section-title">2 · Ne kadar küçülsün?</div>

                <div className="stack" style={{ gap: 8 }}>
                  {PRESETS.map((p) => (
                    <label
                      key={p.id}
                      className={`scene-item ${preset === p.id ? "active" : ""}`}
                      style={{ cursor: "pointer", alignItems: "center" }}
                    >
                      <input
                        type="radio"
                        name="preset"
                        checked={preset === p.id}
                        onChange={() => setPreset(p.id)}
                        style={{ accentColor: "var(--violet)" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</div>
                        <div className="tiny">{p.hint}</div>
                      </div>
                      <div className="tiny" style={{ whiteSpace: "nowrap" }}>
                        ~
                        {formatBytes(
                          estimateSize(info, {
                            maxDimension: p.maxDimension,
                            videoBitrate: p.videoBitrate,
                            audioBitrate: p.audioBitrate,
                            removeAudio,
                          })
                        )}
                      </div>
                    </label>
                  ))}

                  <label
                    className={`scene-item ${preset === "ozel" ? "active" : ""}`}
                    style={{ cursor: "pointer", alignItems: "center" }}
                  >
                    <input
                      type="radio"
                      name="preset"
                      checked={preset === "ozel"}
                      onChange={() => setPreset("ozel")}
                      style={{ accentColor: "var(--violet)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Özel</div>
                      <div className="tiny">Kendin ayarla</div>
                    </div>
                  </label>
                </div>

                {preset === "ozel" && (
                  <div className="stack" style={{ gap: 12 }}>
                    <div>
                      <label className="label">Uzun kenar: {customDimension} piksel</label>
                      <input
                        type="range"
                        className="range"
                        min={480}
                        max={2160}
                        step={2}
                        value={customDimension}
                        onChange={(e) => setCustomDimension(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="label">
                        Görüntü kalitesi: {(customBitrate / 1_000_000).toFixed(1)} Mbps
                      </label>
                      <input
                        type="range"
                        className="range"
                        min={200_000}
                        max={12_000_000}
                        step={100_000}
                        value={customBitrate}
                        onChange={(e) => setCustomBitrate(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}

                {info.hasAudio && (
                  <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={removeAudio}
                      onChange={(e) => setRemoveAudio(e.target.checked)}
                      style={{ accentColor: "var(--violet)" }}
                    />
                    <span className="tiny">Sesi tamamen kaldır (daha da küçülür)</span>
                  </label>
                )}

                {dims && opts && (
                  <div className={`notice ${savingPct > 0 ? "notice-ok" : ""}`}>
                    Tahmini sonuç: <strong>{formatBytes(estimate)}</strong> · {dims.width}×
                    {dims.height}
                    {savingPct > 0 && <> · yaklaşık %{savingPct} küçülme</>}
                    {isAlreadySmall(info, opts) && (
                      <div className="tiny" style={{ marginTop: 6 }}>
                        <strong>Not:</strong> Bu video zaten seçtiğin ayardan daha düşük kalitede.
                        Kaliteyi yapay olarak yükseltmiyoruz (dosyayı büyütürdü), bu yüzden kazanç
                        sınırlı olacak.
                      </div>
                    )}
                    <div className="tiny" style={{ marginTop: 4 }}>
                      Tahmindir; gerçek boyut görüntü karmaşıklığına göre değişir.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3 — Çalıştır */}
            {info && (
              <div className="card stack">
                <div className="section-title">3 · Sıkıştır</div>

                {phase !== "calisiyor" ? (
                  <button className="btn btn-primary btn-lg" onClick={() => void start()}>
                    Sıkıştırmayı başlat
                  </button>
                ) : (
                  <>
                    <div className="progress">
                      <div style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <div className="row">
                      <span className="tiny">%{Math.round(progress * 100)} tamamlandı</span>
                      <div className="spacer" />
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          cancelRef.current.cancelled = true;
                        }}
                      >
                        İptal
                      </button>
                    </div>
                    <div className="tiny">
                      Sekmeyi kapatma. Uzun videolarda bu işlem birkaç dakika sürebilir.
                    </div>
                  </>
                )}

                {error && <div className="notice notice-error">{error}</div>}

                {result && phase === "bitti" && (
                  <div className="stack" style={{ gap: 12 }}>
                    <div
                      className={`notice ${result.sizeBytes < info.sizeBytes ? "notice-ok" : "notice-error"}`}
                    >
                      Bitti — <strong>{formatBytes(result.sizeBytes)}</strong>
                      {result.sizeBytes < info.sizeBytes ? (
                        <>
                          {" "}
                          · {formatBytes(info.sizeBytes)} idi, %
                          {Math.round((1 - result.sizeBytes / info.sizeBytes) * 100)} küçüldü
                        </>
                      ) : (
                        <>
                          {" "}
                          · özgün dosya {formatBytes(info.sizeBytes)} idi —{" "}
                          <strong>bu ayar küçültmedi</strong>. Video zaten iyi sıkıştırılmış; daha
                          düşük bir hedef seç veya özgün dosyayı kullan.
                        </>
                      )}
                    </div>
                    {result.url && (
                      <>
                        <video
                          src={result.url}
                          controls
                          style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 400 }}
                        />
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
                          <Link href="/new" className="btn" style={{ flex: 1, textAlign: "center" }}>
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
