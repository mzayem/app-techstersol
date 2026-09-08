import path from "node:path";

import sharp from "sharp";

// react-pdf and exceljs can't decode WebP, so these get converted to PNG
// once and cached for every report render.
let logoPngPromise: Promise<Buffer | null> | null = null;
let letterheadBgPngPromise: Promise<Buffer | null> | null = null;

function convertWebpToPng(filename: string): Promise<Buffer | null> {
  return (async () => {
    try {
      const webpPath = path.join(process.cwd(), "public", "images", filename);
      return await sharp(webpPath).png().toBuffer();
    } catch {
      return null;
    }
  })();
}

export function getReportLogoPng(): Promise<Buffer | null> {
  if (!logoPngPromise) logoPngPromise = convertWebpToPng("logo-black.webp");
  return logoPngPromise;
}

// The letterhead's full-page artwork (corner accents, header, watermark,
// footer) is authored as a single A4 SVG — rasterized once at ~300dpi so
// react-pdf (which can't render SVG-with-embedded-raster reliably as a
// background) gets a plain full-bleed PNG to place behind the letter text.
const A4_POINTS_WIDTH = 595.5;
const A4_POINTS_HEIGHT = 842.25;
const RASTER_DPI = 300;

export function getLetterheadBackgroundPng(): Promise<Buffer | null> {
  if (!letterheadBgPngPromise) {
    letterheadBgPngPromise = (async () => {
      try {
        const svgPath = path.join(process.cwd(), "public", "images", "letterhead-bg.svg");
        return await sharp(svgPath, {
          density: RASTER_DPI,
        })
          .resize(
            Math.round((A4_POINTS_WIDTH / 72) * RASTER_DPI),
            Math.round((A4_POINTS_HEIGHT / 72) * RASTER_DPI),
          )
          .png()
          .toBuffer();
      } catch {
        return null;
      }
    })();
  }
  return letterheadBgPngPromise;
}
