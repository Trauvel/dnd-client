/**
 * Сервис оптимизации изображений (ресайз + сжатие).
 * Используется для аватарки персонажа, позже — для редактора сценариев.
 */

export interface ImageOptimizationOptions {
  /** Макс. ширина (по длинной стороне или по ширине — см. fit) */
  maxWidth?: number;
  /** Макс. высота */
  maxHeight?: number;
  /** Макс. размер в байтах (приблизительно). Если превышен — понижаем quality. */
  maxSizeBytes?: number;
  /** Качество JPEG/WebP (0–1). По умолчанию 0.85 */
  quality?: number;
  /** Формат: jpeg меньше по размеру, png — без потерь */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<Omit<ImageOptimizationOptions, 'maxSizeBytes'>> & { maxSizeBytes?: number } = {
  maxWidth: 512,
  maxHeight: 512,
  maxSizeBytes: 150 * 1024,
  quality: 0.85,
  mimeType: 'image/jpeg',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function drawImageToCanvas(
  img: HTMLImageElement,
  maxW: number,
  maxH: number
): { canvas: HTMLCanvasElement; width: number; height: number } {
  let { width, height } = img;
  if (width <= maxW && height <= maxH) {
    width = img.width;
    height = img.height;
  } else {
    const r = Math.min(maxW / width, maxH / height);
    width = Math.round(width * r);
    height = Math.round(height * r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      mime,
      mime === 'image/png' ? undefined : quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Оптимизирует файл изображения: ресайз по maxWidth/maxHeight и сжатие.
 * Возвращает data URL (готов для сохранения в imageUrl и т.п.).
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxW = opts.maxWidth ?? 512;
  const maxH = opts.maxHeight ?? 512;
  const maxBytes = opts.maxSizeBytes;
  const mime = opts.mimeType ?? 'image/jpeg';

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const { canvas } = drawImageToCanvas(img, maxW, maxH);

  let quality = opts.quality ?? 0.85;
  let blob = await canvasToBlob(canvas, mime, quality);

  while (maxBytes != null && blob.size > maxBytes && quality > 0.1) {
    quality = Math.max(0.1, quality - 0.15);
    blob = await canvasToBlob(canvas, mime, quality);
  }

  return blobToDataUrl(blob);
}

/** Пресет для аватарки игрока (небольшой размер, умеренное сжатие). */
export const AVATAR_OPTIMIZATION_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 256,
  maxHeight: 256,
  maxSizeBytes: 80 * 1024,
  quality: 0.85,
  mimeType: 'image/jpeg',
};
