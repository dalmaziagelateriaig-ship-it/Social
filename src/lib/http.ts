import { z } from "zod";
import { AIError } from "./ai";
import { MediaError } from "./media";
import { VideoError } from "./video";

/** Turns thrown errors into JSON responses with a message the UI can show. */
export function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: error.issues.map((i) => i.message).join(". ") },
      { status: 400 },
    );
  }
  if (error instanceof AIError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof VideoError || error instanceof MediaError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  console.error(error);
  return Response.json({ error: "Errore imprevisto. Riprova." }, { status: 500 });
}
