import type { NextRequest } from "next/server";
import { z } from "zod";
import { generatePost } from "@/lib/ai";
import { getProfile } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { POST_TYPES } from "@/lib/types";
import { platformSchema } from "@/lib/validation";

const bodySchema = z.object({
  idea: z.string().trim().min(3, "Scrivi un'idea per il contenuto").max(3000),
  platforms: z.array(platformSchema).min(1, "Scegli almeno un social"),
  type: z.enum(POST_TYPES),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    return Response.json(await generatePost({ ...body, profile: getProfile() }));
  } catch (error) {
    return errorResponse(error);
  }
}
