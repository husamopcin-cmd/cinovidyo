import { NextResponse } from "next/server";
import db from "../../../lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stmt = db.prepare("SELECT * FROM projects ORDER BY date DESC");
    const projects = stmt.all();
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, status = "DRAFT", duration = 15 } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    const date = new Date().toISOString();
    const stmt = db.prepare(
      "INSERT INTO projects (id, name, status, duration, date) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, name, status, duration, date);

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
