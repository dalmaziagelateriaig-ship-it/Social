import "server-only";
import fs from "node:fs";
import { getAccount, saveAccount } from "../db";
import { withLocalMedia } from "../media";
import type { Post } from "../types";
import { PublishError, requirePublicBaseUrl } from "./config";
import { captionFor, isVideoUrl } from "./media";

// TikTok Login Kit (OAuth v2) + Content Posting API (Direct Post).
const API = "https://open.tiktokapis.com/v2";
export const TIKTOK_SCOPES = ["user.info.basic", "video.publish"];

export interface TikTokAccount {
  accessToken: string;
  refreshToken: string;
  /** ISO dates */
  expiresAt: string;
  refreshExpiresAt: string;
  openId: string;
  username: string | null;
  connectedAt: string;
}

export function redirectUri(): string {
  return `${requirePublicBaseUrl()}/api/auth/tiktok/callback`;
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: TIKTOK_SCOPES.join(","),
    response_type: "code",
    redirect_uri: redirectUri(),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
};

async function token(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...params,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || json.error || !json.access_token) {
    throw new PublishError(`TikTok: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`);
  }
  return json;
}

function toAccount(t: TokenResponse, previous?: TikTokAccount | null): TikTokAccount {
  const now = Date.now();
  return {
    accessToken: t.access_token!,
    refreshToken: t.refresh_token ?? previous?.refreshToken ?? "",
    expiresAt: new Date(now + (t.expires_in ?? 86400) * 1000).toISOString(),
    refreshExpiresAt: new Date(now + (t.refresh_expires_in ?? 365 * 86400) * 1000).toISOString(),
    openId: t.open_id ?? previous?.openId ?? "",
    username: previous?.username ?? null,
    connectedAt: previous?.connectedAt ?? new Date().toISOString(),
  };
}

type ApiResponse<T> = { data?: T; error?: { code?: string; message?: string } };

async function api<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  const code = json.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    if (code === "unaudited_client_can_only_post_to_private_accounts") {
      throw new PublishError(
        "TikTok: finché l'app non è approvata da TikTok si può pubblicare solo in privato. Imposta l'account TikTok come privato o completa la verifica dell'app.",
      );
    }
    if (code === "access_token_invalid" || res.status === 401) {
      throw new PublishError("Il collegamento con TikTok è scaduto: ricollegalo dalla pagina Account.");
    }
    throw new PublishError(`TikTok: ${json.error?.message || code || `HTTP ${res.status}`}`);
  }
  return json.data as T;
}

type CreatorInfo = { creator_username?: string; privacy_level_options?: string[]; max_video_post_duration_sec?: number };

export async function connectTikTok(code: string): Promise<TikTokAccount> {
  const account = toAccount(
    await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri() }),
  );
  try {
    const info = await api<CreatorInfo>("/post/publish/creator_info/query/", account.accessToken, {});
    account.username = info.creator_username ?? null;
  } catch {
    // The name is only for display.
  }
  await saveAccount("tiktok", account);
  return account;
}

/** Returns a valid access token, refreshing it when it is about to expire. */
async function accessToken(): Promise<string> {
  const account = await getAccount<TikTokAccount>("tiktok");
  if (!account) throw new PublishError("Collega TikTok dalla pagina Account.");
  if (new Date(account.expiresAt).getTime() - Date.now() > 5 * 60 * 1000) return account.accessToken;
  if (new Date(account.refreshExpiresAt).getTime() < Date.now()) {
    throw new PublishError("Il collegamento con TikTok è scaduto: ricollegalo dalla pagina Account.");
  }
  const refreshed = toAccount(
    await token({ grant_type: "refresh_token", refresh_token: account.refreshToken }),
    account,
  );
  await saveAccount("tiktok", refreshed);
  return refreshed.accessToken;
}

const MB = 1024 * 1024;

/** Chunking rules: one chunk under 64 MB, otherwise 10 MB chunks with the remainder in the last one. */
export function chunkPlan(size: number): { chunkSize: number; count: number } {
  if (size <= 64 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function publishToTikTok(post: Post): Promise<string> {
  const video = post.media.find(isVideoUrl);
  if (!video) throw new PublishError("Su TikTok si possono pubblicare da qui solo video: aggiungi un video al contenuto.");
  const token = await accessToken();

  const info = await api<CreatorInfo>("/post/publish/creator_info/query/", token, {});
  const options = info.privacy_level_options ?? [];
  const privacy = options.includes("PUBLIC_TO_EVERYONE")
    ? "PUBLIC_TO_EVERYONE"
    : options.includes("FOLLOWER_OF_CREATOR")
      ? "FOLLOWER_OF_CREATOR"
      : "SELF_ONLY";

  const local = await withLocalMedia(video);
  try {
    const size = fs.statSync(local.filePath).size;
    const { chunkSize, count } = chunkPlan(size);
    const init = await api<{ publish_id: string; upload_url: string }>("/post/publish/video/init/", token, {
      post_info: {
        title: captionFor(post, "tiktok").slice(0, 2200),
        privacy_level: privacy,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: count },
    });

    const mime = video.endsWith(".mov") ? "video/quicktime" : video.endsWith(".webm") ? "video/webm" : "video/mp4";
    const fd = fs.openSync(local.filePath, "r");
    try {
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize;
        const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
        const buf = Buffer.alloc(end - start + 1);
        fs.readSync(fd, buf, 0, buf.length, start);
        const res = await fetch(init.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": mime,
            "Content-Length": String(buf.length),
            "Content-Range": `bytes ${start}-${end}/${size}`,
          },
          body: new Uint8Array(buf),
        });
        if (!res.ok) throw new PublishError(`TikTok: caricamento del video non riuscito (HTTP ${res.status}).`);
      }
    } finally {
      fs.closeSync(fd);
    }

    // Wait for TikTok to process the video (up to ~5 minutes).
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const status = await api<{ status: string; fail_reason?: string }>("/post/publish/status/fetch/", token, {
        publish_id: init.publish_id,
      });
      if (status.status === "PUBLISH_COMPLETE") return init.publish_id;
      if (status.status === "FAILED") {
        throw new PublishError(`TikTok ha rifiutato il video${status.fail_reason ? `: ${status.fail_reason}` : ""}.`);
      }
    }
    // Still processing: TikTok will finish on its own.
    return init.publish_id;
  } finally {
    local.release();
  }
}
