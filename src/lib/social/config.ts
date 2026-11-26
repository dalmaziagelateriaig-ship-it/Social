import "server-only";

/** Public address of the app, needed for login redirects and for Meta to download media. */
export function publicBaseUrl(): string | null {
  const explicit = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  // Set automatically by Render.
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  return null;
}

export class PublishError extends Error {}

export function requirePublicBaseUrl(): string {
  const url = publicBaseUrl();
  if (!url) {
    throw new PublishError(
      "L'app deve essere online con un indirizzo pubblico (imposta PUBLIC_BASE_URL) per collegare gli account e pubblicare.",
    );
  }
  return url;
}

export const metaConfigured = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
export const tiktokConfigured = () => Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
