import { Project, RenderJob } from "@cinovidyo/shared";

export interface RenderQueue {
  addJob(job: RenderJob): Promise<void>;
  updateJob(id: string, updates: Partial<RenderJob>): Promise<void>;
  getJob(id: string): Promise<RenderJob | null>;
}

export interface VideoRenderer {
  render(project: Project): Promise<string>;
}

export interface VoiceProvider {
  synthesize(text: string, profile: string): Promise<string>; // returns file path or url
}

export interface StorageProvider {
  uploadFile(filePath: string, destinationPath: string): Promise<string>;
  getFileUrl(path: string): Promise<string>;
}

export interface DatabaseProvider {
  saveProject(project: Project): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
}
