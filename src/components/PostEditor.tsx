"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { GeneratedPost } from "@/lib/ai";
import {
  PLATFORM_LABELS,
  POST_STATUS_LABELS,
  POST_STATUSES,
  POST_TYPE_LABELS,
  POST_TYPES,
  type Post,
  type PostInput,
} from "@/lib/types";
import { Button, ErrorBox, Field, PlatformPicker, Spinner, inputClass } from "./ui";

export function emptyPost(scheduledAt: string | null = null): PostInput {
  return {
    title: "",
    type: "post",
    platforms: ["instagram", "facebook"],
    captions: {},
    hashtags: [],
    scheduledAt,
    status: "bozza",
    imageIdea: "",
    videoScript: "",
    notes: "",
  };
}

/** Modal to create or edit a post. `post` with an id edits, without one creates. */
export function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post: Post | PostInput;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = "id" in post ? post.id : null;
  const [draft, setDraft] = useState<PostInput>(() => ({
    title: post.title,
    type: post.type,
    platforms: post.platforms,
    captions: post.captions,
    hashtags: post.hashtags,
    scheduledAt: post.scheduledAt,
    status: post.status,
    imageIdea: post.imageIdea,
    videoScript: post.videoScript,
    notes: post.notes,
  }));
  const [hashtagText, setHashtagText] = useState(draft.hashtags.map((h) => `#${h}`).join(" "));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PostInput>(key: K, value: PostInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    const body: PostInput = {
      ...draft,
      hashtags: hashtagText
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, "").trim())
        .filter(Boolean),
    };
    try {
      await api(id ? `/api/posts/${id}` : "/api/posts", { method: id ? "PUT" : "POST", body });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /** Fills empty captions, hashtags and ideas with Claude, from title + notes. */
  async function writeWithAI() {
    setGenerating(true);
    setError(null);
    try {
      const result = await api<GeneratedPost>("/api/ai/post", {
        body: { idea: [draft.title, draft.notes].filter(Boolean).join("\n"), platforms: draft.platforms, type: draft.type },
      });
      const captions = { ...draft.captions };
      for (const p of draft.platforms) captions[p] = result.captions[p];
      setDraft((d) => ({
        ...d,
        captions,
        imageIdea: d.imageIdea || result.imageIdea,
        videoScript: d.videoScript || result.videoScript,
      }));
      if (!hashtagText.trim()) setHashtagText(result.hashtags.map((h) => `#${h}`).join(" "));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function remove() {
    if (!id) return;
    setSaving(true);
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{id ? "Modifica contenuto" : "Nuovo contenuto"}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-stone-400 hover:text-stone-700" aria-label="Chiudi">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Titolo">
            <input className={inputClass} value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Formato">
              <select className={inputClass} value={draft.type} onChange={(e) => set("type", e.target.value as PostInput["type"])}>
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {POST_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data e ora">
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.scheduledAt ?? ""}
                onChange={(e) => set("scheduledAt", e.target.value || null)}
              />
            </Field>
            <Field label="Stato">
              <select className={inputClass} value={draft.status} onChange={(e) => set("status", e.target.value as PostInput["status"])}>
                {POST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {POST_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Social">
            <PlatformPicker value={draft.platforms} onChange={(v) => set("platforms", v)} />
          </Field>

          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
            <span className="text-sm text-brand-700">Vuoi che l&apos;AI scriva i testi partendo da titolo e note?</span>
            <Button variant="secondary" onClick={writeWithAI} disabled={generating || draft.platforms.length === 0 || !draft.title.trim()}>
              {generating ? <><Spinner /> Scrivo…</> : "✨ Scrivi con AI"}
            </Button>
          </div>

          {draft.platforms.map((p) => (
            <Field key={p} label={`Testo per ${PLATFORM_LABELS[p]}`}>
              <textarea
                rows={5}
                className={inputClass}
                value={draft.captions[p] ?? ""}
                onChange={(e) => set("captions", { ...draft.captions, [p]: e.target.value })}
              />
            </Field>
          ))}

          <Field label="Hashtag" hint="Separati da spazio">
            <input className={inputClass} value={hashtagText} onChange={(e) => setHashtagText(e.target.value)} />
          </Field>

          <Field label="Idea per foto o grafica">
            <textarea rows={3} className={inputClass} value={draft.imageIdea} onChange={(e) => set("imageIdea", e.target.value)} />
          </Field>

          {(draft.type === "reel" || draft.platforms.includes("tiktok") || draft.videoScript) && (
            <Field label="Copione video">
              <textarea rows={6} className={inputClass} value={draft.videoScript} onChange={(e) => set("videoScript", e.target.value)} />
            </Field>
          )}

          <Field label="Note">
            <textarea rows={2} className={inputClass} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          <ErrorBox message={error} />

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <div>
              {id && (
                <Button variant="danger" onClick={remove} disabled={saving}>
                  Elimina
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Annulla
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Spinner />} Salva
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
