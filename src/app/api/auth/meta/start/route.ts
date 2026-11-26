import { connection } from "next/server";
import { redirect } from "next/navigation";
import { metaConfigured, PublishError } from "@/lib/social/config";
import { authUrl } from "@/lib/social/meta";
import { newState } from "@/lib/social/oauth";

export async function GET() {
  await connection();
  if (!metaConfigured()) redirect("/account?error=" + encodeURIComponent("Mancano le chiavi dell'app Facebook e Instagram nelle impostazioni del server."));
  let url: string;
  try {
    url = authUrl(await newState("meta"));
  } catch (error) {
    const message = error instanceof PublishError ? error.message : "Impossibile avviare il collegamento.";
    redirect("/account?error=" + encodeURIComponent(message));
  }
  redirect(url);
}
