/**
 * QR decoding for joining a sync chain. Uses the browser's BarcodeDetector when it can
 * read QR codes (e.g. Chrome on Android); otherwise falls back to jsQR, loaded on demand.
 */
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
let native: Detector | null | undefined;

async function nativeDetector(): Promise<Detector | null> {
  if (native !== undefined) return native;
  native = null;
  const BD = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  try {
    if (BD && (await BD.getSupportedFormats?.())?.includes('qr_code')) native = new BD({ formats: ['qr_code'] });
  } catch {
    native = null;
  }
  return native;
}

let jsqr: typeof import('jsqr').default | null = null;
const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/** Decode a QR code from a video frame or image. Returns its text, or null if none is found. */
export async function decodeQr(src: HTMLVideoElement | HTMLImageElement | ImageBitmap): Promise<string | null> {
  const d = await nativeDetector();
  if (d) {
    try {
      const found = await d.detect(src);
      if (found[0]?.rawValue) return found[0].rawValue;
      return null;
    } catch {
      /* fall through to jsQR */
    }
  }
  jsqr ??= (await import('jsqr')).default;
  const w = 'videoWidth' in src ? src.videoWidth : 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h = 'videoHeight' in src ? src.videoHeight : 'naturalHeight' in src ? src.naturalHeight : src.height;
  if (!w || !h || !canvas) return null;
  // Downscale large frames: faster, and QR codes on screens decode fine at ~800 px.
  const scale = Math.min(1, 800 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsqr(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}
