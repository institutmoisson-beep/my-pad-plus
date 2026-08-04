/** Compression et redimensionnement des images côté client avant upload. */

export type CompressOptions = {
  maxSize?: number;
  quality?: number;
};

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}

/** Redimensionne (côté navigateur) et ré-encode en WebP pour alléger l'application. */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<Blob> {
  const maxSize = options.maxSize ?? 1600;
  const quality = options.quality ?? 0.8;

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Format d'image non pris en charge (JPEG, PNG ou WebP).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Image trop volumineuse (15 Mo maximum).");
  }

  const bitmap = await loadBitmap(file);
  const width = "width" in bitmap ? bitmap.width : 0;
  const height = "height" in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, maxSize / Math.max(width, height || 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Compression indisponible sur cet appareil.");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("Échec de la compression de l'image.");
  return blob;
}

/** Chemin de la miniature associée à une image. */
export function thumbPath(path: string): string {
  return path.replace(/\/full\//, "/thumb/");
}