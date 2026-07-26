export * from "../schemas/index";

export type Project = {
  id: string;
  name: string;
  duration: 15 | 30;
  ratio: "9:16";
  status: "DRAFT" | "UPLOADING" | "ANALYZING_AUDIO" | "PREPARING_SCENES" | "QUEUED" | "RENDERING" | "UPLOADING_OUTPUT" | "COMPLETED" | "FAILED" | "CANCELLED";
  voiceMethod: "file" | "text" | null;
  voiceText: string | null;
  voiceProfile: "Kadın-Doğal" | "Kadın-Enerjik" | "Erkek-Doğal" | "Erkek-Ciddi" | null;
};

export type Asset = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  mimeType: string;
};

export type Scene = {
  id: string;
  projectId: string;
  assetId: string;
  durationInFrames: number;
  order: number;
  motion: "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "none";
  transition: "fade" | "cut";
  subtitle?: string;
};

export type RenderJob = {
  id: string;
  projectId: string;
  status: Project["status"];
  progress: number;
  error?: string;
  outputUrl?: string;
};
