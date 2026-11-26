import type { NextRequest } from "next/server";
import { deleteAccount } from "@/lib/db";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/accounts/[platform]">) {
  const { platform } = await ctx.params;
  if (platform !== "meta" && platform !== "tiktok") return Response.json({ error: "Non trovato" }, { status: 404 });
  await deleteAccount(platform);
  return new Response(null, { status: 204 });
}
