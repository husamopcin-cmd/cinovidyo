import { NextResponse } from "next/server";
import db from "../../../../lib/db";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const scenes = db
      .prepare("SELECT * FROM scenes WHERE project_id = ? ORDER BY scene_order ASC")
      .all(id);
    const assets = db
      .prepare("SELECT * FROM assets WHERE project_id = ?")
      .all(id);
    return NextResponse.json({ project, scenes, assets });
  } catch (err) {
    console.error("GET /api/projects/[id] error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
