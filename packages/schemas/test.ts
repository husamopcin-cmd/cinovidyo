import { z } from "zod";
import { projectSchema, assetSchema, sceneSchema } from "./index";

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
    mimeType: "application/pdf"
  };
  assert(!assetSchema.safeParse(invalidAsset).success, "Desteklenmeyen dosya türü (PDF) reddedilmeli");

  console.log(`\nTest Sonuçları: ${passed} Başarılı, ${failed} Başarısız`);
  if (failed > 0) throw new Error("Tests failed");
}

runTests();
