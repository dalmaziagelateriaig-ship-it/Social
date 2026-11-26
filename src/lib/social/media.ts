import "server-only";
import type { Platform, Post } from "../types";
import { convertToJpeg } from "../video";
import { requirePublicBaseUrl } from "./config";

export const isVideoUrl = (url: string) => /\.(mp4|mov|webm)$/i.test(url);

/** Absolute URL Meta can download (Supabase URLs already are). */
export function publicMediaUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${requirePublicBaseUrl()}${url}`;
}

const jpegCache = new Map<string, string>();

/** Public URL of a JPEG version of the image (Instagram accepts only JPEG). */
export async function publicJpegUrl(url: string): Promise<string> {
  if (/\.jpe?g$/i.test(url)) return publicMediaUrl(url);
  let jpeg = jpegCache.get(url);
  if (!jpeg) {
    jpeg = await convertToJpeg(url);
    jpegCache.set(url, jpeg);
  }
  return publicMediaUrl(jpeg);
}

/** Text for a platform: its own caption (or the first available one) plus the hashtags. */
export function captionFor(post: Post, platform: Platform): string {
  const text =
    post.captions[platform]?.trim() ||
    Object.values(post.captions).find((c) => c?.trim())?.trim() ||
    post.title;
  const tags = post.hashtags.map((h) => `#${h}`).join(" ");
  return tags && !text.includes(tags) ? `${text}\n\n${tags}` : text;
}
