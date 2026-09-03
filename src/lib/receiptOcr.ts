export type OcrProgress = { status: string; progress: number };

const TESS_ASSET = "/home-inventory/tess";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

function emitProgress(cb: ((p: OcrProgress) => void) | undefined, p: OcrProgress) {
  if (cb) cb(p);
}

async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<import("tesseract.js").Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: TESS_ASSET + "/worker.min.js",
        corePath: TESS_ASSET + "/tesseract-core-simd-lstm.wasm.js",
        langPath: TESS_ASSET,
        logger: (m) => {
          if (typeof m.progress === "number") {
            emitProgress(onProgress, {
              status: String(m.status || "recognizing"),
              progress: m.progress,
            });
          }
        },
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeReceipt(
  image: File | Blob | string | HTMLCanvasElement | HTMLImageElement,
  onProgress?: (p: OcrProgress) => void
): Promise<{ text: string; confidence: number }> {
  emitProgress(onProgress, { status: "loading", progress: 0 });
  const worker = await getWorker(onProgress);
  emitProgress(onProgress, { status: "recognizing text", progress: 0.05 });
  const result = await worker.recognize(image);
  const text = result.data.text || "";
  const confidence =
    typeof result.data.confidence === "number" ? result.data.confidence : 0;
  emitProgress(onProgress, { status: "done", progress: 1 });
  return { text, confidence };
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch {
    /* ignore */
  }
  workerPromise = null;
}

export async function compressThumbnail(
  file: File | Blob,
  maxBytes = 180000,
  maxEdge = 900
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    let quality = 0.72;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > maxBytes && quality > 0.35) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > maxBytes) return null;
    return dataUrl;
  } catch {
    return null;
  }
}
