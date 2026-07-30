import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../src/app/api/tts/route.ts";

const originalProvider = process.env.TTS_PROVIDER;
const originalKey = process.env.TTS_API_KEY;
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  if (originalProvider === undefined) delete process.env.TTS_PROVIDER;
  else process.env.TTS_PROVIDER = originalProvider;
  if (originalKey === undefined) delete process.env.TTS_API_KEY;
  else process.env.TTS_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
});

test("TTS yapılandırması yokken health-check ve üretim açık hata döndürür", async () => {
  delete process.env.TTS_PROVIDER;
  delete process.env.TTS_API_KEY;

  const health = await GET();
  assert.deepEqual(await health.json(), { configured: false, provider: null, voices: [] });

  const response = await POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: "Merhaba" }),
    })
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "TTS_NOT_CONFIGURED");
});

test("tanınmayan provider güvenli ve açıklayıcı hata döndürür", async () => {
  process.env.TTS_PROVIDER = "bilinmeyen";
  const response = await POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: "Merhaba" }),
    })
  );
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "UNKNOWN_PROVIDER");
});

test("Google TTS başarılı yanıtta boş olmayan MPEG sesi döndürür", async () => {
  process.env.TTS_PROVIDER = "google";
  process.env.TTS_API_KEY = "test-only-key";
  const audio = Buffer.from("ID3-test-audio").toString("base64");
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ audioContent: audio }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const response = await POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Türkçe ses testi", voice: "tr-female" }),
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.ok((await response.arrayBuffer()).byteLength > 0);
});

test("Google TTS dış servis hatasını sahte başarıya çevirmeden iletir", async () => {
  process.env.TTS_PROVIDER = "google";
  process.env.TTS_API_KEY = "test-only-key";
  globalThis.fetch = async () => new Response("quota", { status: 429 });

  const response = await POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: "Türkçe ses testi" }),
    })
  );

  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "TTS_FAILED");
});
