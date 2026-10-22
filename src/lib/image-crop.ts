export type ImageCrop = { offsetX: number; offsetY: number; zoom: number };
export type SourceRect = { x: number; y: number; width: number; height: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function coverScale(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  if (imageWidth <= 0 || imageHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) return 1;
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

export function displayedSize(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number, zoom: number) {
  const scale = coverScale(imageWidth, imageHeight, frameWidth, frameHeight) * zoom;
  return { width: imageWidth * scale, height: imageHeight * scale, scale };
}

export function clampCrop(crop: ImageCrop, imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number): ImageCrop {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom));
  const { width, height } = displayedSize(imageWidth, imageHeight, frameWidth, frameHeight, zoom);
  return {
    zoom,
    offsetX: Math.min(0, Math.max(frameWidth - width, crop.offsetX)),
    offsetY: Math.min(0, Math.max(frameHeight - height, crop.offsetY)),
  };
}

export function initialCrop(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number): ImageCrop {
  const { width, height } = displayedSize(imageWidth, imageHeight, frameWidth, frameHeight, 1);
  return clampCrop({ zoom: 1, offsetX: (frameWidth - width) / 2, offsetY: (frameHeight - height) / 2 }, imageWidth, imageHeight, frameWidth, frameHeight);
}

export function panCrop(crop: ImageCrop, dx: number, dy: number, imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  return clampCrop({ ...crop, offsetX: crop.offsetX + dx, offsetY: crop.offsetY + dy }, imageWidth, imageHeight, frameWidth, frameHeight);
}

export function zoomCrop(crop: ImageCrop, nextZoom: number, originX: number, originY: number, imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  const current = displayedSize(imageWidth, imageHeight, frameWidth, frameHeight, crop.zoom);
  const imageX = (originX - crop.offsetX) / current.scale;
  const imageY = (originY - crop.offsetY) / current.scale;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const next = displayedSize(imageWidth, imageHeight, frameWidth, frameHeight, zoom);
  return clampCrop({ zoom, offsetX: originX - imageX * next.scale, offsetY: originY - imageY * next.scale }, imageWidth, imageHeight, frameWidth, frameHeight);
}

export function cropSourceRect(crop: ImageCrop, imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number): SourceRect {
  const { scale } = displayedSize(imageWidth, imageHeight, frameWidth, frameHeight, crop.zoom);
  const x = Math.max(0, -crop.offsetX / scale);
  const y = Math.max(0, -crop.offsetY / scale);
  return {
    x,
    y,
    width: Math.min(imageWidth - x, frameWidth / scale),
    height: Math.min(imageHeight - y, frameHeight / scale),
  };
}
