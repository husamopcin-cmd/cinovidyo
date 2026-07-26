import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// İsteğe bağlı gerçek AI katmanı.
// ANTHROPIC_API_KEY tanımlı değilse 503 döner ve istemci yerel planlayıcıya düşer.
// Sunucuda hiçbir proje verisi saklanmaz; sadece kurgu planı üretilir.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MOTIONS = ["none", "zoom_in", "zoom_out", "pan_left", "pan_right"] as const;
const TRANSITIONS = ["cut", "fade"] as const;
const PALETTES = ["violet", "ocean", "sunset", "forest", "night", "gold"] as const;

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "Kullanıcıya gösterilecek kısa Türkçe cevap (en fazla 2 cümle).",
    },
    changeScenes: {
      type: "boolean",
      description: "Sahne listesi değiştirilecekse true, sadece sohbet ise false.",
    },
    scenes: {
      type: "array",
      description: "changeScenes true ise yeni sahne listesi, değilse boş dizi.",
      items: {
        type: "object",
        properties: {
          subtitle: { type: "string", description: "Ekranda görünecek metin." },
          duration: { type: "number", description: "Saniye cinsinden süre (1.5 - 10)." },
          motion: { type: "string", enum: [...MOTIONS] },
          transition: { type: "string", enum: [...TRANSITIONS] },
          palette: { type: "string", enum: [...PALETTES] },
        },
        required: ["subtitle", "duration", "motion", "transition", "palette"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "changeScenes", "scenes"],
  additionalProperties: false,
} as const;

const SYSTEM = `Sen CinoVid AI Studio'nun kurgu asistanısın. Kullanıcı 9:16 dikey kısa video hazırlıyor.
Görevin: kullanıcının Türkçe talebini anlayıp video sahnelerini planlamak.

Kurallar:
- Cevapların Türkçe ve kısa olsun.
- Sahne altyazıları ekranda okunacak; her sahne en fazla 120 karakter.
- Süreler metnin okunma hızına uygun olsun (kısa metin 2-3 sn, uzun metin 5-7 sn).
- Reels/TikTok istenirse sahneleri kısalt ve transition "cut" kullan; sinematik/sakin istenirse "fade" ve daha uzun süre kullan.
- Kullanıcı sadece soru soruyorsa veya sohbet ediyorsa changeScenes=false ver ve scenes boş dizi olsun.
- Yapamadığın bir şey istenirse dürüstçe söyle; olmayan bir özelliği yapmış gibi anlatma.`;

type Scene = {
  subtitle: string;
  duration: number;
  motion: string;
  transition: string;
  palette: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI_DISABLED",
        message:
          "Sunucuda ANTHROPIC_API_KEY tanımlı değil. Yerel planlayıcı kullanılıyor (ücretsiz, çevrimdışı).",
      },
      { status: 503 }
    );
  }

  let message: string;
  let scenes: Scene[];
  try {
    const body = (await req.json()) as { message?: string; scenes?: Scene[] };
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message alanı zorunlu" }, { status: 400 });
    }
    message = body.message.slice(0, 8000);
    scenes = Array.isArray(body.scenes) ? body.scenes.slice(0, 40) : [];
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: PLAN_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Mevcut sahneler (JSON):\n${JSON.stringify(scenes)}\n\nKullanıcının isteği:\n${message}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "REFUSED", message: "Model bu isteği yanıtlamayı reddetti." },
        { status: 422 }
      );
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      return NextResponse.json(
        { error: "EMPTY", message: "Model boş yanıt döndürdü." },
        { status: 502 }
      );
    }

    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "AUTH", message: "ANTHROPIC_API_KEY geçersiz." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "RATE_LIMIT", message: "AI kotası doldu, biraz sonra tekrar dene." },
        { status: 429 }
      );
    }
    const detail = err instanceof Error ? err.message : "bilinmeyen hata";
    return NextResponse.json({ error: "AI_ERROR", message: detail }, { status: 502 });
  }
}
