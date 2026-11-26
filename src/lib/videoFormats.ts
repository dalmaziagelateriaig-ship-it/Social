export const VIDEO_FORMATS = {
  verticale: { w: 1080, h: 1920, label: "Verticale 9:16 (Reel, TikTok, Storie)" },
  feed: { w: 1080, h: 1350, label: "Feed 4:5" },
  quadrato: { w: 1080, h: 1080, label: "Quadrato 1:1" },
  orizzontale: { w: 1920, h: 1080, label: "Orizzontale 16:9" },
} as const;
export type VideoFormat = keyof typeof VIDEO_FORMATS;

export type FitMode = "riempi" | "sfocato";
