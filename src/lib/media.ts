import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Photos and videos are stored in Supabase Storage when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set (needed online, where the server disk is
 * not permanent), otherwise in the local data folder.
 */
export const MEDIA_DIR = process.env.MEDIA_PATH ?? path.join(process.cwd(), "data", "media");
const BUCKET = "media";

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

const FILE_NAME = /^[a-f0-9-]{36}\.[a-z0-9]+$/;

export class MediaError extends Error {}

export function isSupportedMime(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

/** Auth headers: new "sb_secret_" keys go only in apikey, legacy service_role JWTs in both. */
function authHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_secret_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

function supabase(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

/** Largest file accepted, matching the Supabase free plan when it is used. */
export function maxUploadBytes(): number {
  return supabase() ? 50 * 1024 * 1024 : 200 * 1024 * 1024;
}

let bucketReady: Promise<void> | null = null;

async function ensureBucket(sb: { url: string; key: string }): Promise<void> {
  bucketReady ??= (async () => {
    const headers = { ...authHeaders(sb.key), "Content-Type": "application/json" };
    const res = await fetch(`${sb.url}/storage/v1/bucket/${BUCKET}`, { headers });
    if (res.ok) return;
    const created = await fetch(`${sb.url}/storage/v1/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (!created.ok && created.status !== 409) {
      throw new MediaError(`Supabase: impossibile creare l'archivio dei file (${created.status}).`);
    }
  })().catch((e) => {
    bucketReady = null;
    throw e;
  });
  return bucketReady;
}

/** Stores a file and returns the URL it is served from. */
export async function saveMedia(data: Buffer, mime: string): Promise<string> {
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new MediaError(`Formato non supportato: ${mime}`);
  const name = `${crypto.randomUUID()}${ext}`;

  const sb = supabase();
  if (sb) {
    await ensureBucket(sb);
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST",
      headers: { ...authHeaders(sb.key), "Content-Type": mime, "x-upsert": "false" },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      console.error("Supabase upload failed", res.status, await res.text().catch(() => ""));
      throw new MediaError(
        res.status === 413 ? "Il file è troppo grande per l'archivio (massimo 50 MB)." : "Caricamento del file non riuscito. Riprova.",
      );
    }
    return `${sb.url}/storage/v1/object/public/${BUCKET}/${name}`;
  }

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  fs.writeFileSync(path.join(MEDIA_DIR, name), data);
  return `/api/media/${name}`;
}

/** File name of a media URL created by this app, or null if the URL is not one of ours. */
export function mediaName(url: string): string | null {
  const local = /^\/api\/media\/([^/]+)$/.exec(url);
  if (local) return FILE_NAME.test(local[1]) ? local[1] : null;
  const sb = supabase();
  const prefix = sb ? `${sb.url}/storage/v1/object/public/${BUCKET}/` : null;
  if (prefix && url.startsWith(prefix)) {
    const name = url.slice(prefix.length);
    return FILE_NAME.test(name) ? name : null;
  }
  return null;
}

export const isMediaUrl = (url: string) => mediaName(url) !== null;

/** Local file for a name in the data folder (used to serve files when Supabase is off). */
export function localMediaFile(name: string): { filePath: string; mime: string } | null {
  if (!FILE_NAME.test(name)) return null;
  const mime = MIME_BY_EXT[path.extname(name)];
  const filePath = path.join(MEDIA_DIR, name);
  if (!mime || !fs.existsSync(filePath)) return null;
  return { filePath, mime };
}

/**
 * Gives a local copy of a media file (for ffmpeg). Call `release` when done:
 * it deletes the temporary copy downloaded from Supabase.
 */
export async function withLocalMedia(url: string): Promise<{ filePath: string; release: () => void }> {
  const name = mediaName(url);
  if (!name) throw new MediaError("Uno dei file non esiste più. Ricaricalo.");
  if (url.startsWith("/api/media/")) {
    const file = localMediaFile(name);
    if (!file) throw new MediaError("Uno dei file non esiste più. Ricaricalo.");
    return { filePath: file.filePath, release: () => {} };
  }
  const res = await fetch(url);
  if (!res.ok) throw new MediaError("Uno dei file non esiste più. Ricaricalo.");
  const filePath = path.join(os.tmpdir(), `social-in-${crypto.randomUUID()}${path.extname(name)}`);
  fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  return { filePath, release: () => fs.rmSync(filePath, { force: true }) };
}
