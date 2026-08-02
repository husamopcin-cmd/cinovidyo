import type { MediaInfo, CompressOptions } from "./types";

export function effectiveVideoBitrate(info: MediaInfo, requested: number): number {
  const audioShare = info.hasAudio ? 128_000 : 0;
  const sourceVideoBitrate = Math.max(100_000, info.bitrateBps - audioShare);
  return Math.min(requested, sourceVideoBitrate);
}

export function isAlreadySmall(info: MediaInfo, opts: CompressOptions): boolean {
  return effectiveVideoBitrate(info, opts.videoBitrate) < opts.videoBitrate;
}

export function estimateSize(info: MediaInfo, opts: CompressOptions): number {
  const audio = opts.removeAudio || !info.hasAudio ? 0 : opts.audioBitrate;
  const video = effectiveVideoBitrate(info, opts.videoBitrate);
  return Math.round(((video + audio) * info.durationSec) / 8);
}

export function targetDimensions(
  info: MediaInfo,
  maxDimension: number | null
): { width: number; height: number } {
  if (!maxDimension) return { width: info.width, height: info.height };
  const longest = Math.max(info.width, info.height);
  if (longest <= maxDimension) return { width: info.width, height: info.height };

  const scale = maxDimension / longest;
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(info.width), height: even(info.height) };
}

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
