import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const dbDir = process.env.NODE_ENV === "production" ? path.join(process.cwd(), "../../data") : path.join(os.tmpdir(), "cinovidyo_db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, "projects.db"));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    duration INTEGER NOT NULL DEFAULT 15,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    asset_id TEXT,
    scene_order INTEGER NOT NULL DEFAULT 0,
    duration_in_frames INTEGER NOT NULL DEFAULT 150,
    motion TEXT NOT NULL DEFAULT 'zoom_in',
    transition TEXT NOT NULL DEFAULT 'fade',
    subtitle TEXT DEFAULT '',
    bg_type TEXT DEFAULT 'image',
    bg_data TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    file_name TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

export default db;
