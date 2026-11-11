// Photos d'un post : réduites et compressées dans le navigateur, puis envoyées avec le post
// sous forme de data URL (image JPEG encodée en base64) dans le tableau `images`.
import { S } from "./strings";

export const MAX_IMAGES = 3;
/** Taille maximale d'une image encodée, en caractères (≈ 300 Ko). Le backend applique la même limite. */
export const MAX_CHARS = 400_000;
export const ACCEPT = "image/jpeg,image/png,image/webp";
const TYPES = ["image/jpeg", "image/png", "image/webp"];
/** [côté max en px, qualité JPEG] : on essaie du plus beau au plus léger jusqu'à passer sous MAX_CHARS. */
const ATTEMPTS: [number, number][] = [[1280, 0.78], [1280, 0.62], [1024, 0.6], [800, 0.55], [640, 0.5]];

async function load(file: File) {
  if (typeof createImageBitmap === "function") {
    const b = await createImageBitmap(file);
    return { source: b as CanvasImageSource, width: b.width, height: b.height, close: () => b.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img as CanvasImageSource, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

export async function fileToDataUrl(file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error(S.photoType);
  const img = await load(file);
  try {
    for (const [side, quality] of ATTEMPTS) {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(S.generic);
      ctx.fillStyle = "#fff"; // fond blanc : les PNG transparents ne deviennent pas noirs en JPEG
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img.source, 0, 0, w, h);
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= MAX_CHARS) return url;
    }
  } finally {
    img.close();
  }
  throw new Error(S.photoTooBig);
}
