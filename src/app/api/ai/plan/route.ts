import type { NextRequest } from "next/server";
import { z } from "zod";
import { generatePlan } from "@/lib/ai";
import { getProfile } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { platformSchema } from "@/lib/validation";

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mese non valido"),
  postsPerWeek: z.number().int().min(1).max(21),
  platforms: z.array(platformSchema).min(1, "Scegli almeno un social"),
  goals: z.string().max(2000).default(""),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    return Response.json(await generatePlan({ ...body, profile: await getProfile() }));
  } catch (error) {
    return errorResponse(error);
  }
}
