import path from "node:path";

import sharp from "sharp";

// react-pdf and exceljs can't decode WebP, so the black logo lockup is
// converted to PNG once and cached for every report render.
let logoPngPromise: Promise<Buffer | null> | null = null;

export function getReportLogoPng(): Promise<Buffer | null> {
  if (!logoPngPromise) {
    logoPngPromise = (async () => {
      try {
        const webpPath = path.join(
          process.cwd(),
          "public",
          "images",
          "logo-black.webp",
        );
        return await sharp(webpPath).png().toBuffer();
      } catch {
        return null;
      }
    })();
  }
  return logoPngPromise;
}
