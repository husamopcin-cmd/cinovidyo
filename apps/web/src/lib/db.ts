import path from "path";
import os from "os";
import fs from "fs";

// Serverless ve client-side uyumlu In-Memory / Supabase / Local Storage fallback katmanı
class MemoryDB {
  private projects: Map<string, any> = new Map();
  private assets: Map<string, any> = new Map();
  private scenes: Map<string, any> = new Map();
  private chatMessages: Map<string, any> = new Map();
  private projectSources: Map<string, any> = new Map();

  constructor() {
    // Statik mock veriler (Örnek projeler)
    const demoId = "demo-123";
    this.projects.set(demoId, {
      id: demoId,
      name: "Örnek Reels Projesi",
      status: "DRAFT",
      duration: 15,
      date: new Date().toISOString(),
    });
  }

  transaction(fn: Function) {
    return (...args: any[]) => {
      return fn(...args);
    };
  }

  prepare(sql: string) {
    const normalized = sql.trim().toLowerCase();

    return {
      all: (...args: any[]) => {
        if (normalized.includes("from projects")) {
          return Array.from(this.projects.values());
        }
        if (normalized.includes("from scenes")) {
          const projectId = args[0];
          return Array.from(this.scenes.values()).filter(
            (s) => s.project_id === projectId
          );
        }
        if (normalized.includes("from assets")) {
          const projectId = args[0];
          return Array.from(this.assets.values()).filter(
            (a) => a.project_id === projectId
          );
        }
        if (normalized.includes("from chat_messages")) {
          const projectId = args[0];
          return Array.from(this.chatMessages.values()).filter(
            (m) => m.project_id === projectId
          );
        }
        return [];
      },
      get: (...args: any[]) => {
        if (normalized.includes("from projects where id = ?")) {
          return this.projects.get(args[0]) || null;
        }
        if (normalized.includes("select count(*) as cnt from assets")) {
          const projectId = args[0];
          const cnt = Array.from(this.assets.values()).filter(
            (a) => a.project_id === projectId
          ).length;
          return { cnt };
        }
        return null;
      },
      run: (...args: any[]) => {
        if (normalized.startsWith("insert into projects")) {
          const [id, name, status, duration, date] = args;
          this.projects.set(id, { id, name, status, duration, date });
        } else if (normalized.startsWith("insert into assets")) {
          const [id, project_id, name, file_path, mime_type, created_at] = args;
          this.assets.set(id, { id, project_id, name, file_path, mime_type, created_at });
        } else if (normalized.startsWith("insert into scenes")) {
          const [id, project_id, asset_id, scene_order, duration_in_frames, motion, transition, subtitle, bg_type, bg_data, created_at] = args;
          this.scenes.set(id, { id, project_id, asset_id, scene_order, duration_in_frames, motion, transition, subtitle, bg_type, bg_data, created_at });
        } else if (normalized.startsWith("insert into chat_messages")) {
          const [id, project_id, role, content, created_at] = args;
          this.chatMessages.set(id, { id, project_id, role, content, created_at });
        } else if (normalized.startsWith("delete from projects")) {
          const id = args[0];
          this.projects.delete(id);
        } else if (normalized.startsWith("delete from scenes")) {
          const projectId = args[0];
          Array.from(this.scenes.entries()).forEach(([sId, scene]) => {
            if (scene.project_id === projectId) {
              this.scenes.delete(sId);
            }
          });
        }
        return { changes: 1 };
      },
    };
  }

  exec(sql: string) {
    return true;
  }
}

const db = new MemoryDB();
export default db;
