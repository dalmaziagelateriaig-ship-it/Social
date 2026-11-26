import type { NextRequest } from "next/server";
import { deletePost, getPost, updatePost } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { postInputSchema } from "@/lib/validation";

const notFound = () => Response.json({ error: "Post non trovato" }, { status: 404 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/posts/[id]">) {
  const post = await getPost(Number((await ctx.params).id));
  return post ? Response.json(post) : notFound();
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/posts/[id]">) {
  try {
    const id = Number((await ctx.params).id);
    const post = await updatePost(id, postInputSchema.parse(await request.json()));
    return post ? Response.json(post) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/posts/[id]">) {
  await deletePost(Number((await ctx.params).id));
  return new Response(null, { status: 204 });
}
