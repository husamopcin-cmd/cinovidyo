"use client";

// Tarayıcı içi video motoru.
// Sahneler 1080x1920 canvas'a çizilir, canvas.captureStream + MediaRecorder ile
// gerçek bir video dosyasına kaydedilir. Sunucu, FFmpeg veya Chromium gerekmez.
// Kayıt gerçek zamanlıdır: 30 saniyelik video ~30 saniyede üretilir.

import {
  DEFAULT_AUDIO_MIX,
  FPS,
  PALETTES,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  type Asset,
  type Project,
  type Scene,
  type SubtitleStyle,
} from "./types";
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  MediaStreamVideoTrackSource,
  MediaStreamAudioTrackSource,
  CanvasSource,
  AudioBufferSource,
  canEncodeVideo,
} from "mediabunny";

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
  /** arka plan müziği dosyası */
  audio?: Blob;
  /** sahne seslendirmeleri: Asset.id -> ses dosyası */
  voices?: Map<string, Blob>;
  onProgress?: (ratio: number, elapsed: number) => void;
  /** dışarıdan iptal için: { cancelled: true } yapılınca kayıt durur */
  signal?: { cancelled: boolean };
};

/**
 * Tek bir paylaşılan AudioContext.
 * createMediaElementSource bir eleman için yalnızca BİR kez çağrılabilir; her
 * kayıtta yeni context açmak ikinci render'da InvalidStateError verir.
 */
let sharedAudioCtx: AudioContext | null = null;
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AC();
  }
  return sharedAudioCtx;
}

function sourceFor(ctx: AudioContext, el: HTMLMediaElement): MediaElementAudioSourceNode {
  let node = elementSources.get(el);
  if (!node) {
    node = ctx.createMediaElementSource(el);
    elementSources.set(el, node);
  }
  return node;
}

/**
 * Zaman çizelgesini gerçek zamanlı olarak kaydeder ve video Blob'u döner.
 * Hata durumunda reject eder; sessizce başarısız olmaz.
 */
export async function recordVideo(opts: RecordOptions): Promise<RecordResult> {
  const { project, media, audio, voices, onProgress, signal } = opts;
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
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx) throw new Error("Canvas 2D bağlamı oluşturulamadı.");
  // açık tip: aşağıdaki fonksiyon bildirimleri içinde daraltma korunsun
  const ctx: CanvasRenderingContext2D = rawCtx;

  const stream = canvas.captureStream(FPS);

  /* ── Ses grafiği ──
     Üç kaynak bağımsız gain düğümleriyle karıştırılıp MediaRecorder akışına eklenir:
       1) sahne videolarının kendi sesi
       2) sahne seslendirmeleri (voiceAssetId ses dosyaları)
       3) arka plan müziği
     Not: tarayıcının konuşma sentezi (SpeechSynthesis) çıktısı bir MediaStream'e
     yönlendirilemez, bu yüzden export'a giremez. Seslendirme yalnızca gerçek bir
     ses dosyası olarak gömülür. */
  const mix = project.audioMix ?? DEFAULT_AUDIO_MIX;
  const ownedAudioEls: HTMLAudioElement[] = [];
  const objectUrls: string[] = [];
  const gains: GainNode[] = [];
  const voicePlayers = new Map<string, HTMLAudioElement>();
  let musicEl: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;

  const hasMusic = mix.musicEnabled && !!audio;
  const hasVideoAudio =
    mix.videoEnabled &&
    project.scenes.some((s) => s.assetId && media.get(s.assetId) instanceof HTMLVideoElement);
  const hasVoice =
    mix.voiceEnabled && project.scenes.some((s) => s.voiceAssetId && voices?.get(s.voiceAssetId));

  if (hasMusic || hasVideoAudio || hasVoice) {
    try {
      audioCtx = getAudioContext();
      await audioCtx.resume().catch(() => undefined);
      const dest = audioCtx.createMediaStreamDestination();

      const connect = (el: HTMLMediaElement, volume: number) => {
        const node = sourceFor(audioCtx!, el);
        const gain = audioCtx!.createGain();
        gain.gain.value = volume;
        node.connect(gain);
        gain.connect(dest);
        // kullanıcı kayıt sırasında da duysun
        gain.connect(audioCtx!.destination);
        gains.push(gain);
      };

      if (hasMusic && audio) {
        const el = document.createElement("audio");
        const url = URL.createObjectURL(audio);
        objectUrls.push(url);
        el.src = url;
        el.loop = true;
        ownedAudioEls.push(el);
        connect(el, mix.musicVolume);
        musicEl = el;
      }

      if (hasVideoAudio) {
        media.forEach((el) => {
          if (el instanceof HTMLVideoElement) {
            el.muted = false;
            connect(el, mix.videoVolume);
          }
        });
      }

      if (hasVoice && voices) {
        for (const scene of project.scenes) {
          const blob = scene.voiceAssetId ? voices.get(scene.voiceAssetId) : undefined;
          if (!blob) continue;
          const el = document.createElement("audio");
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          el.src = url;
          ownedAudioEls.push(el);
          connect(el, mix.voiceVolume);
          voicePlayers.set(scene.id, el);
        }
      }

      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch (err) {
      // Ses kurulamazsa video sessiz üretilir; sessizce yutulmaz.
      console.error("Ses grafiği kurulamadı:", err);
      audioCtx = null;
    }
  }

  const target = new BufferTarget();
  const format = picked.ext === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat();
  const output = new Output({ format, target });

  // Not: mediabunny API'si addVideoTrack/addAudioTrack'tir. Daha önce burada
  // `(output as any).addTrack(...)` kullanılıyordu; `as any` cast'i TypeScript'i
  // devre dışı bıraktığı için hata derlemede değil, ancak çalışma anında
  // ("output.addTrack is not a function") ortaya çıkıyordu. Cast kaldırıldı ki
  // API yanlış kullanılırsa derleme aşamasında yakalansın.
  const videoTrack = stream.getVideoTracks()[0];
  const videoSource = new MediaStreamVideoTrackSource(videoTrack, {
    codec: picked.ext === "webm" ? "vp8" : "avc",
    bitrate: 6_000_000,
  });
  output.addVideoTrack(videoSource);

  const audioTrack = stream.getAudioTracks()[0];
  if (audioTrack) {
    const audioSource = new MediaStreamAudioTrackSource(audioTrack, {
      codec: picked.ext === "webm" ? "opus" : "aac",
      bitrate: 128_000,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const videoEls = new Set<HTMLVideoElement>();
  media.forEach((el) => {
    if (el instanceof HTMLVideoElement) videoEls.add(el);
  });

  return new Promise<RecordResult>((resolve, reject) => {
    let finished = false;
    let cancelledByUser = false;

    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibility);
      videoEls.forEach((v) => v.pause());
      ownedAudioEls.forEach((a) => a.pause());
      stream.getTracks().forEach((t) => t.stop());
      gains.forEach((g) => g.disconnect());
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };

    const stopRecorder = async () => {
      if (finished) return;
      finished = true;
      cleanup();
      
      if (cancelledByUser) {
        await output.cancel().catch(() => {});
        reject(new Error("Kayıt iptal edildi."));
        return;
      }
      
      try {
        await output.finalize();
        const blob = new Blob([target.buffer || new ArrayBuffer(0)], { type: picked.mime });
        if (blob.size === 0) {
          reject(new Error("Kayıt boş döndü — video üretilemedi."));
          return;
        }
        resolve({ blob, ext: picked.ext, durationSec: total });
      } catch (e) {
        reject(new Error(`Kayıt finalizasyon hatası: ${e instanceof Error ? e.message : "bilinmeyen"}`));
      }
    };

    // mediabunny kaynaklarındaki hataları yakala
    videoSource.errorPromise.catch((e) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error(`Video kaynak hatası: ${e instanceof Error ? e.message : "bilinmeyen"}`));
    });

    let activeIndex = -1;
    const startedAt = performance.now();
    /** sekme arka plandayken geçen ve sayılmaması gereken süre */
    let pausedTotal = 0;
    let pausedAt: number | null = null;

    const elapsed = () => ((pausedAt ?? performance.now()) - startedAt - pausedTotal) / 1000;

    /**
     * Sekme arka plana alındığında requestAnimationFrame tamamen durur; bu yüzden
     * kaydı da duraklatırız. Aksi halde MediaRecorder gerçek zamanı kaydetmeye devam
     * eder ve donmuş karelerden oluşan bozuk bir video üretilir.
     */
    function onVisibility() {
      if (finished) return;
      if (document.hidden) {
        if (pausedAt === null) {
          pausedAt = performance.now();
          videoSource.pause();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (audioTrack) ((output as any).tracks.find((t: any) => t.source instanceof MediaStreamAudioTrackSource)?.source as any).pause();
          videoEls.forEach((v) => v.pause());
          ownedAudioEls.forEach((a) => a.pause());
        }
      } else if (pausedAt !== null) {
        pausedTotal += performance.now() - pausedAt;
        pausedAt = null;
        videoSource.resume();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (audioTrack) ((output as any).tracks.find((t: any) => t.source instanceof MediaStreamAudioTrackSource)?.source as any).resume();
        activeIndex = -1; // sahne medyasını yeniden kur
        schedule();
      }
    }

    function schedule() {
      if (finished) return;
      if (signal?.cancelled) {
        cancelledByUser = true;
        void stopRecorder();
        return;
      }
      if (document.hidden) {
        // rAF arka planda çalışmaz; iptali yakalamak için düşük frekanslı nabız
        window.setTimeout(schedule, 300);
        return;
      }
      requestAnimationFrame(tick);
    }

    function tick() {
      if (finished || pausedAt !== null) return;
      if (signal?.cancelled) {
        cancelledByUser = true;
        void stopRecorder();
        return;
      }

      const time = elapsed();
      if (time >= total) {
        renderFrame(ctx, timeline, total - 0.001, media, project.subtitleStyle);
        onProgress?.(1, total);
        // son karenin akışa girmesi için küçük gecikme
        window.setTimeout(() => void stopRecorder(), 150);
        return;
      }

      let index = timeline.findIndex((it) => time >= it.start && time < it.end);
      if (index === -1) index = 0;

      if (index !== activeIndex) {
        activeIndex = index;
        const scene = timeline[index].scene;
        const el = scene.assetId ? media.get(scene.assetId) : undefined;

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

        // sahnenin seslendirmesini baştan başlat
        const voiceEl = voicePlayers.get(scene.id);
        voicePlayers.forEach((a) => {
          if (a !== voiceEl) a.pause();
        });
        if (voiceEl) {
          try {
            voiceEl.currentTime = 0;
          } catch {
            /* seek desteklenmiyorsa baştan çalamayız */
          }
          void voiceEl.play().catch(() => undefined);
        }
      }

      renderFrame(ctx, timeline, time, media, project.subtitleStyle);
      onProgress?.(time / total, time);
      schedule();
    }

    document.addEventListener("visibilitychange", onVisibility);

    if (document.hidden) {
      cleanup();
      reject(
        new Error(
          "Kayıt başlatılamadı: sekme arka planda. CinoVid sekmesini görünür tut ve tekrar dene."
        )
      );
      return;
    }

    // müzik baştan sona çalar; seslendirmeler sahne sırası geldiğinde başlar
    if (musicEl) void musicEl.play().catch(() => undefined);
    schedule();
  });
}

/* ── Hızlı (deterministik) export ──
   MediaRecorder / MediaStream yolu gerçek zamanlıdır: 30 sn'lik video 30 sn
   sürer, requestAnimationFrame'e bağlıdır ve sekme arka plana alınınca durur.

   Aşağıdaki yol bunun yerine kareleri tek tek çizip doğrudan kodlayıcıya verir:
     • gerçek zamandan hızlıdır (donanım hızlandırmalı encode)
     • rAF kullanmaz, bu yüzden sekme görünür olmak zorunda değildir
     • kare zamanlamaları saat yerine sayaçla belirlendiği için tekrarlanabilir

   Ses, canlı çalma yerine OfflineAudioContext ile kurgu-dışı (offline) miksajlanır. */

/** Tarayıcı hızlı yolu destekliyor mu? */
export async function supportsFastExport(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof VideoEncoder === "undefined" || typeof OfflineAudioContext === "undefined") return false;
  try {
    return await canEncodeVideo("avc", { width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
  } catch {
    return false;
  }
}

/** Bir video elemanını istenen saniyeye konumlandırır ve karenin hazır olmasını bekler. */
function seekTo(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(time, Number.isFinite(el.duration) ? el.duration - 0.05 : time));
    if (Math.abs(el.currentTime - target) < 0.01) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("seeked", finish);
      resolve();
    };
    el.addEventListener("seeked", finish);
    // Arama desteklenmiyorsa veya takılırsa kayıt tıkanmasın.
    window.setTimeout(finish, 400);
    try {
      el.currentTime = target;
    } catch {
      finish();
    }
  });
}

/**
 * Proje seslerini tek bir AudioBuffer'a offline miksajlar.
 * Ses yoksa null döner (video sessiz üretilir, bu bir hata değildir).
 */
async function mixAudioOffline(opts: RecordOptions, totalSec: number): Promise<AudioBuffer | null> {
  const { project, audio, voices } = opts;
  const mix = project.audioMix ?? DEFAULT_AUDIO_MIX;

  type Parca = { blob: Blob; offset: number; volume: number; loop: boolean };
  const parcalar: Parca[] = [];

  if (mix.musicEnabled && audio) {
    parcalar.push({ blob: audio, offset: 0, volume: mix.musicVolume, loop: true });
  }
  if (mix.voiceEnabled && voices) {
    for (const item of buildTimeline(project.scenes)) {
      const id = item.scene.voiceAssetId;
      const blob = id ? voices.get(id) : undefined;
      if (blob) parcalar.push({ blob, offset: item.start, volume: mix.voiceVolume, loop: false });
    }
  }
  if (parcalar.length === 0) return null;

  const sampleRate = 48000;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(totalSec * sampleRate)), sampleRate);

  for (const p of parcalar) {
    try {
      const buf = await ctx.decodeAudioData(await p.blob.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = p.loop;
      const gain = ctx.createGain();
      gain.gain.value = p.volume;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(p.offset);
      if (p.loop) src.stop(totalSec);
    } catch (err) {
      // Tek bir ses çözülemezse tamamını kaybetme; sessizce de yutma.
      console.error("Ses parçası çözülemedi, atlanıyor:", err);
    }
  }

  return ctx.startRendering();
}

/**
 * Zaman çizelgesini kare kare kodlayarak video üretir.
 * recordVideo ile aynı sözleşmeyi kullanır (onProgress, signal, RecordResult).
 */
export async function encodeVideoFast(opts: RecordOptions): Promise<RecordResult> {
  const { project, media, onProgress, signal } = opts;

  const timeline = buildTimeline(project.scenes);
  if (timeline.length === 0) throw new Error("Kaydedilecek sahne yok.");
  const total = timeline[timeline.length - 1].end;

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D bağlamı oluşturulamadı.");

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });

  const videoSource = new CanvasSource(canvas, { codec: "avc", bitrate: 6_000_000 });
  output.addVideoTrack(videoSource);

  // Ses videodan önce hazırlanır: burada patlarsa boş dosya üretmeyelim.
  const mixed = await mixAudioOffline(opts, total);
  let audioSource: AudioBufferSource | null = null;
  if (mixed) {
    audioSource = new AudioBufferSource({ codec: "aac", bitrate: 128_000 });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const frameDur = 1 / FPS;
  const frameCount = Math.max(1, Math.round(total * FPS));
  let activeIndex = -1;

  try {
    for (let i = 0; i < frameCount; i++) {
      if (signal?.cancelled) {
        await output.cancel();
        throw new Error("Kayıt iptal edildi.");
      }

      const time = Math.min(i * frameDur, total - 0.001);

      // Sahne değiştiyse video medyasını doğru konuma getir.
      let index = timeline.findIndex((it) => time >= it.start && time < it.end);
      if (index === -1) index = timeline.length - 1;
      const item = timeline[index];
      const el = item.scene.assetId ? media.get(item.scene.assetId) : undefined;
      if (el instanceof HTMLVideoElement) {
        if (index !== activeIndex) activeIndex = index;
        await seekTo(el, time - item.start);
      } else {
        activeIndex = index;
      }

      renderFrame(ctx, timeline, time, media, project.subtitleStyle);
      await videoSource.add(time, frameDur);

      if (i % 5 === 0) onProgress?.(time / total, time);
    }

    if (audioSource && mixed) {
      await audioSource.add(mixed);
    }

    onProgress?.(1, total);
    await output.finalize();

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Kayıt boş döndü — video üretilemedi.");
    }
    return { blob: new Blob([buffer], { type: "video/mp4" }), ext: "mp4", durationSec: total };
  } catch (err) {
    if (output.state !== "finalized" && output.state !== "canceled") {
      await output.cancel().catch(() => undefined);
    }
    throw err;
  }
}
