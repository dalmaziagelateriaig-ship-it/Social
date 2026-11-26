"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, ErrorBox, Field, PageHeader, PlatformPicker, Spinner, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { GeneratedPost } from "@/lib/ai";
import {
  PLATFORM_LABELS,
  POST_TYPE_LABELS,
  POST_TYPES,
  PLATFORMS,
  type Platform,
  type PostInput,
  type PostType,
} from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs text-brand-700 hover:underline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copiato ✓" : "Copia"}
    </button>
  );
}

function CreateForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [idea, setIdea] = useState(params.get("idea") ?? "");
  const [type, setType] = useState<PostType>((POST_TYPES as readonly string[]).includes(params.get("type") ?? "") ? (params.get("type") as PostType) : "post");
  const [platforms, setPlatforms] = useState<Platform[]>(() => {
    const fromUrl = (params.get("platforms") ?? "").split(",").filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
    return fromUrl.length ? fromUrl : ["instagram", "facebook"];
  });
  const [result, setResult] = useState<GeneratedPost | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api<GeneratedPost>("/api/ai/post", { body: { idea, platforms, type } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    setError(null);
    const captions: PostInput["captions"] = {};
    for (const p of platforms) captions[p] = result.captions[p];
    const post: PostInput = {
      title: result.title,
      type,
      platforms,
      captions,
      hashtags: result.hashtags,
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? "programmato" : "bozza",
      imageIdea: result.imageIdea,
      videoScript: result.videoScript,
      notes: `Orario consigliato dall'AI: ${result.suggestedTime}`,
    };
    try {
      await api("/api/posts", { body: post });
      router.push("/calendario");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const hashtagLine = result?.hashtags.map((h) => `#${h}`).join(" ") ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card className="h-fit space-y-4">
        <Field label="Di cosa vuoi parlare?" hint="Più dettagli dai, migliore sarà il risultato.">
          <textarea
            rows={5}
            className={inputClass}
            placeholder="Es. Nuovo gusto pistacchio di Bronte, disponibile da questo weekend. Vorrei invogliare le famiglie a passare sabato pomeriggio."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </Field>
        <Field label="Formato">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as PostType)}>
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>
                {POST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Social">
          <PlatformPicker value={platforms} onChange={setPlatforms} />
        </Field>
        <Button onClick={generate} disabled={loading || idea.trim().length < 3 || platforms.length === 0} className="w-full">
          {loading ? (
            <>
              <Spinner /> Sto scrivendo…
            </>
          ) : result ? (
            "✨ Rigenera"
          ) : (
            "✨ Genera contenuto"
          )}
        </Button>
        <ErrorBox message={error} />
      </Card>

      <div className="space-y-4">
        {!result && !loading && (
          <Card className="text-sm text-stone-500">
            Qui vedrai i testi per ogni social, gli hashtag, l&apos;idea per la foto e, per i video, il copione scena per scena.
          </Card>
        )}
        {loading && !result && (
          <Card className="flex items-center gap-3 text-sm text-stone-500">
            <Spinner /> Claude sta preparando il contenuto, di solito ci vogliono 10-30 secondi.
          </Card>
        )}
        {result && (
          <>
            <Card>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">Titolo</div>
              <input className={inputClass} value={result.title} onChange={(e) => setResult({ ...result, title: e.target.value })} />
            </Card>
            {platforms.map((p) => (
              <Card key={p}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">{PLATFORM_LABELS[p]}</div>
                  <CopyButton text={`${result.captions[p]}\n\n${hashtagLine}`} />
                </div>
                <textarea
                  rows={7}
                  className={inputClass}
                  value={result.captions[p]}
                  onChange={(e) => setResult({ ...result, captions: { ...result.captions, [p]: e.target.value } })}
                />
              </Card>
            ))}
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Hashtag</div>
                <CopyButton text={hashtagLine} />
              </div>
              <p className="text-sm text-brand-700">{hashtagLine}</p>
            </Card>
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Idea per la foto o grafica</div>
                <CopyButton text={result.imageIdea} />
              </div>
              <p className="whitespace-pre-line text-sm text-stone-700">{result.imageIdea}</p>
            </Card>
            {result.videoScript && (
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Copione del video</div>
                  <CopyButton text={result.videoScript} />
                </div>
                <p className="whitespace-pre-line text-sm text-stone-700">{result.videoScript}</p>
              </Card>
            )}
            <Card className="space-y-3">
              <div className="text-sm">
                <span className="font-semibold">⏰ Quando pubblicarlo:</span> {result.suggestedTime}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Data e ora (facoltativo)">
                  <input type="datetime-local" className={inputClass} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </Field>
                <Button onClick={save} disabled={saving}>
                  {saving && <Spinner />} Salva nel calendario
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <div>
      <PageHeader title="Crea con AI" subtitle="Scrivi un'idea e ottieni testi pronti per Instagram, Facebook e TikTok." />
      <Suspense>
        <CreateForm />
      </Suspense>
    </div>
  );
}
