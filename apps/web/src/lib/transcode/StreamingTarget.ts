import { Target } from "mediabunny";

export class StreamingTarget extends Target {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private postMessage: (msg: any) => void) {
    super();
  }

  /** @internal */
  _start() {}

  /** @internal */
  _write(data: Uint8Array, pos: number) {
    // Veriyi ana thread'e gonder. Data bir Uint8Array.
    // Performans icin ArrayBuffer'i kopyalamak yerine slice yapiyoruz 
    // ama postMessage sirasinda Transferable Objects yapamayiz cunku data 
    // baska yazmalarda tekrar kullanilmiyor olabilir ama ArrayBuffer baska 
    // dilimlerde paylasiliyor olabilir. O yuzden kopyalayarak gonderiyoruz.
    const chunk = new Uint8Array(data);
    this.postMessage({ type: "write", pos, data: chunk });
    
    // Target arayuzunun gerektirdigi eventi tetikliyoruz.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)._dispatchWrite(pos, pos + data.byteLength);
  }

  /** @internal */
  async _flush() {}

  /** @internal */
  async _finalize() {
    this.postMessage({ type: "finalize" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)._emit("finalized");
  }

  /** @internal */
  async _close() {
    this.postMessage({ type: "close" });
  }

  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _getSlice(_start: number, _end: number) {
    // Dosya icinde geriye donuk okuma yapilmasi gerekirse FileSystemWritableFileStream bunu desteklemez.
    // Ancak MP4 muxer cogunlukla sadece _write(pos, data) ile geriye donuk yazar (or. moov boyutu).
    // O yuzden _getSlice metodunun bos kalmasi streaming senaryosunda beklenen bir durumdur.
    return new Uint8Array(0);
  }
}
