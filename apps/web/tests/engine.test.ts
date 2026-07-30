import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline, pickMime } from "../src/lib/engine.ts";
import type { Scene } from "../src/lib/types.ts";

const scene = (id: string, duration: number): Scene => ({
  id,
  kind: "text",
  duration,
  motion: "none",
  transition: "cut",
  subtitle: id,
});

test("zaman çizelgesi sahne sırasını ve sınırlarını korur", () => {
  const timeline = buildTimeline([scene("bir", 2), scene("iki", 3.5), scene("üç", 1)]);

  assert.deepEqual(
    timeline.map(({ scene: item, start, end }) => ({ id: item.id, start, end })),
    [
      { id: "bir", start: 0, end: 2 },
      { id: "iki", start: 2, end: 5.5 },
      { id: "üç", start: 5.5, end: 6.5 },
    ]
  );
});

test("zaman çizelgesi geçersiz kısa süreyi güvenli alt sınıra çeker", () => {
  const [item] = buildTimeline([scene("kısa", 0)]);
  assert.equal(item.end, 0.2);
});

test("MediaRecorder yoksa codec seçimi güvenli biçimde null döner", () => {
  const previous = globalThis.MediaRecorder;
  // @ts-expect-error Test ortamında tarayıcı API'sinin yokluğunu simüle ediyoruz.
  delete globalThis.MediaRecorder;
  assert.equal(pickMime(), null);
  globalThis.MediaRecorder = previous;
});

test("desteklenen ilk gerçek MIME ve uzantı birlikte seçilir", () => {
  const previous = globalThis.MediaRecorder;
  globalThis.MediaRecorder = class {
    static isTypeSupported(mime: string) {
      return mime === "video/webm;codecs=vp9,opus";
    }
  } as unknown as typeof MediaRecorder;

  assert.deepEqual(pickMime(), { mime: "video/webm;codecs=vp9,opus", ext: "webm" });
  globalThis.MediaRecorder = previous;
});
