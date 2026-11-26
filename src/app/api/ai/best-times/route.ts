import { suggestBestTimes } from "@/lib/ai";
import { getProfile, listPosts } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    return Response.json(
      await suggestBestTimes({ profile: getProfile(), posts: listPosts() }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
