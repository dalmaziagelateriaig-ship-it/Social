import { connection } from "next/server";
import { redirect } from "next/navigation";
import { tiktokConfigured, PublishError } from "@/lib/social/config";
import { authUrl } from "@/lib/social/tiktok";
import { newState } from "@/lib/social/oauth";

export async function GET() {
  await connection();
  if (!tiktokConfigured()) redirect("/account?error=" + encodeURIComponent("Mancano le chiavi dell'app TikTok nelle impostazioni del server."));
  let url: string;
  try {
    url = authUrl(await newState("tiktok"));
  } catch (error) {
    const message = error instanceof PublishError ? error.message : "Impossibile avviare il collegamento.";
    redirect("/account?error=" + encodeURIComponent(message));
  }
  redirect(url);
}
