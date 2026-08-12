/**
 * Image preparation for the AI provider.
 *
 * The browser uploads a full-resolution label photo. We resize overly large
 * images before sending them to the model to keep the request small and fail
 * fast on non-image or corrupt buffers. Resizing preserves enough resolution
 * to read label text; the goal is to reduce payload without destroying
 * readable detail (PERF-003).
 *
 * This module runs on the server (Node/API route), where `sharp` is available.
 */

import sharp from "sharp";

/**
 * Maximum edge length we keep for a label image. Most labels are readable at
 * this size and it keeps the AI request reasonable. We do not upscale small
 * images. 1200px is enough to read label text while keeping the image tokens
 * (and thus AI latency) low.
 */
const MAX_IMAGE_EDGE = 1200;
/** JPEG quality used when re-encoding a large png/webp for the request. */
const JPEG_QUALITY = 85;
/** Hard cap on a single uploaded image (bytes). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** MIME prefix for the data URL sent to the provider. */
function dataUrlFor(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/**
 * Validate the buffer decodes as an image and, if it is oversized, resize it.
 * Returns the image as a data URL ready for the provider plus the MIME type.
 *
 * Throws a descriptive error when the buffer is not a supported image or is too
 * large to process.
 */
export async function prepareLabelImage(
  buffer: Buffer,
  declaredMimeType: string
): Promise<{ dataUrl: string; mimeType: string; originalFormat: string }> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      "This image is too large. Please upload an image smaller than 15 MB."
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error("This file is not a readable image. Please upload a photo of the label.");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("This image has no readable dimensions. Please upload a clearer photo.");
  }
  if (metadata.width < 100 || metadata.height < 100) {
    throw new Error("This image is too small to read. Please upload a larger photo of the label.");
  }

  const stream = sharp(buffer);
  // Convert HEIF/HEIC and other unusual formats to jpeg for broad provider
  // support. sharp reports HEIC as the "heif" format.
  const useJpeg =
    metadata.format === "heif" || metadata.format === "avif" || metadata.format === "tiff" || metadata.format === "gif" || metadata.format === "svg";
  const mimeType = useJpeg ? "image/jpeg" : declaredMimeType;

  const needsResize =
    Math.max(metadata.width, metadata.height) > MAX_IMAGE_EDGE;
  const finalBuffer = needsResize
    ? await (useJpeg
        ? stream.resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: JPEG_QUALITY })
        : stream.resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 6 }))
        .toBuffer()
    : await (useJpeg ? stream.jpeg({ quality: JPEG_QUALITY }).toBuffer() : buffer);

  return {
    dataUrl: dataUrlFor(finalBuffer as Buffer, mimeType),
    mimeType,
    originalFormat: metadata.format ?? "jpeg",
  };
}