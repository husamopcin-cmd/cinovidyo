import { NextResponse } from "next/server";

/**
 * Sentetik seslendirme (TTS) uç noktası.
 *
 * Sağlayıcıya bağımlı değildir; ortam değişkenlerine göre seçilir:
 *   TTS_PROVIDER=google  + TTS_API_KEY                → Google Cloud Text-to-Speech
 *   TTS_PROVIDER=custom  + TTS_API_URL [+ TTS_API_KEY] → kendi HTTP uç noktan
 *   (tanımsız)                                        → 503, açık "yapılandırılmamış" yanıtı
 *
 * Anahtar yalnızca sunucuda kalır; istemciye hiçbir zaman gönderilmez.
 * Yanıt her zaman ses baytlarıdır (audio/mpeg veya sağlayıcının döndürdüğü tür).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type VoiceId = "tr-female" | "tr-male";

const MAX_CHARS = 2000;

/** Cinsiyet takma adlarının Google Cloud ses adlarına eşlenmesi. */
const GOOGLE_VOICES: Record<VoiceId, { name: string; ssmlGender: "FEMALE" | "MALE" }> = {
  "tr-female": { name: "tr-TR-Standard-A", ssmlGender: "FEMALE" },
  "tr-male": { name: "tr-TR-Standard-B", ssmlGender: "MALE" },
};

type Body = {
  text?: string;
  voice?: string;
  speakingRate?: number;
  pitch?: number;
};

function notConfigured() {
  return NextResponse.json(
    {
      error: "TTS_NOT_CONFIGURED",
      message:
        "Sentetik ses servisi yapılandırılmamış. Sunucuya TTS_PROVIDER ve TTS_API_KEY (veya TTS_API_URL) eklenmeli. Bu arada sahne için “Kendi sesimi kaydet” seçeneğini kullanabilirsin.",
    },
    { status: 503 }
  );
}

export async function GET() {
  // İstemci, arayüzü doğru çizebilmek için servisin açık olup olmadığını sorar.
  const provider = process.env.TTS_PROVIDER;
  const configured =
    (provider === "google" && !!process.env.TTS_API_KEY) ||
    (provider === "custom" && !!process.env.TTS_API_URL);
  return NextResponse.json({
    configured,
    provider: configured ? provider : null,
    voices: configured ? (["tr-female", "tr-male"] satisfies VoiceId[]) : [],
  });
}

export async function POST(req: Request) {
  const provider = process.env.TTS_PROVIDER;
  if (!provider) return notConfigured();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "BAD_JSON", message: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json(
      { error: "EMPTY_TEXT", message: "Seslendirilecek metin boş." },
      { status: 400 }
    );
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      {
        error: "TEXT_TOO_LONG",
        message: `Metin çok uzun (${text.length} karakter). En fazla ${MAX_CHARS} karakter.`,
      },
      { status: 400 }
    );
  }

  const voice: VoiceId = body.voice === "tr-male" ? "tr-male" : "tr-female";
  const speakingRate = clamp(body.speakingRate ?? 1, 0.5, 2);
  const pitch = clamp(body.pitch ?? 0, -10, 10);

  try {
    if (provider === "google") {
      const key = process.env.TTS_API_KEY;
      if (!key) return notConfigured();
      return await synthesizeGoogle({ key, text, voice, speakingRate, pitch });
    }

    if (provider === "custom") {
      const url = process.env.TTS_API_URL;
      if (!url) return notConfigured();
      return await synthesizeCustom({ url, key: process.env.TTS_API_KEY, text, voice, speakingRate, pitch });
    }

    return NextResponse.json(
      {
        error: "UNKNOWN_PROVIDER",
        message: `Tanınmayan TTS_PROVIDER değeri: ${provider}. "google" veya "custom" olmalı.`,
      },
      { status: 500 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "TTS_FAILED",
        message: `Ses üretilemedi: ${err instanceof Error ? err.message : "bilinmeyen hata"}`,
      },
      { status: 502 }
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function synthesizeGoogle(opts: {
  key: string;
  text: string;
  voice: VoiceId;
  speakingRate: number;
  pitch: number;
}) {
  const { name, ssmlGender } = GOOGLE_VOICES[opts.voice];
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(opts.key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { text: opts.text },
        voice: { languageCode: "tr-TR", name, ssmlGender },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: opts.speakingRate,
          pitch: opts.pitch,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google TTS ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("Google TTS ses döndürmedi.");

  const bytes = Buffer.from(data.audioContent, "base64");
  if (bytes.length === 0) throw new Error("Google TTS boş ses döndürdü.");

  return new NextResponse(new Uint8Array(bytes), {
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
}

async function synthesizeCustom(opts: {
  url: string;
  key?: string;
  text: string;
  voice: VoiceId;
  speakingRate: number;
  pitch: number;
}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.key) headers.authorization = `Bearer ${opts.key}`;

  const res = await fetch(opts.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: opts.text,
      voice: opts.voice,
      language: "tr-TR",
      speakingRate: opts.speakingRate,
      pitch: opts.pitch,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`TTS sağlayıcısı ${res.status}: ${detail.slice(0, 300)}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Sağlayıcı base64 JSON döndürüyorsa da destekle.
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as { audioContent?: string; audio?: string };
    const base64 = data.audioContent ?? data.audio;
    if (!base64) throw new Error("Sağlayıcı JSON yanıtında ses alanı yok.");
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0) throw new Error("Sağlayıcı boş ses döndürdü.");
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error("Sağlayıcı boş ses döndürdü.");
  return new NextResponse(buffer, {
    headers: {
      "content-type": contentType || "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
