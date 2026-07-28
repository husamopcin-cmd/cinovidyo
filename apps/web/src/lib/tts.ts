"use client";

// Sentetik seslendirme istemcisi. Anahtarlar sunucuda kalır; buradan yalnızca
// /api/tts çağrılır ve dönen ses baytları Blob olarak proje asset'ine yazılır.

import type { VoiceId } from "./types";

export type TtsAvailability = {
  configured: boolean;
  provider: string | null;
  voices: VoiceId[];
};

export class TtsNotConfiguredError extends Error {
  readonly code = "TTS_NOT_CONFIGURED";
}

/** Servis açık mı? Arayüzü doğru çizmek için kullanılır. */
export async function checkTts(): Promise<TtsAvailability> {
  try {
    const res = await fetch("/api/tts", { method: "GET" });
    if (!res.ok) return { configured: false, provider: null, voices: [] };
    return (await res.json()) as TtsAvailability;
  } catch {
    return { configured: false, provider: null, voices: [] };
  }
}

export type SynthesizeResult = { blob: Blob; durationSec: number };

/**
 * Metni sese çevirir. Servis yapılandırılmamışsa TtsNotConfiguredError fırlatır —
 * çağıran taraf kullanıcıya mikrofon alternatifini önerir. Sessizce başarısız olmaz.
 */
export async function synthesize(
  text: string,
  voice: VoiceId,
  opts: { speakingRate?: number } = {}
): Promise<SynthesizeResult> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voice, speakingRate: opts.speakingRate ?? 1, pitch: 0 }),
  });

  if (!res.ok) {
    let message = `TTS isteği başarısız (HTTP ${res.status}).`;
    let code = "";
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      code = data.error ?? "";
      if (data.message) message = data.message;
    } catch {
      /* gövde JSON değilse varsayılan mesaj kalır */
    }
    if (res.status === 503 || code === "TTS_NOT_CONFIGURED") {
      throw new TtsNotConfiguredError(message);
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  if (blob.size === 0) throw new Error("Ses servisi boş dosya döndürdü.");

  return { blob, durationSec: await audioDuration(blob) };
}

/** Ses dosyasının süresini ölçer; okunamazsa 0 döner (sahne süresi değişmez). */
export async function audioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("audio");
    el.preload = "metadata";
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : 0);
    };
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    window.setTimeout(() => done(el.duration), 4000);
    el.src = url;
  });
}
