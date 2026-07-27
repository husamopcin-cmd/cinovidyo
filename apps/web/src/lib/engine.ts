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

  // Üst marka çizgisi
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 27px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("CINOVID  •  STORY", 74, 92);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(74, 120, VIDEO_WIDTH - 148, 2);

  drawVisual(ctx, scene.visual ?? "minimal", p);

  if (scene.title) {
    ctx.font = "900 80px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "left";
    const lines = wrapText(ctx, scene.title, VIDEO_WIDTH - 148).slice(0, 3);
    const top = 1040 - Math.max(0, lines.length - 1) * 46;
    lines.forEach((line, i) => {
      ctx.fillText(line, 74, top + i * 92);
    });
  }
}

function drawVisual(
  ctx: CanvasRenderingContext2D,
  visual: NonNullable<Scene["visual"]>,
  p: number
) {
  const cx = VIDEO_WIDTH / 2;
  const cy = 570;
  const pulse = 1 + Math.sin(p * Math.PI * 2) * 0.025;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (visual === "cat") {
    const bounce = Math.sin(p * Math.PI * 4) * 22;
    ctx.translate(0, bounce);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-120, -90);
    ctx.lineTo(-165, -220);
    ctx.lineTo(-42, -145);
    ctx.moveTo(120, -90);
    ctx.lineTo(165, -220);
    ctx.lineTo(42, -145);
    ctx.fill();
    ctx.fillStyle = "rgba(76,29,149,0.95)";
    ctx.beginPath();
    ctx.arc(-55, -20, 18, 0, Math.PI * 2);
    ctx.arc(55, -20, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(76,29,149,0.95)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 35, 46, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 18;
    const arm = Math.sin(p * Math.PI * 4) * 0.6;
    ctx.beginPath();
    ctx.moveTo(-120, 85);
    ctx.lineTo(-260, 120 + arm * 110);
    ctx.moveTo(120, 85);
    ctx.lineTo(260, 120 - arm * 110);
    ctx.stroke();
  } else if (visual === "home") {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(-300, 30);
    ctx.lineTo(0, -245);
    ctx.lineTo(300, 30);
    ctx.lineTo(245, 30);
    ctx.lineTo(245, 255);
    ctx.lineTo(-245, 255);
    ctx.lineTo(-245, 30);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(-62, 70, 124, 185);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(-180, 60, 80, 80);
    ctx.fillRect(100, 60, 80, 80);
  } else if (visual === "sunrise") {
    const sunY = 70 - p * 70;
    const sun = ctx.createRadialGradient(0, sunY, 20, 0, sunY, 220);
    sun.addColorStop(0, "rgba(255,244,184,0.95)");
    sun.addColorStop(0.35, "rgba(251,191,36,0.72)");
    sun.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(0, sunY, 230, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 6;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-360 + i * 30, 155 + i * 28);
      ctx.quadraticCurveTo(0, 70 + i * 18, 360 - i * 30, 155 + i * 28);
      ctx.stroke();
    }
  } else if (visual === "focus") {
    for (let i = 4; i >= 1; i--) {
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + i * 0.08})`;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(0, 0, i * 82 + p * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(99,102,241,0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
  } else if (visual === "growth") {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(-290, 210);
    ctx.bezierCurveTo(-160, 120, -120, -40, 20, -70);
    ctx.bezierCurveTo(150, -100, 170, -240, 310, -300);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(310, -300);
    ctx.lineTo(225, -287);
    ctx.lineTo(282, -218);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.18 + i * 0.12})`;
      ctx.fillRect(-320 + i * 150, 220 - i * 105, 105, 35 + i * 70);
    }
  } else if (visual === "energy") {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 22;
    ctx.beginPath();
    for (let x = -390; x <= 390; x += 12) {
      const y = Math.sin(x / 48 + p * Math.PI * 2) * 72 * Math.exp(-Math.abs(x) / 390);
      if (x === -390) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(0, 0, 245 + Math.sin(p * Math.PI * 2) * 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (visual === "steps") {
    for (let i = 0; i < 4; i++) {
      const x = -330 + i * 170;
      const y = 190 - i * 130;
      ctx.fillStyle = `rgba(255,255,255,${0.18 + i * 0.16})`;
      ctx.fillRect(x, y, 145, 110);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "800 40px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), x + 72, y + 70);
    }
  } else {
    ctx.rotate(p * 0.14 - 0.07);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + i * 0.13})`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      const size = 190 + i * 90;
      ctx.roundRect(-size, -size, size * 2, size * 2, 72);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  ttsEnabled?: boolean;
  ttsVolume?: number;
  onProgress?: (ratio: number, elapsed: number) => void;
};

/**
 * Zaman çizelgesini gerçek zamanlı olarak kaydeder ve video Blob'u döner.
 * Hata durumunda reject eder; sessizce başarısız olmaz.
 */
export async function recordVideo(opts: RecordOptions): Promise<RecordResult> {
  const { project, media, audio, ttsEnabled, ttsVolume, onProgress } = opts;
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
  let musicGain: GainNode | null = null;
  
  if (audio) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
      audioEl = document.createElement("audio");
      audioEl.src = URL.createObjectURL(audio);
      audioEl.loop = true;
      audioEl.volume = 0.5;
      audioEl.muted = false;
      audioEl.crossOrigin = "anonymous";
      await audioEl.play().catch(() => undefined);
      const source = audioCtx.createMediaElementSource(audioEl);
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.5;
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(musicGain);
      musicGain.connect(dest);
      musicGain.connect(audioCtx.destination);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch (err) {
      console.error("Ses eklenemedi:", err);
      audioCtx = null;
    }
  }

  // TTS seslendirmesi
  let ttsUtterance: SpeechSynthesisUtterance | null = null;
  let ttsEnded = false;
  
  if (ttsEnabled && typeof window !== "undefined" && window.speechSynthesis) {
    // İlk sahnenin seslendirme metnini al
    const firstSceneWithVoice = project.scenes.find(s => s.voiceText && s.voiceText.trim());
    if (firstSceneWithVoice) {
      try {
        const utterance = new SpeechSynthesisUtterance(firstSceneWithVoice.voiceText || firstSceneWithVoice.subtitle);
        if (firstSceneWithVoice.voiceId) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === firstSceneWithVoice.voiceId);
          if (voice) utterance.voice = voice;
        }
        utterance.volume = ttsVolume ?? 0.8;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onend = () => { ttsEnded = true; };
        utterance.onerror = () => { ttsEnded = true; };
        
        ttsUtterance = utterance;
      } catch (err) {
        console.error("TTS başlatılamadı:", err);
      }
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
    const cancelled = { cancelled: false };
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
      if (cancelled.cancelled) {
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
    
    // TTS'i kayıt başladığında başlat
    if (ttsUtterance && window.speechSynthesis) {
      window.speechSynthesis.speak(ttsUtterance);
    }
    
    requestAnimationFrame(tick);
  });
}
