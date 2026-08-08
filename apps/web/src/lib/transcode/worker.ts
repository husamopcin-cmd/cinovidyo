import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from "mediabunny";
import { StreamingTarget } from "./StreamingTarget";
import type { MediaInfo } from "./types";
import { targetDimensions, effectiveVideoBitrate } from "./helpers";

// Worker içinden çağrılabilmesi için
let currentConversion: Conversion | null = null;

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  try {
    if (type === "analyze") {
      const { file } = payload;
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
      
      let info: MediaInfo;
      try {
        const video = await input.getPrimaryVideoTrack();
        if (!video) throw new Error("Dosyada video izi bulunamadı. Bu bir video dosyası mı?");
        
        const audio = await input.getPrimaryAudioTrack();
        const durationSec = await input.computeDuration();
        if (!Number.isFinite(durationSec) || durationSec <= 0) {
          throw new Error("Video süresi okunamadı; dosya bozuk olabilir.");
        }

        info = {
          durationSec,
          width: video.displayWidth,
          height: video.displayHeight,
          videoCodec: video.codec,
          audioCodec: audio?.codec ?? null,
          sizeBytes: file.size,
          bitrateBps: Math.round((file.size * 8) / durationSec),
          hasAudio: !!audio,
        };
      } finally {
        input.dispose();
      }

      self.postMessage({ id, type: "success", result: info });
    } else if (type === "compress") {
      const { file, options, useStream, info } = payload;
      
      const width = options.cropWidth || targetDimensions(info, options.maxDimension).width;
      const height = options.cropHeight || targetDimensions(info, options.maxDimension).height;
      const fit = options.fit || (options.cropWidth ? "cover" : "contain");

      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
      
      let target;
      if (useStream) {
        target = new StreamingTarget((msg) => {
          self.postMessage({ id, type: "stream", payload: msg });
        });
      } else {
        target = new BufferTarget();
      }

      const output = new Output({
        format: options.container === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat(),
        target,
      });

      // Zaman aralığı kırpma: yalnızca geçerli bir aralık verildiyse uygulanır.
      // mediabunny start < end bekler; geçersiz aralıkta trim hiç gönderilmez.
      const hasTrim =
        typeof options.trimStartSec === "number" &&
        typeof options.trimEndSec === "number" &&
        options.trimEndSec > options.trimStartSec;

      // Kırpılmışsa çıktı süresi kaynağınki değil, seçilen aralıktır.
      const outputDurationSec = hasTrim
        ? options.trimEndSec! - options.trimStartSec!
        : info.durationSec;

      const conversion = await Conversion.init({
        input,
        output,
        video: options.extractAudioOnly ? { discard: true } : {
          width,
          height,
          bitrate: effectiveVideoBitrate(info, options.videoBitrate),
          fit,
        },
        audio: options.removeAudio ? { discard: true } : { bitrate: options.audioBitrate },
        ...(hasTrim
          ? { trim: { start: options.trimStartSec, end: options.trimEndSec } }
          : {}),
      });

      conversion.onProgress = (ratio) => {
        self.postMessage({ id, type: "progress", ratio });
      };

      currentConversion = conversion;
      await conversion.execute();
      
      if (!useStream) {
        const bufferTarget = target as BufferTarget;
        if (!bufferTarget.buffer) throw new Error("Sıkıştırma çıktı üretmedi.");
        // extractAudioOnly çıktısında video izi yok; "video/mp4" olarak etiketlemek
        // yanıltıcı olur (bazı oynatıcılar/OS'ler ses dosyası olarak tanımayabilir).
        const mime =
          options.container === "webm"
            ? "video/webm"
            : options.extractAudioOnly
              ? "audio/mp4"
              : "video/mp4";
        const blob = new Blob([bufferTarget.buffer], { type: mime });
        self.postMessage({ id, type: "success", result: { blob, sizeBytes: blob.size, width, height, durationSec: outputDurationSec } });
      } else {
        self.postMessage({ id, type: "success", result: { sizeBytes: 0 /* Will be handled by main thread */, width, height, durationSec: outputDurationSec } });
      }

      input.dispose();
      currentConversion = null;
    } else if (type === "cancel") {
      if (currentConversion && currentConversion.state === "executing") {
        await currentConversion.cancel();
        currentConversion = null;
        self.postMessage({ id, type: "error", error: "İşlem iptal edildi.", code: "TRANSCODE_CANCELLED" });
      }
    }
  } catch (err) {
    let message = "Bilinmeyen hata.";
    if (err instanceof Error) {
      if (err.name === "ConversionCanceledError") {
        self.postMessage({ id, type: "error", error: "İşlem iptal edildi.", code: "TRANSCODE_CANCELLED" });
        return;
      }
      message = err.message;
    }
    self.postMessage({ id, type: "error", error: message });
  }
});
