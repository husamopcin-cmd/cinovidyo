import { NextResponse } from "next/server";
import db from "../../../../../lib/db";

export const dynamic = 'force-dynamic';

// PUT /api/projects/[id]/scenes — sahne listesini tamamen güncelle
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { scenes } = await req.json();

    if (!Array.isArray(scenes)) {
      return NextResponse.json({ error: "scenes must be an array" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Transaction: mevcut sahneleri sil, yenilerini ekle
    const deleteAll = db.prepare("DELETE FROM scenes WHERE project_id = ?");
    const insert = db.prepare(`
      INSERT INTO scenes (id, project_id, asset_id, scene_order, duration_in_frames, motion, transition, subtitle, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const txn = db.transaction((sceneList: typeof scenes) => {
      deleteAll.run(projectId);
      sceneList.forEach((s, i) => {
        insert.run(
          s.id,
          projectId,
          s.assetId ?? null,
          i,
          s.durationInFrames ?? 150,
          s.motion ?? "zoom_in",
          s.transition ?? "fade",
          s.subtitle ?? "",
          now
        );
      });
    });

    txn(scenes);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/projects/[id]/scenes error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
