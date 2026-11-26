import "server-only";
import {
  getPost,
  listDuePosts,
  listPublications,
  savePublication,
  setPostStatus,
  transitionPostStatus,
} from "../db";
import type { Platform, Post, Publication } from "../types";
import { PublishError } from "./config";
import { publishToFacebook, publishToInstagram } from "./meta";
import { publishToTikTok } from "./tiktok";

const PUBLISHERS: Record<Platform, (post: Post) => Promise<string>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  tiktok: publishToTikTok,
};

/**
 * Publishes a post on each of its platforms. Platforms already published are
 * skipped, so a failed post can be retried. Returns the per-platform results.
 */
export async function publishPost(post: Post): Promise<Publication[]> {
  const done = new Set(
    (await listPublications(post.id)).filter((p) => p.status === "pubblicato").map((p) => p.platform),
  );
  let failed = false;
  for (const platform of post.platforms) {
    if (done.has(platform)) continue;
    await savePublication(post.id, platform, "in_corso");
    try {
      const id = await PUBLISHERS[platform](post);
      await savePublication(post.id, platform, "pubblicato", id);
    } catch (error) {
      failed = true;
      const message = error instanceof PublishError ? error.message : "Errore imprevisto durante la pubblicazione.";
      if (!(error instanceof PublishError)) console.error(`publish ${platform}`, error);
      await savePublication(post.id, platform, "errore", null, message);
    }
  }
  await setPostStatus(post.id, failed ? "errore" : "pubblicato");
  return listPublications(post.id);
}

/** Publishes a post now, unless it is already being published. */
export async function publishNow(id: number): Promise<Publication[]> {
  const post = await getPost(id);
  if (!post) throw new PublishError("Contenuto non trovato.");
  if (post.status === "in_pubblicazione") throw new PublishError("Questo contenuto è già in pubblicazione.");
  if (!(await transitionPostStatus(id, post.status, "in_pubblicazione"))) {
    throw new PublishError("Questo contenuto è già in pubblicazione.");
  }
  return publishPost(post);
}

/** Current local time as "YYYY-MM-DDTHH:mm" in the business's time zone. */
export function localNow(timeZone = process.env.APP_TIMEZONE ?? "Europe/Rome"): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

let running = false;

/** Publishes every scheduled post whose time has come. Safe to call often. */
export async function runDuePosts(): Promise<number> {
  if (running) return 0;
  running = true;
  let count = 0;
  try {
    for (const post of await listDuePosts(localNow())) {
      // The status change acts as a lock, so a post is never published twice.
      if (!(await transitionPostStatus(post.id, "programmato", "in_pubblicazione"))) continue;
      await publishPost(post);
      count++;
    }
  } finally {
    running = false;
  }
  return count;
}
