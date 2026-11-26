import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { getProfile, saveProfile } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { profileSchema } from "@/lib/validation";

export async function GET() {
  await connection();
  return Response.json(await getProfile());
}

export async function PUT(request: NextRequest) {
  try {
    return Response.json(await saveProfile(profileSchema.parse(await request.json())));
  } catch (error) {
    return errorResponse(error);
  }
}
