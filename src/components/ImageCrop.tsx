import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cropSourceRect, displayedSize, initialCrop, panCrop, zoomCrop, type ImageCrop as Crop } from "@/lib/image-crop";

export function ImageCrop({ file, onChange, onReplace }: { file: File; onChange: (image: string) => void; onReplace: (file: File) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ x: 0, y: 0, distance: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<Crop | null>(null);
  onChangeRef.current = onChange;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = url;
    setCrop(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setFrame({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!image || frame.width <= 0 || frame.height <= 0) return;
    setCrop((current) => current ?? initialCrop(image.naturalWidth, image.naturalHeight, frame.width, frame.height));
  }, [image, frame.width, frame.height]);

  useEffect(() => {
    if (!image || !crop || frame.width <= 0) return;
    const timer = window.setTimeout(() => {
      const source = cropSourceRect(crop, image.naturalWidth, image.naturalHeight, frame.width, frame.height);
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = Math.round(1280 * frame.height / frame.width);
      const context = canvas.getContext("2d");
      if (!context || source.width <= 0 || source.height <= 0) return;
      context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
      onChangeRef.current(canvas.toDataURL("image/jpeg", 0.85));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [crop, image, frame.width, frame.height]);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!image || !crop || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const mid = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
    const distance = points.length > 1 ? Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y) : 0;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = mid.x - gesture.current.x;
    const dy = mid.y - gesture.current.y;
    const pinch = distance > 0 && gesture.current.distance > 0 ? distance / gesture.current.distance : 0;
    const originX = gesture.current.x - rect.left;
    const originY = gesture.current.y - rect.top;
    gesture.current = { x: mid.x, y: mid.y, distance };
    if (pinch > 0) {
      setCrop((current) => {
        if (!current) return current;
        const zoomed = zoomCrop(current, current.zoom * pinch, originX, originY, image.naturalWidth, image.naturalHeight, rect.width, rect.height);
        return panCrop(zoomed, dx, dy, image.naturalWidth, image.naturalHeight, rect.width, rect.height);
      });
    } else {
      setCrop((current) => current && panCrop(current, dx, dy, image.naturalWidth, image.naturalHeight, rect.width, rect.height));
    }
  };

  const size = image && crop && frame.width > 0 ? displayedSize(image.naturalWidth, image.naturalHeight, frame.width, frame.height, crop.zoom) : null;

  return (
    <div className="space-y-2">
      <div ref={frameRef} className="relative aspect-video w-full touch-none overflow-hidden rounded-2xl bg-secondary"
        onPointerDown={(event) => { pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); const points = [...pointers.current.values()]; gesture.current = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length, distance: points.length > 1 ? Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y) : 0 }; try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Das Bild reagiert auch ohne Capture auf die Finger. */ } }}
        onPointerMove={move}
        onPointerUp={(event) => { pointers.current.delete(event.pointerId); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={(event) => pointers.current.delete(event.pointerId)}>
        {image && crop && size && <img src={image.src} alt="" draggable={false} className="absolute max-w-none select-none" style={{ width: size.width, height: size.height, left: crop.offsetX, top: crop.offsetY }} />}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Ein Finger verschiebt, zwei Finger zoomen.</p>
        <button type="button" className="glass press flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm" onClick={() => inputRef.current?.click()}><ImagePlus className="h-4 w-4" /> Anderes Bild</button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (next) onReplace(next); event.target.value = ""; }} />
    </div>
  );
}
