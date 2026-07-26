// Yerel (offline) kurgu planlayıcısı.
// API anahtarı olmadan da çalışır: metni sahnelere böler, Türkçe düzenleme
// komutlarını yorumlar ve videoya kalite puanı verir.
// ANTHROPIC_API_KEY tanımlıysa /api/ai/chat gerçek modeli kullanır, yoksa buraya düşer.

import {
  DEFAULT_SUBTITLE_STYLE,
  PALETTE_KEYS,
  newId,
  totalDuration,
  type Motion,
  type Scene,
  type SubtitleStyle,
  type Transition,
} from "./types";

const MOTIONS: Motion[] = ["zoom_in", "pan_right", "zoom_out", "pan_left"];

/** Okuma hızına göre sahne süresi (saniye). */
export function durationForText(text: string): number {
  const secs = Math.max(2.5, Math.min(8, text.trim().length / 13));
  return Math.round(secs * 2) / 2;
}

/** Uzun metni cümlelere böler; madde işaretlerini ve satır sonlarını korur. */
export function splitSentences(raw: string): string[] {
  return raw
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (/^[-•*\d]/.test(trimmed)) return [trimmed.replace(/^[-•*]\s*/, "")];
      return trimmed.split(/(?<=[.!?…])\s+/);
    })
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export type PlanOptions = {
  /** hedef toplam süre (saniye); verilirse sahne süreleri buna göre ölçeklenir */
  targetDuration?: number;
  title?: string;
  tone?: "energetic" | "calm" | "educational";
  maxScenes?: number;
};

/** Serbest metni / ders notunu sahnelere böler. */
export function planFromText(raw: string, opts: PlanOptions = {}): Scene[] {
  const sentences = splitSentences(raw);
  if (sentences.length === 0) return [];

  const maxScenes = opts.maxScenes ?? 12;
  const chunks: string[] = [];
  // Çok kısa cümleleri birleştir, çok uzunları kırp.
  let buffer = "";
  for (const s of sentences) {
    const candidate = buffer ? `${buffer} ${s}` : s;
    if (candidate.length < 45 && chunks.length + 1 < maxScenes) {
      buffer = candidate;
      continue;
    }
    chunks.push(candidate.slice(0, 220));
    buffer = "";
  }
  if (buffer) chunks.push(buffer);

  const limited = chunks.slice(0, maxScenes);
  const energetic = opts.tone === "energetic";
  const calm = opts.tone === "calm";

  const scenes: Scene[] = limited.map((text, i) => ({
    id: newId("sc"),
    kind: "text",
    duration: energetic
      ? Math.max(2.5, durationForText(text) * 0.75)
      : calm
        ? durationForText(text) * 1.25
        : durationForText(text),
    motion: calm ? "zoom_in" : MOTIONS[i % MOTIONS.length],
    transition: energetic ? "cut" : "fade",
    subtitle: text,
    title: i === 0 && opts.title ? opts.title : undefined,
    palette: PALETTE_KEYS[i % PALETTE_KEYS.length],
  }));

  if (opts.targetDuration && scenes.length > 0) {
    const factor = opts.targetDuration / totalDuration(scenes);
    for (const s of scenes) {
      s.duration = Math.round(Math.max(1.5, s.duration * factor) * 2) / 2;
    }
  }
  return scenes;
}

/** Görsel/video dosyalarından sahne dizisi kurar. */
export function planFromAssets(
  assets: Array<{ id: string; kind: "image" | "video" | "audio"; name: string }>,
  perScene = 4
): Scene[] {
  return assets
    .filter((a) => a.kind !== "audio")
    .map((a, i) => ({
      id: newId("sc"),
      kind: a.kind === "video" ? ("video" as const) : ("image" as const),
      assetId: a.id,
      duration: perScene,
      motion: a.kind === "video" ? "none" : MOTIONS[i % MOTIONS.length],
      transition: "fade" as Transition,
      subtitle: "",
      palette: PALETTE_KEYS[i % PALETTE_KEYS.length],
    }));
}

/* ── Türkçe düzenleme komutları ── */

const COLOR_WORDS: Record<string, string> = {
  sarı: "#facc15",
  beyaz: "#ffffff",
  kırmızı: "#ef4444",
  kirmizi: "#ef4444",
  yeşil: "#22c55e",
  yesil: "#22c55e",
  mavi: "#60a5fa",
  turuncu: "#fb923c",
  siyah: "#111111",
  pembe: "#f472b6",
};

export type CommandResult = {
  reply: string;
  scenes?: Scene[];
  subtitleStyle?: SubtitleStyle;
  /** komut anlaşılamadıysa true — kullanıcıya dürüstçe söylenir */
  unhandled?: boolean;
};

/**
 * Kullanıcının doğal dil komutunu mevcut kurguya uygular.
 * Sadece anladığı komutu uygular; anlamadıysa `unhandled` döner ve
 * kullanıcıya "bunu yapamadım" der (sahte başarı mesajı vermez).
 */
export function applyCommand(
  message: string,
  scenes: Scene[],
  subtitleStyle: SubtitleStyle = DEFAULT_SUBTITLE_STYLE
): CommandResult {
  const m = message.toLocaleLowerCase("tr");
  const next = scenes.map((s) => ({ ...s }));

  // 1) Altyazı rengi
  if (/altyaz|yazı|yazi/.test(m)) {
    for (const [word, hex] of Object.entries(COLOR_WORDS)) {
      if (m.includes(word)) {
        return {
          reply: `Altyazı rengi ${word} yapıldı.`,
          subtitleStyle: { ...subtitleStyle, color: hex },
        };
      }
    }
    if (/büyü|buyu|iri/.test(m)) {
      return {
        reply: "Altyazı punto boyutu büyütüldü.",
        subtitleStyle: { ...subtitleStyle, size: Math.min(96, subtitleStyle.size + 12) },
      };
    }
    if (/küçül|kucul/.test(m)) {
      return {
        reply: "Altyazı punto boyutu küçültüldü.",
        subtitleStyle: { ...subtitleStyle, size: Math.max(28, subtitleStyle.size - 12) },
      };
    }
    if (/üst|ust/.test(m)) {
      return { reply: "Altyazı üst tarafa alındı.", subtitleStyle: { ...subtitleStyle, position: "top" } };
    }
    if (/orta/.test(m)) {
      return { reply: "Altyazı ortaya alındı.", subtitleStyle: { ...subtitleStyle, position: "center" } };
    }
    if (/alt/.test(m)) {
      return { reply: "Altyazı alta alındı.", subtitleStyle: { ...subtitleStyle, position: "bottom" } };
    }
  }

  // 2) Sahne silme
  if (/(sil|kaldır|kaldir|çıkar|cikar)/.test(m) && next.length > 0) {
    if (/son/.test(m)) {
      const removed = next.pop();
      return { reply: `Son sahne silindi${removed?.subtitle ? `: "${removed.subtitle.slice(0, 40)}"` : ""}.`, scenes: next };
    }
    if (/ilk|birinci/.test(m)) {
      next.shift();
      return { reply: "İlk sahne silindi.", scenes: next };
    }
    const idx = m.match(/(\d+)\s*\.?\s*sahne/);
    if (idx) {
      const i = parseInt(idx[1], 10) - 1;
      if (i >= 0 && i < next.length) {
        next.splice(i, 1);
        return { reply: `${i + 1}. sahne silindi.`, scenes: next };
      }
    }
  }

  // 3) Toplam süre hedefi ("30 saniye olsun", "1 dakika yap")
  const durMatch = m.match(/(\d+)\s*(saniye|sn|dakika|dk)/);
  if (durMatch && next.length > 0) {
    const value = parseInt(durMatch[1], 10);
    const target = /dakika|dk/.test(durMatch[2]) ? value * 60 : value;
    const factor = target / Math.max(0.5, totalDuration(next));
    for (const s of next) s.duration = Math.round(Math.max(1.2, s.duration * factor) * 2) / 2;
    return { reply: `Toplam süre ~${target} saniyeye ayarlandı (${next.length} sahne).`, scenes: next };
  }

  // 4) Tempo
  if (/(hızlan|hizlan|tempolu|enerjik|reels|tiktok|shorts|hareketli)/.test(m)) {
    next.forEach((s, i) => {
      s.duration = Math.max(1.5, Math.round(s.duration * 0.65 * 2) / 2);
      s.transition = "cut";
      if (s.kind !== "video") s.motion = MOTIONS[i % MOTIONS.length];
    });
    return {
      reply: `Kurgu hızlandırıldı: sahneler kısaltıldı, sert kesme ve hareket eklendi. Yeni toplam süre ${totalDuration(next).toFixed(1)} sn.`,
      scenes: next,
    };
  }
  if (/(yavaş|yavas|sakin|premium|sinematik|belgesel)/.test(m)) {
    next.forEach((s) => {
      s.duration = Math.round(s.duration * 1.4 * 2) / 2;
      s.transition = "fade";
      if (s.kind !== "video") s.motion = "zoom_in";
    });
    return {
      reply: `Sinematik moda geçildi: yumuşak geçişler, yavaş zoom. Yeni toplam süre ${totalDuration(next).toFixed(1)} sn.`,
      scenes: next,
    };
  }

  // 5) Hook / giriş
  if (/(hook|giriş|giris|ilk 3|ilk üç|başlangıç|baslangic)/.test(m) && next.length > 0) {
    next[0] = {
      ...next[0],
      duration: Math.min(next[0].duration, 2.5),
      motion: "zoom_in",
      transition: "cut",
      subtitle: next[0].subtitle || "Bunu bilmiyordun!",
    };
    return { reply: "Açılış sahnesi kısaltılıp dikkat çekici hale getirildi (hook).", scenes: next };
  }

  // 6) Altyazı metnini değiştir: `1. sahne: yeni metin`
  const sceneText = message.match(/(\d+)\s*\.?\s*sahne\s*[:=]\s*(.+)/i);
  if (sceneText) {
    const i = parseInt(sceneText[1], 10) - 1;
    if (i >= 0 && i < next.length) {
      next[i] = { ...next[i], subtitle: sceneText[2].trim() };
      return { reply: `${i + 1}. sahnenin altyazısı güncellendi.`, scenes: next };
    }
  }

  // 7) Uzun metin yapıştırıldıysa -> kurguyu ondan üret
  if (message.trim().length > 120) {
    const generated = planFromText(message, { tone: "educational" });
    if (generated.length > 0) {
      return {
        reply: `Metnini ${generated.length} sahneye böldüm (~${totalDuration(generated).toFixed(0)} sn). Sağdaki zaman çizelgesinden düzenleyebilirsin.`,
        scenes: generated,
      };
    }
  }

  return {
    reply:
      "Bu komutu yerel planlayıcı çözemedi. Şunları deneyebilirsin: “30 saniye olsun”, “altyazıyı sarı yap”, “daha tempolu yap”, “son sahneyi sil”, “2. sahne: yeni metin”. Gerçek AI için sunucuya ANTHROPIC_API_KEY eklemen gerekir.",
    unhandled: true,
  };
}

/* ── Kalite analizi (Faz 6) ── */

export type QualityReport = {
  hook: number;
  tempo: number;
  subtitle: number;
  length: number;
  overall: number;
  notes: string[];
};

export function analyze(scenes: Scene[]): QualityReport {
  const notes: string[] = [];
  const total = totalDuration(scenes);
  const first = scenes[0];

  let hook = 5;
  if (first) {
    if (first.duration <= 3) hook += 3;
    else notes.push("Açılış sahnesi uzun; ilk sahneyi 2-3 saniyeye indir.");
    if (first.subtitle.trim().length > 0) hook += 2;
    else notes.push("İlk sahnede altyazı yok; izleyiciyi ilk saniyede yakalayan bir cümle ekle.");
  } else {
    hook = 0;
    notes.push("Hiç sahne yok.");
  }

  const avg = scenes.length ? total / scenes.length : 0;
  let tempo = 10;
  if (avg > 6) {
    tempo = 5;
    notes.push(`Sahne başına ortalama ${avg.toFixed(1)} sn — dikey videolar için uzun.`);
  } else if (avg < 1.5 && scenes.length > 0) {
    tempo = 6;
    notes.push("Sahneler çok kısa; izleyici okumaya yetişemeyebilir.");
  }

  const withSub = scenes.filter((s) => s.subtitle.trim()).length;
  const subtitle = scenes.length ? Math.round((withSub / scenes.length) * 10) : 0;
  if (subtitle < 8) notes.push("Bazı sahnelerde altyazı yok; sessiz izleyenler için altyazı ekle.");

  let length = 10;
  if (total > 90) {
    length = 5;
    notes.push(`Toplam ${total.toFixed(0)} sn — Reels/Shorts için 60 sn altı daha iyi.`);
  } else if (total < 5) {
    length = 4;
    notes.push("Video çok kısa.");
  }

  const overall = Math.round((hook + tempo + subtitle + length) / 4);
  if (notes.length === 0) notes.push("Kurgu dengeli görünüyor.");
  return { hook, tempo, subtitle, length, overall, notes };
}
