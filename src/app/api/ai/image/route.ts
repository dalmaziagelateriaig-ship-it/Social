import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { IMAGE_FORMATS, generateImage } from "@/lib/images";
import { saveMedia } from "@/lib/media";

const bodySchema = z.object({
  prompt: z.string().trim().min(5, "Descrivi l'immagine che vuoi").max(4000),
  format: z.enum(IMAGE_FORMATS).default("verticale"),
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, format } = bodySchema.parse(await request.json());
    const image = await generateImage(prompt, format);
    return Response.json({ url: saveMedia(image.data, image.mime) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
