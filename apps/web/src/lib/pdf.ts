"use client";

// PDF metin çıkarımı — tamamen tarayıcıda, pdf.js ile. Dosya sunucuya gitmez.

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  const pages: string[] = [];
  const limit = Math.min(doc.numPages, 40); // çok uzun PDF'lerde ilk 40 sayfa
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(text);
  }
  await loadingTask.destroy();

  if (pages.length === 0) {
    throw new Error(
      "PDF'ten metin çıkarılamadı. Taranmış (görüntü tabanlı) PDF'ler desteklenmiyor — metni kopyalayıp 'Metin' modunu kullanın."
    );
  }
  return pages.join("\n\n");
}
