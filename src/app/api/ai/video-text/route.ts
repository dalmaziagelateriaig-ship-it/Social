import type { NextRequest } from "next/server";
import { z } from "zod";
import { suggestVideoText } from "@/lib/ai";
import { getProfile } from "@/lib/db";
import { errorResponse } from "@/lib/http";

const bodySchema = z.object({ topic: z.string().trim().min(3, "Scrivi di cosa parla il video").max(1000) });

export async function POST(request: NextRequest) {
  try {
    const { topic } = bodySchema.parse(await request.json());
    return Response.json(await suggestVideoText({ topic, profile: getProfile() }));
  } catch (error) {
    return errorResponse(error);
  }
}
