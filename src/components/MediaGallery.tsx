"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorBox, Spinner, inputClass } from "./ui";

const FORMATS = [
  { value: "verticale", label: "Verticale (feed)" },
  { value: "quadrato", label: "Quadrato" },
  { value: "storia", label: "Storia / Reel 9:16" },
] as const;

export const isVideo = (url: string) => /\.(mp4|mov|webm)$/i.test(url);

export function MediaThumb({ url, className = "" }: { url: string; className?: string }) {
  return isVideo(url) ? (
    <video src={url} className={`bg-black object-cover ${className}`} muted playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- local files of any size, no optimisation needed
    <img src={url} alt="" className={`object-cover ${className}`} />
  );
}

/** Photos and videos of a post: upload your own or generate an image with AI. */
export function MediaGallery({
  media,
  onChange,
  defaultPrompt,
}: {
  media: string[];
  onChange: (media: string[]) => void;
  defaultPrompt: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [format, setFormat] = useState<(typeof FORMATS)[number]["value"]>("verticale");
  const [busy, setBusy] = useState<"upload" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError(null);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    try {
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
      onChange([...media, ...data.urls]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/ai/image", { body: { prompt, format } });
      onChange([...media, url]);
      setShowGenerator(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const move = (i: number, delta: number) => {
    const next = [...media];
    const [item] = next.splice(i, 1);
    next.splice(i + delta, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.map((url, i) => (
            <div key={url} className="group relative h-28 w-24 overflow-hidden rounded-lg border border-stone-200">
              <a href={url} target="_blank" rel="noreferrer">
                <MediaThumb url={url} className="h-full w-full" />
              </a>
              {isVideo(url) && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">Video</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Sposta a sinistra">‹</button>
                <button type="button" onClick={() => onChange(media.filter((m) => m !== url))} aria-label="Rimuovi">
                  ✕
                </button>
                <button type="button" disabled={i === media.length - 1} onClick={() => move(i, 1)} aria-label="Sposta a destra">›</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
          {busy === "upload" ? <><Spinner /> Carico…</> : "📷 Carica foto o video"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!showGenerator && !prompt) setPrompt(defaultPrompt);
            setShowGenerator((v) => !v);
          }}
          disabled={busy !== null}
        >
          ✨ Crea immagine con AI
        </Button>
      </div>

      {showGenerator && (
        <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Descrivi l'immagine: soggetto, inquadratura, luce, colori…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inputClass} w-auto`} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <Button type="button" onClick={generate} disabled={busy !== null || prompt.trim().length < 5}>
              {busy === "generate" ? <><Spinner /> Creo l&apos;immagine…</> : "Crea"}
            </Button>
          </div>
          {busy === "generate" && <p className="text-xs text-stone-500">Di solito ci vogliono 10-40 secondi.</p>}
        </div>
      )}
      <ErrorBox message={error} />
    </div>
  );
}
