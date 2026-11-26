import "server-only";
import { AIError } from "./ai";

/** Output shape of a generated image. */
export const IMAGE_FORMATS = ["quadrato", "verticale", "storia"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

type Provider = "openai" | "google";

function provider(): Provider {
  const explicit = process.env.IMAGE_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "google") return explicit;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "google";
  throw new AIError(
    "Per creare immagini serve una chiave di un servizio di immagini: aggiungi OPENAI_API_KEY oppure GEMINI_API_KEY nel file .env.local e riavvia l'app.",
    503,
  );
}

export function imageProviderConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

const STYLE =
  "Fotografia realistica e curata, adatta ai social di una piccola attività: luce naturale, colori vivi ma veri, nessun testo o logo nell'immagine.";

/** Generates one image and returns its bytes and MIME type. */
export async function generateImage(
  prompt: string,
  format: ImageFormat,
): Promise<{ data: Buffer; mime: string }> {
  const fullPrompt = `${prompt}\n\n${STYLE}`;
  return provider() === "openai"
    ? generateWithOpenAI(fullPrompt, format)
    : generateWithGoogle(fullPrompt, format);
}

async function failed(res: Response, service: string): Promise<never> {
  const detail = await res.text().catch(() => "");
  console.error(`${service} image error`, res.status, detail);
  if (res.status === 401 || res.status === 403) {
    throw new AIError(`La chiave di ${service} non è valida o non ha accesso alle immagini.`, 401);
  }
  if (res.status === 429) {
    throw new AIError(`${service}: troppe richieste o credito esaurito. Riprova più tardi.`, 429);
  }
  if (res.status === 400) {
    throw new AIError(`${service} non ha accettato la descrizione. Prova a riformularla.`, 422);
  }
  throw new AIError(`Errore di ${service} (${res.status}) durante la creazione dell'immagine.`, 502);
}

// OpenAI Images API: https://platform.openai.com/docs/api-reference/images
async function generateWithOpenAI(prompt: string, format: ImageFormat) {
  const size = format === "quadrato" ? "1024x1024" : "1024x1536";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.IMAGE_MODEL ?? "gpt-image-1",
      prompt,
      size,
      n: 1,
    }),
  });
  if (!res.ok) await failed(res, "OpenAI");
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new AIError("OpenAI non ha restituito un'immagine. Riprova.", 502);
  return { data: Buffer.from(b64, "base64"), mime: "image/png" };
}

// Gemini API image generation: https://ai.google.dev/gemini-api/docs/image-generation
async function generateWithGoogle(prompt: string, format: ImageFormat) {
  const aspectRatio = { quadrato: "1:1", verticale: "4:5", storia: "9:16" }[format];
  const model = process.env.IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      }),
    },
  );
  if (!res.ok) await failed(res, "Google Gemini");
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) throw new AIError("Gemini non ha restituito un'immagine. Riprova.", 502);
  return { data: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType };
}
