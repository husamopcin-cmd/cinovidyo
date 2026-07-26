import { NextResponse } from "next/server";
import db from "../../../../../lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const uploadsDir = path.resolve(process.cwd(), "../../data/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const sources = db
      .prepare("SELECT * FROM project_sources WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId);
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("GET /api/projects/[id]/sources error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const contentType = req.headers.get("content-type") || "";

    const now = new Date().toISOString();
    const sourceId = "src_" + Math.random().toString(36).substr(2, 9);

    if (contentType.includes("application/json")) {
      const { type, content, fileName } = await req.json();
      if (!type || !content) {
        return NextResponse.json({ error: "type and content required" }, { status: 400 });
      }

      db.prepare(
        "INSERT INTO project_sources (id, project_id, type, content, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(sourceId, projectId, type, content, fileName || null, now);

      // Convert text / PDF prompt into initial scenes
      const paragraphs = content
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      const generatedScenes = (paragraphs.length > 0 ? paragraphs.slice(0, 5) : [content]).map(
        (para: string, idx: number) => ({
          id: "s_src_" + idx,
          assetId: null,
          durationInFrames: 150,
          motion: idx % 2 === 0 ? "zoom_in" : "pan_left",
          transition: "fade",
          subtitle: para.length > 60 ? para.substring(0, 57) + "..." : para,
        })
      );

      return NextResponse.json({
        success: true,
        sourceId,
        generatedScenes,
      });
    } else {
      // File upload (PDF or Video)
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4");

      const ext = isPdf ? "pdf" : isVideo ? "mp4" : "file";
      const filePath = path.join(uploadsDir, `${sourceId}.${ext}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const type = isPdf ? "pdf" : isVideo ? "video" : "file";
      const summaryText = isPdf
        ? `📄 ${file.name} (PDF Ders Notu Yüklendi)`
        : `📹 ${file.name} (Hazır Video Yüklendi)`;

      db.prepare(
        "INSERT INTO project_sources (id, project_id, type, content, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(sourceId, projectId, type, summaryText, file.name, now);

      // Create initial scenes based on uploaded file
      const generatedScenes = [
        {
          id: "s_src_1",
          assetId: null,
          durationInFrames: 150,
          motion: "zoom_in",
          transition: "fade",
          subtitle: `📄 ${file.name}: Bölüm 1 Özet`,
        },
        {
          id: "s_src_2",
          assetId: null,
          durationInFrames: 180,
          motion: "pan_left",
          transition: "cut",
          subtitle: `💡 Temel Anlatım & Altyazı Detayı`,
        },
      ];

      return NextResponse.json({
        success: true,
        sourceId,
        fileName: file.name,
        generatedScenes,
      });
    }
  } catch (err) {
    console.error("POST /api/projects/[id]/sources error:", err);
    return NextResponse.json({ error: "Sources API error" }, { status: 500 });
  }
}
