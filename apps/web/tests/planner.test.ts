import assert from "node:assert/strict";
import test from "node:test";
import {
  durationForText,
  planFromAssets,
  planFromText,
  splitSentences,
} from "../src/lib/planner.ts";
import { totalDuration } from "../src/lib/types.ts";

test("metin planlayıcı boş girdide güvenli biçimde boş sonuç döndürür", () => {
  assert.deepEqual(planFromText("   \n  "), []);
});

test("Türkçe metin sahnelere ayrılır ve altyazılar korunur", () => {
  const input =
    "Dostluk güvenle başlar. Zor günlerde birbirimizi dinleriz. Başarıları birlikte kutlarız.";
  const scenes = planFromText(input, { targetDuration: 20, maxScenes: 6 });

  assert.ok(scenes.length >= 2);
  assert.equal(totalDuration(scenes), 20);
  assert.ok(scenes.every((scene) => scene.subtitle.trim().length > 0));
  assert.ok(scenes.every((scene) => scene.duration >= 1.5));
});

test("cümle bölme sıralamayı ve madde metinlerini korur", () => {
  assert.deepEqual(splitSentences("İlk adım.\n- İkinci adım\nÜçüncü adım!"), [
    "İlk adım.",
    "İkinci adım",
    "Üçüncü adım!",
  ]);
});

test("okuma süresi güvenli sınırlar içinde hesaplanır", () => {
  assert.equal(durationForText("Kısa"), 2.5);
  assert.equal(durationForText("x".repeat(500)), 8);
});

test("görsel ve video varlıkları aynı sırayla sahneye dönüşür, ses atlanır", () => {
  const scenes = planFromAssets(
    [
      { id: "img-1", kind: "image", name: "bir.png" },
      { id: "audio-1", kind: "audio", name: "müzik.mp3" },
      { id: "video-1", kind: "video", name: "iki.mp4" },
    ],
    4
  );

  assert.deepEqual(
    scenes.map(({ kind, assetId, duration }) => ({ kind, assetId, duration })),
    [
      { kind: "image", assetId: "img-1", duration: 4 },
      { kind: "video", assetId: "video-1", duration: 4 },
    ]
  );
});
