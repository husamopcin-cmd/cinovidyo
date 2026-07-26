import { NextResponse } from "next/server";
import db from "../../../../../lib/db";

export const dynamic = 'force-dynamic';
import fs from "fs";
import path from "path";
import os from "os";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// Uploads klasörü: data/uploads (repo kökünden)
const uploadsDir = path.resolve(process.cwd(), "../../data/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Proje var mı?
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Mevcut asset sayısı
    const existingCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM assets WHERE project_id = ?").get(projectId) as { cnt: number }
    ).cnt;

    if (existingCount + files.length > 5) {
      return NextResponse.json(
        { error: `Maksimum 5 görsel yüklenebilir. Mevcut: ${existingCount}` },
        { status: 400 }
      );
    }

    const savedAssets: { id: string; name: string; url: string }[] = [];
    const now = new Date().toISOString();

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Desteklenmeyen tür: ${file.type}. Sadece JPEG, PNG, WEBP kabul edilir.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (buffer.length > MAX_SIZE) {
        return NextResponse.json(
          { error: `${file.name} dosyası 10 MB sınırını aşıyor.` },
          { status: 400 }
        );
      }

      const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
      const assetId = "asset_" + Math.random().toString(36).substr(2, 9);
      const fileName = `${assetId}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, buffer);

      // DB'ye kaydet
      db.prepare(
        "INSERT INTO assets (id, project_id, name, file_path, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(assetId, projectId, file.name, filePath, file.type, now);

      savedAssets.push({
        id: assetId,
        name: file.name,
        url: `/api/assets/${assetId}`,
      });
    }

    return NextResponse.json({ success: true, assets: savedAssets });
  } catch (err) {
    console.error("POST /api/projects/[id]/upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
