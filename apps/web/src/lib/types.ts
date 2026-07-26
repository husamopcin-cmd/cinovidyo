// CinoVid AI Studio — istemci tarafı veri modelleri.
// Tüm veriler kullanıcının tarayıcısında (IndexedDB) tutulur; sunucu veritabanı yoktur.

export type Motion = "none" | "zoom_in" | "zoom_out" | "pan_left" | "pan_right";
export type Transition = "cut" | "fade";
export type SceneKind = "image" | "video" | "text";
export type VisualStyle = "sunrise" | "focus" | "growth" | "energy" | "steps" | "minimal" | "cat" | "home";

export type SubtitleStyle = {
  color: string;
  size: number; // 1080px genişliğe göre px
  position: "top" | "center" | "bottom";
  background: boolean;
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  color: "#ffffff",
  size: 58,
  position: "bottom",
  background: true,
};

export type Scene = {
  id: string;
  kind: SceneKind;
  /** image/video sahnelerinde Asset.id */
  assetId?: string;
  /** saniye */
  duration: number;
  motion: Motion;
  transition: Transition;
  subtitle: string;
  /** text sahneleri için başlık */
  title?: string;
  /** text sahneleri için arka plan gradyanı */
  palette?: string;
  /** görselsiz sahnelerde kullanılan hareketli illüstrasyon */
  visual?: VisualStyle;
};

export type Asset = {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  kind: "image" | "video" | "audio";
  blob: Blob;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ProjectVersion = {
  label: string;
  createdAt: string;
  scenes: Scene[];
};

export type Project = {
  id: string;
  name: string;
  /** projenin nasıl başladığı: görsel / metin / pdf / video / sohbet */
  source: "images" | "text" | "pdf" | "video" | "chat";
  scenes: Scene[];
  chat: ChatMessage[];
  versions: ProjectVersion[];
  subtitleStyle: SubtitleStyle;
  /** arka plan müziği için Asset.id */
  audioAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

export const PALETTES: Record<string, [string, string]> = {
  violet: ["#4c1d95", "#7c3aed"],
  ocean: ["#0c4a6e", "#0891b2"],
  sunset: ["#7c2d12", "#db2777"],
  forest: ["#064e3b", "#059669"],
  night: ["#0f172a", "#334155"],
  gold: ["#78350f", "#d97706"],
};

export const PALETTE_KEYS = Object.keys(PALETTES);

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const FPS = 30;

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
}
