/**
 * Image file helpers shared by item photos and receipt scanning.
 *
 * iPhone photos are often HEIC/HEIF, and iOS frequently hands them to the page
 * with an empty MIME type or `application/octet-stream`. We therefore accept by
 * extension as well as by MIME type, and decode with (in order):
 *   1. createImageBitmap  — fast path (JPEG/PNG/WebP; HEIC on recent Safari)
 *   2. <img> element      — Safari decodes HEIC natively here
 *   3. heic2any           — WASM-free JS HEIC decoder, loaded on demand
 */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;

export class ImageDecodeError extends Error {
  constructor(message = "This photo couldn’t be opened.") {
    super(message);
    this.name = "ImageDecodeError";
  }
}

export function isHeic(file: File | Blob): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif" || type === "image/heic-sequence" || type === "image/heif-sequence") return true;
  const name = "name" in file ? (file as File).name : "";
  return HEIC_EXT.test(name);
}

/** True for anything that looks like a photo, including HEIC with an empty / octet-stream MIME. */
export function isImageFile(file: File | null | undefined): file is File {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  if (type === "" || type === "application/octet-stream") return IMAGE_EXT.test(file.name || "");
  return false;
}

export async function sniffHeic(file: Blob): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const brand = String.fromCharCode(...head.slice(4, 12));
    return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(brand);
  } catch {
    return false;
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function viaBitmap(blob: Blob): Promise<Decoded> {
  const bmp = await createImageBitmap(blob);
  return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
}

function viaImg(blob: Blob): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new ImageDecodeError());
        return;
      }
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageDecodeError());
    };
    img.src = url;
  });
}

async function heicToJpegBlob(blob: Blob): Promise<Blob> {
  const mod = await import("heic2any");
  const heic2any = (mod.default ?? mod) as unknown as (o: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>;
  const out = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function decode(file: Blob): Promise<Decoded> {
  try {
    return await viaBitmap(file);
  } catch {
    /* fall through */
  }
  try {
    return await viaImg(file);
  } catch {
    /* fall through */
  }
  if (isHeic(file) || (await sniffHeic(file))) {
    try {
      const jpeg = await heicToJpegBlob(file);
      try {
        return await viaBitmap(jpeg);
      } catch {
        return await viaImg(jpeg);
      }
    } catch {
      throw new ImageDecodeError("This HEIC photo couldn’t be converted. Try again, or set Camera › Formats to Most Compatible.");
    }
  }
  throw new ImageDecodeError();
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageDecodeError())), "image/jpeg", quality);
  });
}

/**
 * Decode any supported photo (incl. HEIC) and re-encode as JPEG, scaled so the
 * longest edge is at most `maxEdge`. EXIF orientation is applied by the browser
 * during decode (`image-orientation: from-image` is the default).
 */
export async function toJpeg(
  file: Blob,
  { maxEdge = 1200, quality = 0.8 }: { maxEdge?: number; quality?: number } = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const d = await decode(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(d.width, d.height));
    const w = Math.max(1, Math.round(d.width * scale));
    const h = Math.max(1, Math.round(d.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageDecodeError();
    ctx.fillStyle = "#fff"; // transparent PNGs → white, not black
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(d.source, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, quality);
    return { blob, width: w, height: h };
  } finally {
    d.release();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
