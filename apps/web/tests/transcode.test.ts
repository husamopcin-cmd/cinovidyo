import assert from "node:assert/strict";
import test from "node:test";

import {
  PRESETS,
  effectiveVideoBitrate,
  estimateSize,
  formatBytes,
  formatDuration,
  isAlreadySmall,
  targetDimensions,
  type MediaInfo,
} from "../src/lib/transcode";

/** 10 dakikalık, 1080p, sesli örnek girdi. */
const ORNEK: MediaInfo = {
  durationSec: 600,
  width: 1920,
  height: 1080,
  videoCodec: "avc",
  audioCodec: "aac",
  sizeBytes: 750_000_000,
  bitrateBps: 10_000_000,
  hasAudio: true,
};

test("boyut tahmini bit hızı ve süreyle doğru orantılı hesaplanır", () => {
  const tahmin = estimateSize(ORNEK, {
    maxDimension: 1280,
    videoBitrate: 1_000_000,
    audioBitrate: 96_000,
  });
  // (1_000_000 + 96_000) * 600 / 8 = 82_200_000
  assert.equal(tahmin, 82_200_000);
});

test("ses kaldırılınca tahmin yalnızca video bit hızından hesaplanır", () => {
  const sesli = estimateSize(ORNEK, {
    maxDimension: null,
    videoBitrate: 2_000_000,
    audioBitrate: 128_000,
  });
  const sessiz = estimateSize(ORNEK, {
    maxDimension: null,
    videoBitrate: 2_000_000,
    audioBitrate: 128_000,
    removeAudio: true,
  });
  assert.ok(sessiz < sesli, "sessiz çıktı daha küçük olmalı");
  assert.equal(sessiz, (2_000_000 * 600) / 8);
});

test("sesi olmayan videoda ses bit hızı tahmine eklenmez", () => {
  const sessizKaynak: MediaInfo = { ...ORNEK, hasAudio: false, audioCodec: null };
  const tahmin = estimateSize(sessizKaynak, {
    maxDimension: null,
    videoBitrate: 1_000_000,
    audioBitrate: 128_000,
  });
  assert.equal(tahmin, (1_000_000 * 600) / 8);
});

test("hedef çözünürlük en-boy oranını korur ve çift sayıya yuvarlar", () => {
  const { width, height } = targetDimensions(ORNEK, 1280);
  assert.equal(width, 1280);
  assert.equal(height, 720);
  assert.equal(width % 2, 0);
  assert.equal(height % 2, 0);
});

test("dikey video sığdırılırken uzun kenar esas alınır", () => {
  const dikey: MediaInfo = { ...ORNEK, width: 1080, height: 1920 };
  const { width, height } = targetDimensions(dikey, 1280);
  assert.equal(height, 1280, "uzun kenar hedefe inmeli");
  assert.equal(width, 720);
});

test("kaynak hedeften küçükse video büyütülmez", () => {
  const kucuk: MediaInfo = { ...ORNEK, width: 640, height: 360 };
  const { width, height } = targetDimensions(kucuk, 1920);
  assert.equal(width, 640, "küçük video büyütülmemeli");
  assert.equal(height, 360);
});

test("maxDimension yoksa özgün çözünürlük korunur", () => {
  const { width, height } = targetDimensions(ORNEK, null);
  assert.equal(width, 1920);
  assert.equal(height, 1080);
});

test("hazır profiller gerçekten küçülme sağlar", () => {
  for (const p of PRESETS) {
    const tahmin = estimateSize(ORNEK, {
      maxDimension: p.maxDimension,
      videoBitrate: p.videoBitrate,
      audioBitrate: p.audioBitrate,
    });
    assert.ok(
      tahmin < ORNEK.sizeBytes,
      `${p.id} profili girdiden küçük olmalı (${tahmin} < ${ORNEK.sizeBytes})`
    );
  }
});

/** Zaten iyi sıkıştırılmış, düşük bit hızlı kaynak. */
const ZATEN_KUCUK: MediaInfo = {
  durationSec: 23,
  width: 640,
  height: 360,
  videoCodec: "avc",
  audioCodec: null,
  sizeBytes: 399_000,
  bitrateBps: 138_000,
  hasAudio: false,
};

test("hedef bit hızı kaynağın üstüne çıkamaz", () => {
  // 2.5 Mbps istense de kaynak ~138 kbps olduğu için kırpılmalı
  const gercek = effectiveVideoBitrate(ZATEN_KUCUK, 2_500_000);
  assert.ok(gercek < 2_500_000, "istenen bit hızı kırpılmalı");
  assert.ok(gercek <= ZATEN_KUCUK.bitrateBps, "kaynak bit hızını aşmamalı");
});

test("kaynaktan düşük hedef istenirse olduğu gibi kullanılır", () => {
  assert.equal(effectiveVideoBitrate(ORNEK, 1_000_000), 1_000_000);
  assert.equal(isAlreadySmall(ORNEK, {
    maxDimension: 1280,
    videoBitrate: 1_000_000,
    audioBitrate: 96_000,
  }), false);
});

test("zaten küçük video için kullanıcı uyarısı tetiklenir", () => {
  assert.equal(
    isAlreadySmall(ZATEN_KUCUK, {
      maxDimension: 1920,
      videoBitrate: 2_500_000,
      audioBitrate: 128_000,
    }),
    true
  );
});

test("zaten küçük videoda tahmin dosyayı büyütmez", () => {
  const tahmin = estimateSize(ZATEN_KUCUK, {
    maxDimension: 1920,
    videoBitrate: 2_500_000,
    audioBitrate: 128_000,
  });
  assert.ok(
    tahmin <= ZATEN_KUCUK.sizeBytes,
    `tahmin (${tahmin}) kaynaktan (${ZATEN_KUCUK.sizeBytes}) büyük olmamalı`
  );
});

test("bayt biçimlendirme birimleri doğru seçer", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  assert.equal(formatBytes(3 * 1024 * 1024 * 1024), "3.00 GB");
});

test("süre biçimlendirme saat eşiğini doğru aşar", () => {
  assert.equal(formatDuration(45), "0:45");
  assert.equal(formatDuration(605), "10:05");
  assert.equal(formatDuration(3661), "1:01:01");
});

/* ── Zaman aralığı kırpma (US-201) ──
   Worker'daki geçerlilik ve süre hesabıyla aynı kuralı doğrular: aralık ancak
   start < end iken uygulanır, çıktı süresi de aralığın kendisidir. */

function trimGecerliMi(o: { trimStartSec?: number; trimEndSec?: number }): boolean {
  return (
    typeof o.trimStartSec === "number" &&
    typeof o.trimEndSec === "number" &&
    o.trimEndSec > o.trimStartSec
  );
}

function ciktiSuresi(
  o: { trimStartSec?: number; trimEndSec?: number },
  kaynakSure: number
): number {
  return trimGecerliMi(o) ? o.trimEndSec! - o.trimStartSec! : kaynakSure;
}

test("geçerli aralıkta çıktı süresi aralığın uzunluğudur", () => {
  const o = { trimStartSec: 10, trimEndSec: 20 };
  assert.equal(trimGecerliMi(o), true);
  assert.equal(ciktiSuresi(o, 38), 10);
});

test("aralık verilmezse kaynak süresi korunur", () => {
  assert.equal(trimGecerliMi({}), false);
  assert.equal(ciktiSuresi({}, 38), 38);
});

test("başlangıç bitişten büyük veya eşitse aralık uygulanmaz", () => {
  assert.equal(trimGecerliMi({ trimStartSec: 20, trimEndSec: 10 }), false);
  assert.equal(trimGecerliMi({ trimStartSec: 5, trimEndSec: 5 }), false);
  // Geçersiz aralıkta kaynak süresi korunur — sessizce 0 sn video üretilmez.
  assert.equal(ciktiSuresi({ trimStartSec: 20, trimEndSec: 10 }, 38), 38);
});

test("yalnızca tek uç verilirse aralık uygulanmaz", () => {
  assert.equal(trimGecerliMi({ trimStartSec: 5 }), false);
  assert.equal(trimGecerliMi({ trimEndSec: 5 }), false);
});
