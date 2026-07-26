import { z } from "zod";

export const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Proje adı boş olamaz"),
  duration: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  ratio: z.literal("9:16"),
  status: z.enum([
    "DRAFT",
    "UPLOADING",
    "ANALYZING_AUDIO",
    "PREPARING_SCENES",
    "QUEUED",
    "RENDERING",
    "UPLOADING_OUTPUT",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ]),
});

export const assetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  url: z.string(),
  mimeType: z.string(),
});

export const sceneSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  assetId: z.string().nullable().optional(),
  durationInFrames: z.number().int().positive(),
  order: z.number().int().nonnegative(),
  motion: z.enum(["zoom_in", "zoom_out", "pan_left", "pan_right", "none"]),
  transition: z.enum(["fade", "cut"]),
  subtitle: z.string().optional(),
  bgType: z.enum(["image", "video", "slide"]).optional(),
  bgData: z.string().optional(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
});

export const renderJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: projectSchema.shape.status,
  progress: z.number().min(0).max(100),
  error: z.string().optional(),
  outputUrl: z.string().optional(),
});
