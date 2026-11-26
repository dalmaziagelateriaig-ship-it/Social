import type { NextRequest } from "next/server";
import { createPost, listPosts } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { postInputSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  return Response.json(listPosts(from && to ? { from, to } : undefined));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accepts one post or an array (used when saving a whole monthly plan).
    if (Array.isArray(body)) {
      const inputs = body.map((item) => postInputSchema.parse(item));
      return Response.json(inputs.map(createPost), { status: 201 });
    }
    return Response.json(createPost(postInputSchema.parse(body)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
