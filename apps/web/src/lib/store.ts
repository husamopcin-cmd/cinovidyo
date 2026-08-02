"use client";

// IndexedDB tabanlı yerel depolama.
// Projeler ve yüklenen dosyalar (Blob) kullanıcının cihazında saklanır.
// Sunucuya hiçbir dosya gönderilmez -> ücretsiz, kotasız, gizlilik dostu.

import type { Asset, Project } from "./types";

const DB_NAME = "cinovid-studio";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_ASSETS = "assets";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Bu tarayıcı IndexedDB desteklemiyor."));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          const assets = db.createObjectStore(STORE_ASSETS, { keyPath: "id" });
          assets.createIndex("projectId", "projectId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB açılamadı"));
    });
  }
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB işlemi başarısız"));
      })
  );
}

/* ── Projeler ── */

export async function listProjects(): Promise<Project[]> {
  const all = await tx<Project[]>(STORE_PROJECTS, "readonly", (s) => s.getAll());
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getProject(id: string): Promise<Project | null> {
  const p = await tx<Project | undefined>(STORE_PROJECTS, "readonly", (s) => s.get(id));
  return p ?? null;
}

export async function saveProject(project: Project): Promise<Project> {
  const next = { ...project, updatedAt: new Date().toISOString() };
  await tx(STORE_PROJECTS, "readwrite", (s) => s.put(next));
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  const assets = await listAssets(id);
  await Promise.all(assets.map((a) => deleteAsset(a.id)));
  await tx(STORE_PROJECTS, "readwrite", (s) => s.delete(id));
}

/* ── Dosyalar (görsel / video / ses) ── */

export async function putAsset(asset: Asset): Promise<void> {
  await tx(STORE_ASSETS, "readwrite", (s) => s.put(asset));
}

export async function getAsset(id: string): Promise<Asset | null> {
  const a = await tx<Asset | undefined>(STORE_ASSETS, "readonly", (s) => s.get(id));
  return a ?? null;
}

export async function listAssets(projectId: string): Promise<Asset[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_ASSETS, "readonly");
    const idx = t.objectStore(STORE_ASSETS).index("projectId");
    const req = idx.getAll(projectId);
    req.onsuccess = () => resolve(req.result as Asset[]);
    req.onerror = () => reject(req.error ?? new Error("Dosyalar okunamadı"));
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await tx(STORE_ASSETS, "readwrite", (s) => s.delete(id));
}

/* ── Taşınabilir proje yedeği ── */

type ProjectBackup = {
  format: "cinovid-project";
  version: 1;
  exportedAt: string;
  project: Project;
  assets: Array<Omit<Asset, "blob"> & { dataUrl: string }>;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Dosya yedeğe eklenemedi."));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export async function exportProjectBackup(id: string): Promise<Blob> {
  const project = await getProject(id);
  if (!project) throw new Error("Proje bulunamadı.");
  const assets = await listAssets(id);
  const packedAssets = await Promise.all(
    assets.map(async ({ blob, ...asset }) => ({ ...asset, dataUrl: await blobToDataUrl(blob) }))
  );
  const backup: ProjectBackup = {
    format: "cinovid-project",
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    assets: packedAssets,
  };
  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

export async function importProjectBackup(file: File): Promise<Project> {
  const backup = JSON.parse(await file.text()) as Partial<ProjectBackup>;
  if (backup.format !== "cinovid-project" || backup.version !== 1 || !backup.project) {
    throw new Error("Bu dosya geçerli bir CinoVid proje yedeği değil.");
  }
  const project = backup.project;
  await saveProject(project);
  for (const packed of backup.assets ?? []) {
    const { dataUrl, ...asset } = packed;
    await putAsset({ ...asset, blob: dataUrlToBlob(dataUrl) });
  }
  return project;
}

/* ── Depolama kotası ── */

export async function storageEstimate(): Promise<{ usedMB: number; quotaMB: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  if (est.usage == null || est.quota == null) return null;
  return {
    usedMB: Math.round((est.usage / 1024 / 1024) * 10) / 10,
    quotaMB: Math.round(est.quota / 1024 / 1024),
  };
}
