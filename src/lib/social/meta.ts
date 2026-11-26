import "server-only";
import { getAccount, saveAccount } from "../db";
import type { Post } from "../types";
import { PublishError, requirePublicBaseUrl } from "./config";
import { captionFor, publicMediaUrl, publicJpegUrl, isVideoUrl } from "./media";

// Facebook Login for Business + Pages API + Instagram API (graph.facebook.com).
const VERSION = process.env.META_GRAPH_VERSION ?? "v26.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const GRAPH_VIDEO = `https://graph-video.facebook.com/${VERSION}`;

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "read_insights",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
];

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  instagram: { id: string; username: string } | null;
}

export interface MetaAccount {
  userToken: string;
  pages: MetaPage[];
  selectedPageId: string | null;
  connectedAt: string;
}

export function redirectUri(): string {
  return `${requirePublicBaseUrl()}/api/auth/meta/callback`;
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri(),
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${params}`;
}

type GraphError = { error?: { message?: string; code?: number; error_user_msg?: string } };

async function graph<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const msg = json.error?.error_user_msg ?? json.error?.message ?? `HTTP ${res.status}`;
    if (json.error?.code === 190) {
      throw new PublishError("Il collegamento con Meta è scaduto: ricollega Facebook e Instagram dalla pagina Account.");
    }
    throw new PublishError(`Meta: ${msg}`);
  }
  return json;
}

function form(params: Record<string, string>): RequestInit {
  return { method: "POST", body: new URLSearchParams(params) };
}

/** Completes the login: long-lived user token, then the Pages with their Instagram accounts. */
export async function connectMeta(code: string): Promise<MetaAccount> {
  const appId = process.env.META_APP_ID!;
  const secret = process.env.META_APP_SECRET!;
  const short = await graph<{ access_token: string }>(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: redirectUri(), code })}`,
  );
  const long = await graph<{ access_token: string }>(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: secret,
      fb_exchange_token: short.access_token,
    })}`,
  );
  // Page tokens obtained from a long-lived user token do not expire.
  const pages = await graph<{
    data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
  }>(
    `${GRAPH}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "100",
      access_token: long.access_token,
    })}`,
  );
  const previous = await getAccount<MetaAccount>("meta");
  const account: MetaAccount = {
    userToken: long.access_token,
    pages: pages.data.map((p) => ({
      id: p.id,
      name: p.name,
      accessToken: p.access_token,
      instagram: p.instagram_business_account
        ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username ?? "" }
        : null,
    })),
    selectedPageId: null,
    connectedAt: new Date().toISOString(),
  };
  account.selectedPageId =
    account.pages.find((p) => p.id === previous?.selectedPageId)?.id ??
    account.pages.find((p) => p.instagram)?.id ??
    account.pages[0]?.id ??
    null;
  await saveAccount("meta", account);
  return account;
}

export async function selectedPage(): Promise<MetaPage> {
  const account = await getAccount<MetaAccount>("meta");
  const page = account?.pages.find((p) => p.id === account.selectedPageId);
  if (!page) throw new PublishError("Collega una Pagina Facebook dalla pagina Account.");
  return page;
}

// ---------- Facebook Page ----------

export async function publishToFacebook(post: Post): Promise<string> {
  const page = await selectedPage();
  const message = captionFor(post, "facebook");
  const token = page.accessToken;
  const videos = post.media.filter(isVideoUrl);
  const images = post.media.filter((m) => !isVideoUrl(m));

  if (videos.length > 0) {
    const res = await graph<{ id: string }>(
      `${GRAPH_VIDEO}/${page.id}/videos`,
      form({ file_url: publicMediaUrl(videos[0]), description: message, access_token: token }),
    );
    return res.id;
  }
  if (images.length === 1) {
    const res = await graph<{ id: string; post_id?: string }>(
      `${GRAPH}/${page.id}/photos`,
      form({ url: await publicJpegUrl(images[0]), message, access_token: token }),
    );
    return res.post_id ?? res.id;
  }
  if (images.length > 1) {
    // Upload each photo unpublished, then attach them all to one post.
    const ids: string[] = [];
    for (const img of images.slice(0, 10)) {
      const res = await graph<{ id: string }>(
        `${GRAPH}/${page.id}/photos`,
        form({ url: await publicJpegUrl(img), published: "false", access_token: token }),
      );
      ids.push(res.id);
    }
    const params: Record<string, string> = { message, access_token: token };
    ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
    const res = await graph<{ id: string }>(`${GRAPH}/${page.id}/feed`, form(params));
    return res.id;
  }
  const res = await graph<{ id: string }>(`${GRAPH}/${page.id}/feed`, form({ message, access_token: token }));
  return res.id;
}

// ---------- Instagram ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForContainer(id: string, token: string): Promise<void> {
  // Videos need processing time; Meta suggests polling for up to 5 minutes.
  for (let i = 0; i < 60; i++) {
    const res = await graph<{ status_code?: string }>(
      `${GRAPH}/${id}?${new URLSearchParams({ fields: "status_code", access_token: token })}`,
    );
    if (res.status_code === "FINISHED" || res.status_code === "PUBLISHED") return;
    if (res.status_code === "ERROR" || res.status_code === "EXPIRED") {
      throw new PublishError("Instagram non è riuscito a elaborare il file (formato o durata non supportati).");
    }
    await sleep(5000);
  }
  throw new PublishError("Instagram sta ancora elaborando il video dopo 5 minuti. Riprova più tardi.");
}

async function createContainer(igId: string, token: string, params: Record<string, string>): Promise<string> {
  const res = await graph<{ id: string }>(`${GRAPH}/${igId}/media`, form({ ...params, access_token: token }));
  return res.id;
}

async function mediaParams(url: string, kind: "single" | "carousel" | "story"): Promise<Record<string, string>> {
  if (isVideoUrl(url)) {
    const media_type = kind === "story" ? "STORIES" : kind === "carousel" ? "VIDEO" : "REELS";
    return { media_type, video_url: publicMediaUrl(url) };
  }
  const image = { image_url: await publicJpegUrl(url) };
  return kind === "story" ? { ...image, media_type: "STORIES" } : image;
}

export async function publishToInstagram(post: Post): Promise<string> {
  const page = await selectedPage();
  if (!page.instagram) {
    throw new PublishError(`La Pagina "${page.name}" non ha un account Instagram professionale collegato.`);
  }
  if (post.media.length === 0) {
    throw new PublishError("Instagram richiede almeno una foto o un video.");
  }
  requirePublicBaseUrl();
  const igId = page.instagram.id;
  const token = page.accessToken;
  const caption = captionFor(post, "instagram");

  let containerId: string;
  if (post.type === "storia") {
    containerId = await createContainer(igId, token, await mediaParams(post.media[0], "story"));
  } else if (post.media.length === 1) {
    containerId = await createContainer(igId, token, { ...(await mediaParams(post.media[0], "single")), caption });
  } else {
    const children: string[] = [];
    for (const m of post.media.slice(0, 10)) {
      const id = await createContainer(igId, token, { ...(await mediaParams(m, "carousel")), is_carousel_item: "true" });
      await waitForContainer(id, token);
      children.push(id);
    }
    containerId = await createContainer(igId, token, { media_type: "CAROUSEL", children: children.join(","), caption });
  }
  await waitForContainer(containerId, token);
  const res = await graph<{ id: string }>(
    `${GRAPH}/${igId}/media_publish`,
    form({ creation_id: containerId, access_token: token }),
  );
  return res.id;
}

export { GRAPH as META_GRAPH_URL, graph as metaGraph };
