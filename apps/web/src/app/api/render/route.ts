import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import db from "../../../lib/db";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, scenes } = body as {
      projectId?: string;
      scenes?: Array<{
        id: string;
        assetId?: string;
        durationInFrames?: number;
        motion?: string;
        transition?: string;
        subtitle?: string;
      }>;
    };

    // Serverless Free Tier dürüst kılavuz kontrolü (Vercel serverless ortamında mıyız?)
    const isServerlessEnvironment = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerlessEnvironment) {
      return NextResponse.json({
        status: "CLIENT_RENDER_REQUIRED",
        message: "Serverless (Vercel Free) ortamında sunucu tarafı 5 dakikalık ağır Chromium/FFmpeg renderı devre dışıdır. Tarayıcı (Client-side) önizleme veya Render.com Free Worker kullanınız.",
        notice: "CinoVidyo Free MVP: Tarayıcınızda anlık video önizleme ve dışa aktarma moduna geçildi."
      });
    }

    let imagePaths: string[] = [];
    let durations: number[] = [];
    let useTestAssets = false;

    if (scenes && scenes.length > 0 && projectId) {
      for (const scene of scenes) {
        if (scene.assetId) {
          const asset = db
            .prepare("SELECT file_path FROM assets WHERE id = ?")
            .get(scene.assetId) as { file_path: string } | undefined;
          if (asset && fs.existsSync(asset.file_path)) {
            imagePaths.push(asset.file_path);
            durations.push(Math.round((scene.durationInFrames ?? 150) / 30));
            continue;
          }
        }
        const fallback = [
          path.resolve(process.cwd(), "../../data/test-assets/scene-red.png"),
          path.resolve(process.cwd(), "../../data/test-assets/scene-green.png"),
          path.resolve(process.cwd(), "../../data/test-assets/scene-blue.png"),
        ];
        imagePaths.push(fallback[imagePaths.length % 3]);
        durations.push(Math.round((scene.durationInFrames ?? 150) / 30));
      }
    } else {
      useTestAssets = true;
      const assetDir = path.resolve(process.cwd(), "../../data/test-assets");
      imagePaths = [
        path.join(assetDir, "scene-red.png"),
        path.join(assetDir, "scene-green.png"),
        path.join(assetDir, "scene-blue.png"),
      ];
      durations = [5, 5, 5];
    }

    const durationsArg = durations.join(",");
    const prefix = useTestAssets ? "test-render" : `proj-${projectId ?? "unknown"}`;
    const workerTestScript = path.resolve(
      process.cwd(),
      "../../apps/worker/src/test-render.ts"
    );

    const outputDir = path.resolve(process.cwd(), "../../data/outputs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise<NextResponse>((resolve) => {
      const cmd = `npx ts-node --project "${path.resolve(process.cwd(), "../../apps/worker/tsconfig.json")}" "${workerTestScript}" "${durationsArg}" "${prefix}"`;

      exec(cmd, { cwd: path.resolve(process.cwd(), "../../apps/worker") }, (error, stdout, stderr) => {
        if (error) {
          resolve(
            NextResponse.json(
              { error: "Render yerel ortamda başarısız", detail: stderr.slice(-500) },
              { status: 500 }
            )
          );
          return;
        }

        const files = fs
          .readdirSync(outputDir)
          .filter((f) => f.startsWith(prefix) && f.endsWith(".mp4"))
          .map((f) => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);

        const outputFile = files[0]?.name;

        if (outputFile) {
          const destFile = path.resolve(process.cwd(), "public/output.mp4");
          fs.copyFileSync(path.join(outputDir, outputFile), destFile);
          resolve(
            NextResponse.json({
              status: "COMPLETED",
              videoUrl: `/output.mp4?t=${Date.now()}`,
              outputFile,
            })
          );
        } else {
          resolve(
            NextResponse.json(
              { error: "Output dosyası bulunamadı" },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (err) {
    console.error("Render API error:", err);
    return NextResponse.json({ error: "Render başarısız" }, { status: 500 });
  }
}
