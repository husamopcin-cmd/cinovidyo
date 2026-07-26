import { z } from "zod";

export const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Proje adı boş olamaz"),
  duration: z.union([z.literal(15), z.literal(30)]),
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
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  mimeType: z.string().refine((val) => allowedMimeTypes.includes(val), {
    message: "Desteklenmeyen dosya türü",
  }),
});

export const sceneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  durationInFrames: z.number().int().positive(),
  order: z.number().int().nonnegative(),
  motion: z.enum(["zoom_in", "zoom_out", "pan_left", "pan_right", "none"]),
  transition: z.enum(["fade", "cut"]),
  subtitle: z.string().optional(),
});

export const renderJobSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: projectSchema.shape.status,
  progress: z.number().min(0).max(100),
  error: z.string().optional(),
  outputUrl: z.string().optional(),
});
