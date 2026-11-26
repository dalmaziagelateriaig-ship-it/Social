import fs from "node:fs";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { localMediaFile } from "@/lib/media";

/** Serves an uploaded or generated file. Supports Range requests so videos can seek. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/media/[name]">) {
  const file = localMediaFile((await ctx.params).name);
  if (!file) return new Response("Non trovato", { status: 404 });
  const size = fs.statSync(file.filePath).size;
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(file.filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(file.filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
