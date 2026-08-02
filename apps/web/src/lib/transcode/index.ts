import { canEncodeVideo } from "mediabunny";
import type { CompressOptions, CompressResult, MediaInfo, SupportInfo } from "./types";
import { TranscodeCancelledError, TranscodeUnsupportedError } from "./types";

export * from "./types";
export * from "./helpers";

let messageIdSeq = 0;

export async function checkSupport(): Promise<SupportInfo> {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Sunucu tarafında çalıştırılamaz." };
  }
  if (typeof window.VideoEncoder === "undefined" || typeof window.VideoDecoder === "undefined") {
    return {
      supported: false,
      reason: "Bu tarayıcı video işlemeyi (WebCodecs) desteklemiyor. Chrome, Edge veya güncel Safari kullan.",
    };
  }
  try {
    const ok = await canEncodeVideo("avc", { width: 1280, height: 720 });
    if (!ok) {
      return {
        supported: false,
        reason: "Bu tarayıcıda H.264 video kodlayıcı bulunamadı. Chrome veya Edge dene.",
      };
    }
  } catch {
    return { supported: false, reason: "Video kodlayıcı denetlenemedi." };
  }
  return { supported: true };
}

export async function analyze(file: File): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const id = ++messageIdSeq;

    worker.onmessage = (e) => {
      if (e.data.id === id) {
        if (e.data.type === "success") {
          worker.terminate();
          resolve(e.data.result);
        } else if (e.data.type === "error") {
          worker.terminate();
          reject(new Error(e.data.error));
        }
      }
    };

    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Worker başlatılamadı."));
    };

    worker.postMessage({ id, type: "analyze", payload: { file } });
  });
}

export type CompressHandlers = {
  onProgress?: (ratio: number) => void;
  signal?: { cancelled: boolean };
};

export async function compress(
  file: File,
  opts: CompressOptions,
  handlers: CompressHandlers = {}
): Promise<CompressResult> {
  const support = await checkSupport();
  if (!support.supported) {
    throw new TranscodeUnsupportedError(support.reason ?? "Video işleme desteklenmiyor.");
  }

  const info = await analyze(file);

  // showSaveFilePicker destekleniyorsa diske stream edebiliriz.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fileHandle: any = null;
  let writable: FileSystemWritableFileStream | null = null;
  let useStream = false;
  
  const ext = opts.container === "webm" ? ".webm" : ".mp4";
  const defaultName = file.name.replace(/\.[^.]+$/, "") + "-kucuk" + ext;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (window as any).showSaveFilePicker === "function") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: "Video File",
            accept: {
              [opts.container === "webm" ? "video/webm" : "video/mp4"]: [ext],
            },
          },
        ],
      });
      writable = await fileHandle.createWritable();
      useStream = true;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new TranscodeCancelledError("İşlem iptal edildi.");
      }
      console.warn("Diske doğrudan yazma başlatılamadı, fallback (bellek) kullanılacak.", err);
    }
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const id = ++messageIdSeq;

    let cancelPoll: number | undefined;
    let sizeBytes = 0;

    const cleanup = () => {
      if (cancelPoll !== undefined) window.clearInterval(cancelPoll);
      worker.terminate();
    };

    worker.onmessage = async (e) => {
      if (e.data.id !== id) return;

      const { type, payload, result, error, code, ratio } = e.data;

      if (type === "progress") {
        handlers.onProgress?.(ratio);
      } else if (type === "stream") {
        if (!writable) return;
        try {
          if (payload.type === "write") {
            await writable.write({ type: "write", position: payload.pos, data: payload.data });
            sizeBytes = Math.max(sizeBytes, payload.pos + payload.data.byteLength);
          } else if (payload.type === "finalize") {
            // Nothing to do for finalize in stream, handled by close
          } else if (payload.type === "close") {
            await writable.close();
            writable = null;
          }
        } catch (streamErr) {
          worker.postMessage({ id, type: "cancel" });
          cleanup();
          reject(streamErr);
        }
      } else if (type === "success") {
        if (writable) {
          await writable.close();
        }
        cleanup();
        resolve({
          blob: result.blob, // if stream was not used, this has the blob
          sizeBytes: useStream ? sizeBytes : result.sizeBytes,
          width: result.width,
          height: result.height,
          durationSec: result.durationSec,
        });
      } else if (type === "error") {
        if (writable) {
          await writable.close();
        }
        cleanup();
        if (code === "TRANSCODE_CANCELLED") reject(new TranscodeCancelledError(error));
        else reject(new Error(error));
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error("Worker çöktü."));
    };

    if (handlers.signal) {
      cancelPoll = window.setInterval(() => {
        if (handlers.signal?.cancelled) {
          worker.postMessage({ id, type: "cancel" });
        }
      }, 250);
    }

    worker.postMessage({
      id,
      type: "compress",
      payload: { file, options: opts, useStream, info },
    });
  });
}
