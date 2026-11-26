import { suggestIdeas } from "@/lib/ai";
import { getProfile, listPosts } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const upcoming = listPosts().filter((p) => !p.scheduledAt || p.scheduledAt >= todayKey);
    return Response.json(await suggestIdeas({ profile: getProfile(), upcoming }));
  } catch (error) {
    return errorResponse(error);
  }
}
