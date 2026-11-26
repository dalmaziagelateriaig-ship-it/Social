import type { NextRequest } from "next/server";
import { listPosts } from "@/lib/db";
import { runDuePosts } from "@/lib/social/publisher";

/**
 * Called by an external scheduler (e.g. cron-job.org) every few minutes with
 * ?secret=CRON_SECRET: publishes due posts and keeps the free services awake.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.nextUrl.searchParams.get("secret") !== secret) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }
  await listPosts({ from: "0000-00-00", to: "0000-00-00" }); // touches the database
  const published = await runDuePosts();
  return Response.json({ ok: true, published });
}
