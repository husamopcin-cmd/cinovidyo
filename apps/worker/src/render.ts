import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import os from "os";


const FPS = 30;

export const createRealVideo = async (
  imagePaths: string[],
  audioPath: string | null,
  outputPath: string,
  sceneDurationSeconds = imagePaths.map(() => 5)
) => {
  console.log("Starting render process...");

  if (imagePaths.length === 0) {
    throw new Error("At least one image path is required to render a video.");
  }

  if (sceneDurationSeconds.length !== imagePaths.length) {
    throw new Error("Scene duration count must match image path count.");
  }
  
  const tempDir = os.tmpdir();
  const bundleLocation = path.join(tempDir, "remotion-bundle");
  
  const templateDir = path.resolve(__dirname, "../../../packages/video-template");
  
  try {
    console.log("Bundling Remotion project at", templateDir);
    const bundled = await bundle({
      entryPoint: path.resolve(templateDir, "src/index.ts"),
      outDir: bundleLocation,
      publicDir: path.resolve(__dirname, "../../../data/test-assets"),
      webpackOverride: (config) => config,
    });
    
    const scenes = imagePaths.map((imgPath, i) => {
      const durationSeconds = sceneDurationSeconds[i];

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error(`Scene ${i + 1} must have a positive duration in seconds.`);
      }

      return {
        id: `scene_${i}`,
        projectId: "test",
        assetId: path.basename(imgPath),
        durationInFrames: Math.round(durationSeconds * FPS),
        order: i,
        motion: ["zoom_in", "zoom_out", "pan_left"][i % 3],
        transition: "fade",
        subtitle: `SAHNE ${i + 1}`
      };
    });

    const inputProps = {
      project: { id: "test", name: "Test", duration: 15, ratio: "9:16", status: "RENDERING", voiceMethod: audioPath ? "file" : null },
      scenes,
      audioUrl: audioPath ? path.resolve(audioPath) : null
    };
    
    console.log("Selecting composition...");
    const composition = await selectComposition({
      serveUrl: bundled,
      id: "CinoVidyo",
      inputProps,
    });
    
    const finalOutputPath = path.resolve(outputPath);
    console.log("Rendering media to", finalOutputPath);
    
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: finalOutputPath,
      inputProps,
      muted: !audioPath,
      enforceAudioTrack: false,
      chromiumOptions: {
        gl: "angle"
      },
      onProgress: ({ progress }) => {
        console.log(`Rendering: ${Math.round(progress * 100)}%`);
      }
    });
    
    console.log("Render complete!");
    return finalOutputPath;
  } catch (error) {
    console.error("Render failed:", error);
    throw error;
  }
};