import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { VIDEO_FORMATS, renderVideo, type VideoFormat } from "@/lib/video";

const mediaUrl = z.string().regex(/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/);

const bodySchema = z.object({
  clips: z
    .array(
      z
        .object({ url: mediaUrl, start: z.number().min(0), end: z.number().positive() })
        .refine((c) => c.end > c.start, "La fine di una clip deve venire dopo l'inizio"),
    )
    .min(1, "Aggiungi almeno una clip")
    .max(20),
  format: z.enum(Object.keys(VIDEO_FORMATS) as [VideoFormat, ...VideoFormat[]]),
  fit: z.enum(["riempi", "sfocato"]),
  mute: z.boolean(),
  overlayUrl: mediaUrl.nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const total = body.clips.reduce((s, c) => s + c.end - c.start, 0);
    if (total > 180) {
      return Response.json({ error: "Il video finale può durare al massimo 3 minuti." }, { status: 400 });
    }
    return Response.json({ url: await renderVideo(body) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
