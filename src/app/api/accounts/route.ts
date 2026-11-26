import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { z } from "zod";
import { getAccount, saveAccount } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { metaConfigured, publicBaseUrl, tiktokConfigured } from "@/lib/social/config";
import type { MetaAccount } from "@/lib/social/meta";
import type { TikTokAccount } from "@/lib/social/tiktok";
import type { AccountsSummary } from "@/lib/types";

async function summary(): Promise<AccountsSummary> {
  const meta = await getAccount<MetaAccount>("meta");
  const tiktok = await getAccount<TikTokAccount>("tiktok");
  return {
    publicUrl: publicBaseUrl(),
    meta: {
      configured: metaConfigured(),
      connected: Boolean(meta),
      pages: (meta?.pages ?? []).map((p) => ({ id: p.id, name: p.name, instagram: p.instagram?.username ?? null })),
      selectedPageId: meta?.selectedPageId ?? null,
    },
    tiktok: {
      configured: tiktokConfigured(),
      connected: Boolean(tiktok),
      username: tiktok?.username ?? null,
      expiresAt: tiktok?.refreshExpiresAt ?? null,
    },
  };
}

export async function GET() {
  await connection();
  return Response.json(await summary());
}

/** Chooses which Facebook Page (and its Instagram account) to publish to. */
export async function PUT(request: NextRequest) {
  try {
    const { selectedPageId } = z.object({ selectedPageId: z.string() }).parse(await request.json());
    const meta = await getAccount<MetaAccount>("meta");
    if (!meta?.pages.some((p) => p.id === selectedPageId)) {
      return Response.json({ error: "Pagina non trovata" }, { status: 404 });
    }
    await saveAccount("meta", { ...meta, selectedPageId });
    return Response.json(await summary());
  } catch (error) {
    return errorResponse(error);
  }
}
