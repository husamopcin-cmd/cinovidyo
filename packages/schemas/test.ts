import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { projectSchema, assetSchema } from "./index";

/** packages/schemas -> depo kökü */
const repoRoot = path.resolve(process.cwd(), "..", "..");

function runTests() {
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  };

  // Test 1: Project Schema - Valid
  const validProject = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Projesi",
    duration: 15,
    ratio: "9:16",
    status: "DRAFT"
  };
  assert(projectSchema.safeParse(validProject).success, "Geçerli proje şeması doğrulanmalı");

  // Test 2: Project Schema - Invalid Name
  const invalidProject = { ...validProject, name: "" };
  assert(!projectSchema.safeParse(invalidProject).success, "Boş proje adı reddedilmeli");

  // Test 3: Asset Schema - Invalid MIME
  const invalidAsset = {
    id: "123e4567-e89b-12d3-a456-426614174001",
    projectId: validProject.id,
    name: "test.pdf",
    url: "http://example.com/test.pdf",
    mimeType: "application/x-msdownload"
  };
  assert(!assetSchema.safeParse(invalidAsset).success, "Desteklenmeyen dosya türü reddedilmeli");

  // Test 4-6: Vercel dağıtım ön koşulları
  // (bu üçü bozulduğunda deployment sessizce başarısız oluyordu)
  const vercelPath = path.join(repoRoot, "vercel.json");
  let vercelRaw = "";
  let vercelOk = false;
  try {
    vercelRaw = readFileSync(vercelPath, "utf8");
    JSON.parse(vercelRaw);
    vercelOk = true;
  } catch {
    vercelOk = false;
  }
  assert(vercelOk, "vercel.json geçerli JSON olmalı");

  const topLevelKeys = [...vercelRaw.matchAll(/^\s{2}"([^"]+)"\s*:/gm)].map((m) => m[1]);
  assert(
    new Set(topLevelKeys).size === topLevelKeys.length,
    "vercel.json içinde tekrar eden anahtar olmamalı"
  );

  assert(
    existsSync(path.join(repoRoot, "apps", "web", "pnpm-lock.yaml")),
    "apps/web/pnpm-lock.yaml bulunmalı (Vercel Root Directory = apps/web)"
  );

  const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    packageManager?: string;
  };
  assert(
    typeof rootPkg.packageManager === "string" && rootPkg.packageManager.startsWith("pnpm@"),
    "package.json packageManager alanı pnpm sürümünü sabitlemeli"
  );

  console.log(`\nTest Sonuçları: ${passed} Başarılı, ${failed} Başarısız`);
  if (failed > 0) throw new Error("Tests failed");
}

runTests();
