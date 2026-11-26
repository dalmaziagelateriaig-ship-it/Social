import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { PublishError } from "@/lib/social/config";
import { connectTikTok } from "@/lib/social/tiktok";
import { checkState } from "@/lib/social/oauth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = (message: string) => redirect("/account?error=" + encodeURIComponent(message));
  if (params.get("error")) fail("Collegamento a TikTok annullato.");
  if (!(await checkState("tiktok", params.get("state")))) fail("Collegamento scaduto o non valido: riprova.");
  const code = params.get("code");
  if (!code) fail("TikTok non ha restituito il codice di accesso.");
  try {
    await connectTikTok(code!);
  } catch (error) {
    console.error("tiktok connect", error);
    fail(error instanceof PublishError ? error.message : "Collegamento a TikTok non riuscito.");
  }
  redirect("/account?ok=tiktok");
}
