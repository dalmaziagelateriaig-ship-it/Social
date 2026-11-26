import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MEDIA_DIR =
  process.env.MEDIA_PATH ?? path.join(process.cwd(), "data", "media");

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

export function isSupportedMime(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

/** Stores a file in the media folder and returns the URL the app serves it from. */
export function saveMedia(data: Buffer, mime: string): string {
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error(`Formato non supportato: ${mime}`);
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, name), data);
  return `/api/media/${name}`;
}

/** Resolves a media file name safely (no path traversal). Returns null if missing. */
export function mediaFile(name: string): { filePath: string; mime: string } | null {
  if (!/^[a-f0-9-]{36}\.[a-z0-9]+$/.test(name)) return null;
  const mime = MIME_BY_EXT[path.extname(name)];
  const filePath = path.join(MEDIA_DIR, name);
  if (!mime || !fs.existsSync(filePath)) return null;
  return { filePath, mime };
}
