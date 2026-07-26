import { NextResponse } from "next/server";
import db from "../../../../lib/db";

export const dynamic = 'force-dynamic';
import fs from "fs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as {
      file_path: string;
      mime_type: string;
      name: string;
    } | undefined;

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (!fs.existsSync(asset.file_path)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const buffer = fs.readFileSync(asset.file_path);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": asset.mime_type,
        "Content-Disposition": `inline; filename="${asset.name}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("GET /api/assets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
