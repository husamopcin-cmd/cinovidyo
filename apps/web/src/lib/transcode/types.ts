export type MediaInfo = {
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  sizeBytes: number;
  bitrateBps: number;
  hasAudio: boolean;
};

export type PresetId = "whatsapp" | "sosyal" | "eposta" | "ozel";

export type Preset = {
  id: PresetId;
  label: string;
  hint: string;
  maxDimension: number | null;
  videoBitrate: number;
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
  maxDimension: number | null;
  videoBitrate: number;
  audioBitrate: number;
  removeAudio?: boolean;
  container?: "mp4" | "webm" | "m4a";
  /** Zaman aralığı kırpma: kaynağın yalnızca [trimStartSec, trimEndSec] aralığı alınır. */
  trimStartSec?: number;
  trimEndSec?: number;
  // Kırpma (Görüntü)
  cropWidth?: number;
  cropHeight?: number;
  fit?: "contain" | "cover" | "fill";
  // Ses Ayıklama
  extractAudioOnly?: boolean;
};

export type CompressResult = {
  blob?: Blob; // Eğer showSaveFilePicker kullanılmadıysa dolu gelir
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
};

export class TranscodeUnsupportedError extends Error {
  readonly code = "TRANSCODE_UNSUPPORTED";
}

export class TranscodeCancelledError extends Error {
  readonly code = "TRANSCODE_CANCELLED";
}

export type SupportInfo = {
  supported: boolean;
  reason?: string;
};
