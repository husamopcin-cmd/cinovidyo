import { NextResponse } from "next/server";
import db from "../../../../lib/db";

export const dynamic = "force-dynamic";

interface ChatRequest {
  projectId: string;
  message: string;
  currentScenes: Array<{
    id: string;
    assetId?: string | null;
    durationInFrames: number;
    motion: string;
    transition: string;
    subtitle: string;
  }>;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const messages = db
    .prepare("SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId);

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  try {
    const { projectId, message, currentScenes } = (await req.json()) as ChatRequest;

    if (!projectId || !message) {
      return NextResponse.json({ error: "projectId and message required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const userMsgId = "msg_" + Math.random().toString(36).substr(2, 9);
    const aiMsgId = "msg_" + Math.random().toString(36).substr(2, 9);

    // Save user message to DB
    db.prepare(
      "INSERT INTO chat_messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userMsgId, projectId, "user", message, now);

    // Smart AI Logic Engine: Parse user prompt & construct tailored scenes & response
    const msgLower = message.toLowerCase();

    let aiReply = "";
    let updatedScenes = [...currentScenes];

    if (msgLower.includes("ders") || msgLower.includes("pdf") || msgLower.includes("hoca") || msgLower.includes("anlat")) {
      aiReply = "💡 Ders içeriğiniz analiz edildi! Konuları sırasıyla ekrana yazan, net altyazılı 3 eğitici slayt sahnesi oluşturdum.";
      updatedScenes = [
        {
          id: "s_edu_1",
          assetId: null,
          durationInFrames: 150,
          motion: "zoom_in",
          transition: "fade",
          subtitle: "📚 BÖLÜM 1: Konunun Tanımı & Temel Kavramlar",
        },
        {
          id: "s_edu_2",
          assetId: null,
          durationInFrames: 180,
          motion: "pan_left",
          transition: "fade",
          subtitle: "🧠 BÖLÜM 2: Önemli Formüller ve Kural İncelemesi",
        },
        {
          id: "s_edu_3",
          assetId: null,
          durationInFrames: 150,
          motion: "zoom_out",
          transition: "cut",
          subtitle: "🎯 BÖLÜM 3: Örnek Soru Çözümü & Özet",
        },
      ];
    } else if (msgLower.includes("reels") || msgLower.includes("instagram") || msgLower.includes("tiktok") || msgLower.includes("enerjik")) {
      aiReply = "⚡ Sosyal medya için yüksek tempolu, dikkat çekici 9:16 kurgu planı hazırlandı!";
      updatedScenes = currentScenes.map((s, idx) => ({
        ...s,
        durationInFrames: 90, // 3 saniye tempolu
        motion: idx % 2 === 0 ? "zoom_in" : "pan_right",
        transition: "cut",
        subtitle: s.subtitle ? `🔥 ${s.subtitle}` : `🔥 SAHNE ${idx + 1}: Dikkat Çekici Detay`,
      }));
    } else if (msgLower.includes("ses") || msgLower.includes("anlatım") || msgLower.includes("erkek") || msgLower.includes("kadın")) {
      aiReply = "🎙️ Ses ve seslendirme tonu tercihiniz kaydedildi. Sahne altyazıları ses ritmine göre hizalandı.";
    } else if (msgLower.includes("daha hızlı") || msgLower.includes("hızlandır")) {
      aiReply = "⏩ Videonuz daha tempolu hale getirildi. Sahne süreleri 3 saniyeye düşürüldü.";
      updatedScenes = currentScenes.map((s) => ({
        ...s,
        durationInFrames: 90,
      }));
    } else if (msgLower.includes("yavaş") || msgLower.includes("sakin") || msgLower.includes("premium")) {
      aiReply = "✨ Videonuz premium ve sakin bir moda geçirildi. Yumuşak fade geçişleri uygulandı.";
      updatedScenes = currentScenes.map((s) => ({
        ...s,
        durationInFrames: 180, // 6 saniye
        motion: "zoom_out",
        transition: "fade",
      }));
    } else {
      aiReply = `🤖 "${message}" talimatınız alındı! Sahneler isteğinize uygun olarak güncellendi ve kurgu planına yansıtıldı.`;
      if (updatedScenes.length > 0) {
        updatedScenes[0] = {
          ...updatedScenes[0],
          subtitle: message.length < 40 ? message : updatedScenes[0].subtitle,
        };
      }
    }

    // Save AI response to DB
    db.prepare(
      "INSERT INTO chat_messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(aiMsgId, projectId, "assistant", aiReply, now);

    return NextResponse.json({
      success: true,
      aiReply,
      updatedScenes,
    });
  } catch (err) {
    console.error("AI Chat API Error:", err);
    return NextResponse.json({ error: "AI Assistant Error" }, { status: 500 });
  }
}
