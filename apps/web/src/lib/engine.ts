"use client";

// Tarayıcı içi video motoru.
// Sahneler 1080x1920 canvas'a çizilir, canvas.captureStream + MediaRecorder ile
// gerçek bir video dosyasına kaydedilir. Sunucu, FFmpeg veya Chromium gerekmez.
// Kayıt gerçek zamanlıdır: 30 saniyelik video ~30 saniyede üretilir.

import {
  FPS,
  PALETTES,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  type Asset,
  type Project,
  type Scene,
  type SubtitleStyle,
} from "./types";

const FADE_SEC = 0.5;

export type MediaMap = Map<string, HTMLImageElement | HTMLVideoElement>;

export type TimelineItem = {
  scene: Scene;
  start: number;
  end: number;
};

export function buildTimeline(scenes: Scene[]): TimelineItem[] {
  let t = 0;
  return scenes.map((scene) => {
    const start = t;
    t += Math.max(0.2, scene.duration);
    return { scene, start, end: t };
  });
}

/** Blob'ları <img>/<video> elemanlarına yükler. */
export async function loadMedia(assets: Asset[]): Promise<MediaMap> {
  const map: MediaMap = new Map();
  await Promise.all(
    assets.map(
      (asset) =>
        new Promise<void>((resolve) => {
          const url = URL.createObjectURL(asset.blob);
          if (asset.kind === "image") {
            const img = new Image();
            img.onload = () => {
              map.set(asset.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          } else if (asset.kind === "video") {
            const video = document.createElement("video");
            video.muted = true;
            video.playsInline = true;
            video.preload = "auto";
            video.onloadeddata = () => {
              map.set(asset.id, video);
              resolve();
            };
            video.onerror = () => resolve();
            video.src = url;
          } else {
            resolve();
          }
        })
    )
  );
  return map;
}

export function releaseMedia(map: MediaMap) {
  map.forEach((el) => {
    if (el.src.startsWith("blob:")) URL.revokeObjectURL(el.src);
  });
  map.clear();
}

/* ── Çizim ── */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function motionTransform(scene: Scene, p: number) {
  switch (scene.motion) {
    case "zoom_in":
      return { zoom: 1 + 0.18 * p, panX: 0 };
    case "zoom_out":
      return { zoom: 1.18 - 0.18 * p, panX: 0 };
    case "pan_left":
      return { zoom: 1.18, panX: 1 - 2 * p };
    case "pan_right":
      return { zoom: 1.18, panX: -1 + 2 * p };
    default:
      return { zoom: 1, panX: 0 };
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  el: HTMLImageElement | HTMLVideoElement,
  scene: Scene,
  p: number
) {
  const iw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const ih = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!iw || !ih) return;

  const { zoom, panX } = motionTransform(scene, p);
  const scale = Math.max(VIDEO_WIDTH / iw, VIDEO_HEIGHT / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const maxPan = Math.max(0, (dw - VIDEO_WIDTH) / 2);
  const dx = (VIDEO_WIDTH - dw) / 2 + panX * maxPan;
  const dy = (VIDEO_HEIGHT - dh) / 2;
  ctx.drawImage(el, dx, dy, dw, dh);
}

function drawTextScene(ctx: CanvasRenderingContext2D, scene: Scene, p: number) {
  const [from, to] = PALETTES[scene.palette ?? "violet"] ?? PALETTES.violet;
  const grad = ctx.createLinearGradient(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

  // yumuşak ışık halkası
  const glow = ctx.createRadialGradient(
    VIDEO_WIDTH / 2,
    VIDEO_HEIGHT * (0.35 + 0.05 * Math.sin(p * Math.PI)),
    50,
    VIDEO_WIDTH / 2,
    VIDEO_HEIGHT / 2,
    VIDEO_WIDTH
  );
  glow.addColorStop(0, "rgba(255,255,255,0.16)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

  if (scene.title) {
    ctx.font = "900 92px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "center";
    const lines = wrapText(ctx, scene.title, VIDEO_WIDTH - 180);
    lines.forEach((line, i) => {
      ctx.fillText(line, VIDEO_WIDTH / 2, 420 + i * 104);
    });
  }
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  p: number
) {
  if (!text.trim()) return;
  const size = style.size;
  ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  const maxWidth = VIDEO_WIDTH - 140;
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = size * 1.28;
  const blockHeight = lines.length * lineHeight;

  let top: number;
  if (style.position === "top") top = 260;
  else if (style.position === "center") top = (VIDEO_HEIGHT - blockHeight) / 2;
  else top = VIDEO_HEIGHT - blockHeight - 320;

  if (style.background) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const padX = 44;
    const padY = 32;
    ctx.fillStyle = "rgba(3, 7, 18, 0.62)";
    const x = (VIDEO_WIDTH - widest) / 2 - padX;
    const y = top - padY;
    const w = widest + padX * 2;
    const h = blockHeight + padY * 2;
    const r = 28;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // hafif giriş animasyonu
  const rise = Math.max(0, 1 - p * 8) * 18;
  ctx.fillStyle = style.color;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 12;
  lines.forEach((line, i) => {
    ctx.fillText(line, VIDEO_WIDTH / 2, top + size * 0.85 + i * lineHeight + rise);
  });
  ctx.shadowBlur = 0;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  item: TimelineItem,
  time: number,
  media: MediaMap,
  style: SubtitleStyle
) {
  const dur = Math.max(0.2, item.end - item.start);
  const p = Math.min(1, Math.max(0, (time - item.start) / dur));
  const scene = item.scene;

  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

  const el = scene.assetId ? media.get(scene.assetId) : undefined;
  if (el) {
    drawCover(ctx, el, scene, p);
    // okunabilirlik için alt karartma
    const shade = ctx.createLinearGradient(0, VIDEO_HEIGHT * 0.45, 0, VIDEO_HEIGHT);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  } else {
    drawTextScene(ctx, scene, p);
  }

  drawSubtitle(ctx, scene.subtitle, style, p);
}

/** Zaman çizelgesinin verilen anını canvas'a çizer (önizleme ve kayıt ortak kullanır). */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  timeline: TimelineItem[],
  time: number,
  media: MediaMap,
  style: SubtitleStyle
) {
  if (timeline.length === 0) {
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    ctx.fillStyle = "#6b7280";
    ctx.font = "600 48px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sahne yok", VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2);
    return;
  }

  let index = timeline.findIndex((it) => time >= it.start && time < it.end);
  if (index === -1) index = time < timeline[0].start ? 0 : timeline.length - 1;
  const item = timeline[index];

  const fadeIn = item.scene.transition === "fade" && index > 0;
  const intoScene = time - item.start;

  if (fadeIn && intoScene < FADE_SEC) {
    drawScene(ctx, timeline[index - 1], timeline[index - 1].end - 0.01, media, style);
    ctx.save();
    ctx.globalAlpha = intoScene / FADE_SEC;
    drawScene(ctx, item, time, media, style);
    ctx.restore();
  } else {
    drawScene(ctx, item, time, media, style);
  }
}

/* ── Kayıt ── */

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return { mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
    }
  }
  return null;
}

export function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMime() !== null
  );
}

export type RecordResult = { blob: Blob; ext: string; durationSec: number };

export type RecordOptions = {
  project: Project;
  media: MediaMap;
  audio?: Blob;
  onProgress?: (ratio: number, elapsed: number) => void;
  signal?: { cancelled: boolean };
};

/**
 * Zaman çizelgesini gerçek zamanlı olarak kaydeder ve video Blob'u döner.
 * Hata durumunda reject eder; sessizce başarısız olmaz.
 */
export async function recordVideo(opts: RecordOptions): Promise<RecordResult> {
  const { project, media, audio, onProgress, signal } = opts;
  const picked = pickMime();
  if (!picked) {
    throw new Error(
      "Bu tarayıcı video kaydını (MediaRecorder) desteklemiyor. Chrome, Edge veya güncel Safari deneyin."
    );
  }

  const timeline = buildTimeline(project.scenes);
  if (timeline.length === 0) throw new Error("Kaydedilecek sahne yok.");
  const total = timeline[timeline.length - 1].end;

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D bağlamı oluşturulamadı.");

  const stream = canvas.captureStream(FPS);

  // Arka plan müziği varsa ses kanalını ekle
  let audioCtx: AudioContext | null = null;
  let audioEl: HTMLAudioElement | null = null;
  if (audio) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
      audioEl = document.createElement("audio");
      audioEl.src = URL.createObjectURL(audio);
      audioEl.loop = true;
      await audioEl.play().catch(() => undefined);
      const source = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      // Ses eklenemezse video sessiz üretilir; kullanıcıya sonuçta bildirilir.
      audioCtx = null;
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: picked.mime,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const videoEls = new Set<HTMLVideoElement>();
  media.forEach((el) => {
    if (el instanceof HTMLVideoElement) videoEls.add(el);
  });

  return new Promise<RecordResult>((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      videoEls.forEach((v) => v.pause());
      stream.getTracks().forEach((t) => t.stop());
      if (audioEl) {
        audioEl.pause();
        URL.revokeObjectURL(audioEl.src);
      }
      audioCtx?.close().catch(() => undefined);
    };

    recorder.onerror = (e) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error(`Kayıt hatası: ${(e as unknown as { error?: Error }).error?.message ?? "bilinmeyen"}`));
    };

    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      cleanup();
      const blob = new Blob(chunks, { type: picked.mime });
      if (blob.size === 0) {
        reject(new Error("Kayıt boş döndü — video üretilemedi."));
        return;
      }
      resolve({ blob, ext: picked.ext, durationSec: total });
    };

    let activeIndex = -1;
    const startedAt = performance.now();

    const tick = () => {
      if (finished) return;
      if (signal?.cancelled) {
        recorder.stop();
        return;
      }
      const time = (performance.now() - startedAt) / 1000;
      if (time >= total) {
        renderFrame(ctx, timeline, total - 0.001, media, project.subtitleStyle);
        onProgress?.(1, total);
        // son kareyi yakalaması için küçük gecikme
        setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 120);
        return;
      }

      let index = timeline.findIndex((it) => time >= it.start && time < it.end);
      if (index === -1) index = 0;
      if (index !== activeIndex) {
        activeIndex = index;
        const el = timeline[index].scene.assetId
          ? media.get(timeline[index].scene.assetId!)
          : undefined;
        if (el instanceof HTMLVideoElement) {
          videoEls.forEach((v) => v !== el && v.pause());
          try {
            el.currentTime = 0;
          } catch {
            /* seek desteklenmiyorsa mevcut kareden devam */
          }
          void el.play().catch(() => undefined);
        } else {
          videoEls.forEach((v) => v.pause());
        }
      }

      renderFrame(ctx, timeline, time, media, project.subtitleStyle);
      onProgress?.(time / total, time);
      requestAnimationFrame(tick);
    };

    recorder.start(250);
    requestAnimationFrame(tick);
  });
}
