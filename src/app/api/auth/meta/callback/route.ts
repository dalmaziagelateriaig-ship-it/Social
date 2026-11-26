import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { PublishError } from "@/lib/social/config";
import { connectMeta } from "@/lib/social/meta";
import { checkState } from "@/lib/social/oauth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = (message: string) => redirect("/account?error=" + encodeURIComponent(message));
  if (params.get("error")) fail("Collegamento a Facebook e Instagram annullato.");
  if (!(await checkState("meta", params.get("state")))) fail("Collegamento scaduto o non valido: riprova.");
  const code = params.get("code");
  if (!code) fail("Facebook e Instagram non ha restituito il codice di accesso.");
  try {
    await connectMeta(code!);
  } catch (error) {
    console.error("meta connect", error);
    fail(error instanceof PublishError ? error.message : "Collegamento a Facebook e Instagram non riuscito.");
  }
  redirect("/account?ok=meta");
}
