import { describe, expect, it } from "vitest";
import { clampCrop, cropSourceRect, initialCrop, panCrop, zoomCrop } from "@/lib/image-crop";

describe("event image crop", () => {
  it("starts centered and covers a wide frame", () => {
    const crop = initialCrop(100, 100, 160, 90);
    expect(crop.zoom).toBe(1);
    expect(crop.offsetX).toBe(0);
    expect(crop.offsetY).toBeCloseTo(-35);
    const source = cropSourceRect(crop, 100, 100, 160, 90);
    expect(source.width).toBeCloseTo(100);
    expect(source.height).toBeCloseTo(56.25);
  });

  it("keeps the image covering the frame while it is dragged", () => {
    const start = initialCrop(100, 100, 160, 90);
    const down = panCrop(start, 0, 100, 100, 100, 160, 90);
    const up = panCrop(start, 0, -100, 100, 100, 160, 90);
    expect(down.offsetY).toBe(0);
    expect(up.offsetY).toBeCloseTo(-70);
  });

  it("zooms around the frame center without jumping", () => {
    const start = initialCrop(100, 100, 160, 90);
    const zoomed = zoomCrop(start, 2, 80, 45, 100, 100, 160, 90);
    expect(zoomed.zoom).toBe(2);
    expect(zoomed.offsetX).toBeCloseTo(-80);
    expect(zoomed.offsetY).toBeCloseTo(-115);
    expect(clampCrop({ ...zoomed, zoom: 9 }, 100, 100, 160, 90).zoom).toBe(4);
  });
});