"use client";

/**
 * Video işleme motoru — sıkıştırma, çözünürlük düşürme ve format dönüştürme.
 *
 * Tamamen tarayıcıda çalışır: dosya sunucuya gitmez. Donanım hızlandırmalı
 * WebCodecs (VideoEncoder/VideoDecoder) üzerinden çalıştığı için gerçek zamandan
 * çok daha hızlıdır; mediabunny demux/mux katmanını sağlar.
 *
 * Tasarım kuralı: hiçbir hata sessizce yutulmaz. Tarayıcı desteklemiyorsa
 * TranscodeUnsupportedError fırlatılır ve çağıran taraf kullanıcıya nedenini söyler.
 */

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  canEncodeVideo,
} from "mediabunny";

/* ── Hatalar ── */

/** Tarayıcı gerekli video yeteneklerini sunmuyor. */
export class TranscodeUnsupportedError extends Error {
  readonly code = "TRANSCODE_UNSUPPORTED";
}

/** Kullanıcı işlemi iptal etti — hata değil, normal akış. */
export class TranscodeCancelledError extends Error {
  readonly code = "TRANSCODE_CANCELLED";
}

/* ── Yetenek tespiti ── */

export type SupportInfo = {
  supported: boolean;
  /** desteklenmiyorsa kullanıcıya gösterilecek Türkçe açıklama */
  reason?: string;
};

/**
 * Tarayıcı video sıkıştırabiliyor mu? Arayüzü doğru çizmek için kullanılır;
 * desteklenmeyen tarayıcıda araç hiç açılmaz, kullanıcı boşuna dosya seçmez.
 */
export async function checkSupport(): Promise<SupportInfo> {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Sunucu tarafında çalıştırılamaz." };
  }
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    return {
      supported: false,
      reason:
        "Bu tarayıcı video işlemeyi (WebCodecs) desteklemiyor. Chrome, Edge veya güncel Safari kullan.",
    };
  }
  try {
    const ok = await canEncodeVideo("avc", { width: 1280, height: 720 });
    if (!ok) {
      return {
        supported: false,
        reason: "Bu tarayıcıda H.264 video kodlayıcı bulunamadı. Chrome veya Edge dene.",
      };
    }
  } catch {
    return { supported: false, reason: "Video kodlayıcı denetlenemedi." };
  }
  return { supported: true };
}

/* ── Dosya analizi ── */

export type MediaInfo = {
  /** saniye */
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  /** giriş dosyasının bayt cinsinden boyutu */
  sizeBytes: number;
  /** ortalama bit hızı (bit/sn) — dosya boyutundan hesaplanır */
  bitrateBps: number;
  hasAudio: boolean;
};

/**
 * Dosyayı okumadan tamamını belleğe almadan üstbilgisini çözer.
 * Okunamayan/bozuk dosyada açık hata fırlatır.
 */
export async function analyze(file: File): Promise<MediaInfo> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) {
      throw new Error("Dosyada video izi bulunamadı. Bu bir video dosyası mı?");
    }
    const audio = await input.getPrimaryAudioTrack();
    const durationSec = await input.computeDuration();
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error("Video süresi okunamadı; dosya bozuk olabilir.");
    }

    return {
      durationSec,
      width: video.displayWidth,
      height: video.displayHeight,
      videoCodec: video.codec,
      audioCodec: audio?.codec ?? null,
      sizeBytes: file.size,
      bitrateBps: Math.round((file.size * 8) / durationSec),
      hasAudio: !!audio,
    };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Dosya çözümlenemedi.");
  } finally {
    input.dispose();
  }
}

/* ── Sıkıştırma hedefleri ── */

export type PresetId = "whatsapp" | "sosyal" | "eposta" | "ozel";

export type Preset = {
  id: PresetId;
  label: string;
  hint: string;
  /** hedef uzun kenar (piksel); null ise çözünürlük korunur */
  maxDimension: number | null;
  /** hedef video bit hızı (bit/sn) */
  videoBitrate: number;
  /** hedef ses bit hızı (bit/sn) */
  audioBitrate: number;
};

export const PRESETS: Preset[] = [
  {
    id: "whatsapp",
    label: "WhatsApp / paylaşım",
    hint: "720p · en küçük dosya",
    maxDimension: 1280,
    videoBitrate: 1_000_000,
    audioBitrate: 96_000,
  },
  {
    id: "sosyal",
    label: "Sosyal medya",
    hint: "1080p · dengeli kalite",
    maxDimension: 1920,
    videoBitrate: 2_500_000,
    audioBitrate: 128_000,
  },
  {
    id: "eposta",
    label: "E-posta eki",
    hint: "480p · çok küçük",
    maxDimension: 854,
    videoBitrate: 600_000,
    audioBitrate: 64_000,
  },
];

export type CompressOptions = {
  /** hedef uzun kenar; null ise özgün çözünürlük korunur */
  maxDimension: number | null;
  videoBitrate: number;
  audioBitrate: number;
  /** sesi tamamen at */
  removeAudio?: boolean;
  /** çıktı kabı */
  container?: "mp4" | "webm";
};

/**
 * Kullanılacak gerçek video bit hızı.
 *
 * Hedef, kaynağın kendi bit hızından yüksekse yükseltmenin anlamı yoktur:
 * kalite artmaz (kayıp zaten olmuş), dosya büyür. Bu yüzden kaynağın üstüne
 * çıkmayacak şekilde kırpılır — kullanıcı "sıkıştırdım ama dosya büyüdü"
 * durumuna düşmesin.
 */
export function effectiveVideoBitrate(info: MediaInfo, requested: number): number {
  const audioShare = info.hasAudio ? 128_000 : 0;
  const sourceVideoBitrate = Math.max(100_000, info.bitrateBps - audioShare);
  return Math.min(requested, sourceVideoBitrate);
}

/** Seçilen ayar kaynaktan daha kaliteli mi? (yani sıkıştırma etkisiz kalır) */
export function isAlreadySmall(info: MediaInfo, opts: CompressOptions): boolean {
  return effectiveVideoBitrate(info, opts.videoBitrate) < opts.videoBitrate;
}

/**
 * Çıktı boyutunu işlemden ÖNCE tahmin eder (bit hızı × süre).
 * Gerçek sonuç sahne karmaşıklığına göre değişir; bu yüzden "tahmini" denir.
 */
export function estimateSize(info: MediaInfo, opts: CompressOptions): number {
  const audio = opts.removeAudio || !info.hasAudio ? 0 : opts.audioBitrate;
  const video = effectiveVideoBitrate(info, opts.videoBitrate);
  return Math.round(((video + audio) * info.durationSec) / 8);
}

/**
 * Kaynak çözünürlüğü hedef uzun kenara sığdırır; en-boy oranı korunur.
 * Video zaten küçükse büyütmez (kalite kazanmadan dosya şişmesin).
 */
export function targetDimensions(
  info: MediaInfo,
  maxDimension: number | null
): { width: number; height: number } {
  if (!maxDimension) return { width: info.width, height: info.height };
  const longest = Math.max(info.width, info.height);
  if (longest <= maxDimension) return { width: info.width, height: info.height };

  const scale = maxDimension / longest;
  // Kodlayıcılar tek sayı boyutlarda sorun çıkarabilir; çift sayıya yuvarla.
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(info.width), height: even(info.height) };
}

/* ── Sıkıştırma ── */

export type CompressResult = {
  blob: Blob;
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
};

export type CompressHandlers = {
  /** 0..1 arası ilerleme */
  onProgress?: (ratio: number) => void;
  /** dışarıdan iptal: { cancelled: true } yapılınca işlem durur */
  signal?: { cancelled: boolean };
};

/**
 * Videoyu yeniden kodlayarak küçültür.
 *
 * Ses, hedef bit hızına uyuyorsa mediabunny tarafından olduğu gibi kopyalanır
 * (yeniden kodlanmaz) — kalite kaybı olmaz.
 */
export async function compress(
  file: File,
  opts: CompressOptions,
  handlers: CompressHandlers = {}
): Promise<CompressResult> {
  const support = await checkSupport();
  if (!support.supported) {
    throw new TranscodeUnsupportedError(support.reason ?? "Video işleme desteklenmiyor.");
  }

  const info = await analyze(file);
  const { width, height } = targetDimensions(info, opts.maxDimension);

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const target = new BufferTarget();
  const output = new Output({
    format: opts.container === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat(),
    target,
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      width,
      height,
      bitrate: effectiveVideoBitrate(info, opts.videoBitrate),
      fit: "contain",
    },
    audio: opts.removeAudio ? { discard: true } : { bitrate: opts.audioBitrate },
  });

  if (handlers.onProgress) {
    conversion.onProgress = (ratio) => handlers.onProgress?.(ratio);
  }

  // İptal, ilerleme sırasında sorulur; Conversion kendi iptalini yönetir.
  let cancelPoll: number | undefined;
  if (handlers.signal) {
    cancelPoll = window.setInterval(() => {
      if (handlers.signal?.cancelled && conversion.state === "executing") {
        void conversion.cancel();
      }
    }, 250);
  }

  try {
    await conversion.execute();

    if (handlers.signal?.cancelled) {
      throw new TranscodeCancelledError("İşlem iptal edildi.");
    }
    if (!target.buffer) {
      throw new Error("Sıkıştırma çıktı üretmedi.");
    }

    const blob = new Blob([target.buffer], {
      type: opts.container === "webm" ? "video/webm" : "video/mp4",
    });
    if (blob.size === 0) throw new Error("Sıkıştırma boş dosya üretti.");

    return {
      blob,
      sizeBytes: blob.size,
      width,
      height,
      durationSec: info.durationSec,
    };
  } catch (err) {
    // mediabunny iptalde kendi hata tipini atar; kullanıcıya "hata" gibi göstermeyelim.
    if (handlers.signal?.cancelled || (err as Error)?.name === "ConversionCanceledError") {
      throw new TranscodeCancelledError("İşlem iptal edildi.");
    }
    throw err;
  } finally {
    if (cancelPoll !== undefined) window.clearInterval(cancelPoll);
    input.dispose();
  }
}

/* ── Yardımcılar ── */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
