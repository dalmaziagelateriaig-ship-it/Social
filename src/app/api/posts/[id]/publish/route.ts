import type { NextRequest } from "next/server";
import { listPublications } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { publishNow } from "@/lib/social/publisher";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/posts/[id]/publish">) {
  return Response.json(await listPublications(Number((await ctx.params).id)));
}

/** Publishes the post now on all its platforms (may take a few minutes for videos). */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/posts/[id]/publish">) {
  try {
    return Response.json(await publishNow(Number((await ctx.params).id)));
  } catch (error) {
    return errorResponse(error);
  }
}
