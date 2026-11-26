import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  PLATFORM_LABELS,
  POST_TYPE_LABELS,
  type Platform,
  type Post,
  type PostType,
  type Profile,
} from "./types";
import { PLATFORMS, POST_TYPES } from "./types";

/** Claude model used for every generation in the app. */
export const MODEL = "claude-opus-5-5";

export class AIError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AIError(
      "Manca la chiave API di Claude. Aggiungi ANTHROPIC_API_KEY nel file .env.local e riavvia l'app.",
      503,
    );
  }
  client ??= new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `Sei il social media manager di una piccola attività italiana. Scrivi sempre in italiano.
Conosci bene Instagram, Facebook e TikTok e adatti ogni contenuto al social:
- Instagram: testo curato, emoji con misura, invito all'azione, hashtag in fondo (8-15, mix di locali, di settore e di nicchia).
- Facebook: tono più colloquiale e informativo, frasi complete, pochi hashtag (0-3), adatto a un pubblico locale e più adulto.
- TikTok: testo breve e diretto, gancio nella prima riga, 3-6 hashtag, pensato per accompagnare un video.
Rispetta il tono di voce e i dati dell'attività. Non inventare prezzi, promozioni, orari o fatti che non ti sono stati dati: se servono, lascia un segnaposto tra parentesi quadre, per esempio [prezzo].`;

function profileContext(profile: Profile): string {
  const lines = [
    ["Nome attività", profile.businessName],
    ["Tipo di attività", profile.businessType],
    ["Città / zona", profile.city],
    ["Descrizione", profile.description],
    ["Prodotti e servizi principali", profile.products],
    ["Clienti tipo", profile.audience],
    ["Tono di voce", profile.tone],
    ["Hashtag abituali", profile.hashtags],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `- ${label}: ${value.trim()}`);
  return lines.length
    ? `Dati dell'attività:\n${lines.join("\n")}`
    : "Dati dell'attività: non ancora compilati. Scrivi contenuti adatti a una piccola attività locale.";
}

function today(): string {
  return new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Calls Claude and returns output parsed against the given schema. */
async function generate<T extends z.ZodType>(
  schema: T,
  userPrompt: string,
  effort: "low" | "medium" | "high" = "medium",
): Promise<z.infer<T>> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      // On a safety decline, retry server-side on the model Anthropic recommends.
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AIError("La chiave API di Claude non è valida.", 401);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AIError("Troppe richieste a Claude. Riprova tra un minuto.", 429);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AIError("Impossibile raggiungere Claude. Controlla la connessione.", 502);
    }
    if (error instanceof Anthropic.APIError) {
      throw new AIError(`Errore di Claude (${error.status}): ${error.message}`, 502);
    }
    throw error;
  }
  if (response.stop_reason === "refusal") {
    throw new AIError("Claude non ha potuto generare questo contenuto. Prova a riformulare la richiesta.", 422);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new AIError("La risposta di Claude è incompleta. Riprova.", 502);
  }
  return response.parsed_output as z.infer<T>;
}

// ---------- Single post ----------

export const generatedPostSchema = z.object({
  title: z.string().describe("Titolo breve interno per riconoscere il post nel calendario"),
  captions: z.object({
    instagram: z.string().describe("Testo per Instagram, vuoto se non richiesto"),
    facebook: z.string().describe("Testo per Facebook, vuoto se non richiesto"),
    tiktok: z.string().describe("Testo per TikTok, vuoto se non richiesto"),
  }),
  hashtags: z.array(z.string()).describe("Hashtag senza il simbolo #"),
  imageIdea: z
    .string()
    .describe(
      "Descrizione dettagliata della foto o grafica da usare: soggetto, inquadratura, luce, colori. Utilizzabile come prompt per un generatore di immagini.",
    ),
  videoScript: z
    .string()
    .describe(
      "Per reel e TikTok: gancio iniziale, scene numerate con durata, testi a schermo, audio consigliato. Vuoto per post e storie senza video.",
    ),
  suggestedTime: z.string().describe("Giorno e orario consigliati per pubblicare, con il motivo in una frase"),
});
export type GeneratedPost = z.infer<typeof generatedPostSchema>;

export async function generatePost(input: {
  idea: string;
  platforms: Platform[];
  type: PostType;
  profile: Profile;
}): Promise<GeneratedPost> {
  const social = input.platforms.map((p) => PLATFORM_LABELS[p]).join(", ");
  const result = await generate(
    generatedPostSchema,
    `${profileContext(input.profile)}

Oggi è ${today()}.
Crea un contenuto di tipo "${POST_TYPE_LABELS[input.type]}" per: ${social}.
Scrivi il testo solo per questi social e lascia vuoti gli altri.

Idea: ${input.idea}`,
  );
  // Drop captions for platforms that were not requested.
  for (const p of PLATFORMS) {
    if (!input.platforms.includes(p)) result.captions[p] = "";
  }
  result.hashtags = result.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  return result;
}

// ---------- Monthly plan ----------

export const planSchema = z.object({
  items: z.array(
    z.object({
      date: z.string().describe("Data in formato YYYY-MM-DD"),
      time: z.string().describe("Orario in formato HH:mm"),
      platforms: z.array(z.enum(PLATFORMS)),
      type: z.enum(POST_TYPES),
      title: z.string(),
      idea: z.string().describe("Cosa mostrare e cosa dire, in 2-3 frasi"),
      reason: z.string().describe("Perché questo contenuto in questa data (ricorrenza, stagione, obiettivo)"),
    }),
  ),
  strategy: z.string().describe("Riassunto della strategia del mese in 3-4 frasi"),
});
export type Plan = z.infer<typeof planSchema>;

export async function generatePlan(input: {
  month: string; // YYYY-MM
  postsPerWeek: number;
  platforms: Platform[];
  goals: string;
  profile: Profile;
}): Promise<Plan> {
  const [year, month] = input.month.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
  const plan = await generate(
    planSchema,
    `${profileContext(input.profile)}

Oggi è ${today()}.
Prepara il piano editoriale per ${monthName} (${input.month}).
- Circa ${input.postsPerWeek} contenuti a settimana, distribuiti su tutto il mese.
- Social da usare: ${input.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}.
- Alterna i formati (post, caroselli, reel, storie) e tieni conto di stagione, ricorrenze, festività italiane ed eventi tipici del mese.
- Scegli orari realistici per il pubblico dell'attività.
${input.goals.trim() ? `Obiettivi e note: ${input.goals.trim()}` : ""}`,
    "high",
  );
  plan.items = plan.items
    .filter((item) => item.date.startsWith(input.month))
    .map((item) => ({
      ...item,
      platforms: item.platforms.filter((p) => input.platforms.includes(p)),
    }))
    .filter((item) => item.platforms.length > 0)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return plan;
}

// ---------- Best posting times ----------

export const bestTimesSchema = z.object({
  platforms: z.array(
    z.object({
      platform: z.enum(PLATFORMS),
      slots: z.array(
        z.object({
          days: z.string().describe("Giorni, per esempio 'Venerdì e sabato'"),
          times: z.string().describe("Fascia oraria, per esempio '18:00-20:00'"),
          reason: z.string(),
        }),
      ),
    }),
  ),
  tips: z.array(z.string()).describe("3-5 consigli pratici sulla frequenza e sui momenti da evitare"),
});
export type BestTimes = z.infer<typeof bestTimesSchema>;

export async function suggestBestTimes(input: {
  profile: Profile;
  posts: Post[];
}): Promise<BestTimes> {
  const history = input.posts
    .filter((p) => p.status === "pubblicato" && p.scheduledAt)
    .slice(-30)
    .map((p) => `- ${p.scheduledAt} su ${p.platforms.join(", ")}: ${p.title}`)
    .join("\n");
  return generate(
    bestTimesSchema,
    `${profileContext(input.profile)}

Oggi è ${today()}.
Indica i giorni e gli orari migliori per pubblicare su Instagram, Facebook e TikTok per questa attività, considerando il tipo di clienti, la zona, la stagione e le abitudini tipiche di ogni social in Italia.
Non hai ancora dati reali di visualizzazioni: basati sulle buone pratiche e dillo nei motivi quando è utile.
${history ? `Post già pubblicati:\n${history}` : ""}`,
    "low",
  );
}

// ---------- Recommended content ----------

export const ideasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      type: z.enum(POST_TYPES),
      platforms: z.array(z.enum(PLATFORMS)),
      idea: z.string().describe("Cosa mostrare e cosa dire, in 2-3 frasi"),
      why: z.string().describe("Perché funziona ora, in una frase"),
    }),
  ),
});
export type Ideas = z.infer<typeof ideasSchema>;

export async function suggestIdeas(input: {
  profile: Profile;
  upcoming: Post[];
}): Promise<Ideas> {
  const planned = input.upcoming
    .slice(0, 20)
    .map((p) => `- ${p.scheduledAt ?? "senza data"}: ${p.title}`)
    .join("\n");
  return generate(
    ideasSchema,
    `${profileContext(input.profile)}

Oggi è ${today()}.
Proponi 6 idee di contenuto da pubblicare nelle prossime due settimane: formati che funzionano ora su Instagram, Facebook e TikTok per questo tipo di attività (dietro le quinte, prodotti, clienti, tendenze, ricorrenze vicine).
Evita doppioni con i contenuti già in programma.
${planned ? `Già in programma:\n${planned}` : "Non c'è ancora niente in programma."}`,
    "low",
  );
}

// ---------- On-screen text for videos ----------

export const hooksSchema = z.object({
  options: z.array(z.string()).describe("5 testi brevi da mettere sul video, massimo 8 parole ciascuno"),
});
export type Hooks = z.infer<typeof hooksSchema>;

export async function suggestVideoText(input: { topic: string; profile: Profile }): Promise<Hooks> {
  return generate(
    hooksSchema,
`${profileContext(input.profile)}

Scrivi 5 testi da sovrapporre a un video breve per Reel e TikTok. Devono catturare l'attenzione nei primi 2 secondi, essere leggibili al volo (massimo 8 parole) e usare al massimo un'emoji.

Il video parla di: ${input.topic}`,
    "low",
  );
}
