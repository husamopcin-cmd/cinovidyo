// pdf.js worker dosyasını public/ altına kopyalar.
// Böylece PDF okuma harici bir CDN'e bağlanmadan, tamamen yerel çalışır.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");

const pkg = require.resolve("pdfjs-dist/package.json");
const src = path.join(path.dirname(pkg), "build", "pdf.worker.min.mjs");
if (!existsSync(src)) throw new Error(`worker bulunamadı: ${src}`);
mkdirSync(publicDir, { recursive: true });
copyFileSync(src, path.join(publicDir, "pdf.worker.min.mjs"));
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs hazır");
