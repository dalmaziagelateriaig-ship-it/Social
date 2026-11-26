import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { isSupportedMime, maxUploadBytes, saveMedia } from "@/lib/media";


/** Upload one or more photos/videos (multipart field "files"). */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return Response.json({ error: "Nessun file ricevuto" }, { status: 400 });
    }
    const urls: string[] = [];
    for (const file of files) {
      if (!isSupportedMime(file.type)) {
        return Response.json(
          { error: `"${file.name}" non è supportato. Usa JPG, PNG, WEBP, MP4, MOV o WEBM.` },
          { status: 400 },
        );
      }
      if (file.size > maxUploadBytes()) {
        const mb = Math.round(maxUploadBytes() / 1024 / 1024);
        return Response.json({ error: `"${file.name}" supera i ${mb} MB.` }, { status: 400 });
      }
      urls.push(await saveMedia(Buffer.from(await file.arrayBuffer()), file.type));
    }
    return Response.json({ urls }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
