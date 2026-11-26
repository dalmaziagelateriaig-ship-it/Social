export const PLATFORMS = ["instagram", "facebook", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export const POST_TYPES = ["post", "carosello", "reel", "storia"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LABELS: Record<PostType, string> = {
  post: "Post con foto",
  carosello: "Carosello",
  reel: "Reel / Video",
  storia: "Storia",
};

export const POST_STATUSES = ["bozza", "programmato", "in_pubblicazione", "pubblicato", "errore"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  bozza: "Bozza",
  programmato: "Programmato",
  in_pubblicazione: "In pubblicazione",
  pubblicato: "Pubblicato",
  errore: "Errore di pubblicazione",
};

export type PublicationStatus = "in_corso" | "pubblicato" | "errore";

/** Outcome of publishing one post on one platform. */
export interface Publication {
  postId: number;
  platform: Platform;
  status: PublicationStatus;
  externalId: string | null;
  error: string | null;
  updatedAt: string;
}

/** What the UI may know about connected accounts (never tokens). */
export interface AccountsSummary {
  publicUrl: string | null;
  meta: {
    configured: boolean;
    connected: boolean;
    pages: { id: string; name: string; instagram: string | null }[];
    selectedPageId: string | null;
  };
  tiktok: {
    configured: boolean;
    connected: boolean;
    username: string | null;
    expiresAt: string | null;
  };
}

export type Captions = Partial<Record<Platform, string>>;

export interface Post {
  id: number;
  title: string;
  type: PostType;
  platforms: Platform[];
  captions: Captions;
  hashtags: string[];
  /** Local date-time "YYYY-MM-DDTHH:mm", or null when not scheduled yet. */
  scheduledAt: string | null;
  status: PostStatus;
  imageIdea: string;
  /** URLs of photos and videos attached to the post (served from /api/media). */
  media: string[];
  videoScript: string;
  notes: string;
  createdAt: string;
}

export type PostInput = Omit<Post, "id" | "createdAt">;

export interface Profile {
  businessName: string;
  businessType: string;
  city: string;
  description: string;
  products: string;
  audience: string;
  tone: string;
  hashtags: string;
}

export const EMPTY_PROFILE: Profile = {
  businessName: "",
  businessType: "",
  city: "",
  description: "",
  products: "",
  audience: "",
  tone: "",
  hashtags: "",
};
