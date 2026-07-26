import { createRealVideo } from "./render";
import path from "path";
import fs from "fs";

const timestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
};

const parseDurations = (value: string | undefined) => {
  if (!value) {
    return [5, 5, 5];
  }

  const durations = value.split(",").map((part) => Number(part.trim()));

  if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
    throw new Error("Durations must be positive numbers.");
  }

  return durations;
};

async function run() {
  const assetDir = path.resolve(__dirname, "../../../data/test-assets");
  const outputDir = path.resolve(__dirname, "../../../data/outputs");
  fs.mkdirSync(outputDir, { recursive: true });
  
  const imagePaths = [
    path.join(assetDir, "scene-red.png"),
    path.join(assetDir, "scene-green.png"),
    path.join(assetDir, "scene-blue.png"),
  ];

  for (const imagePath of imagePaths) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Missing Tur 5A test asset: ${imagePath}`);
    }
  }

  const durations = parseDurations(process.argv[2]);
  const prefix = process.argv[3] || (durations.join(",") === "5,5,5" ? "tur5a-real-scenes" : "tur5a-duration-test");
  const outPath = path.join(outputDir, `${prefix}-${timestamp()}.mp4`);
  
  console.log("Starting script to generate MP4...");
  console.log(`Scene durations: ${durations.join(" + ")} seconds`);
  await createRealVideo(imagePaths, null, outPath, durations);
  
  const stats = fs.statSync(outPath);
  console.log(`\n========================================`);
  console.log(`SUCCESS: Video generated at ${outPath}`);
  console.log(`File Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`========================================\n`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});