"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { Hooks } from "@/lib/ai";
import type { PostInput } from "@/lib/types";
import { VIDEO_FORMATS, type FitMode, type VideoFormat } from "@/lib/videoFormats";

interface Clip {
  url: string;
  name: string;
  duration: number;
  start: number;
  end: number;
}

type TextPosition = "alto" | "centro" | "basso";

const round = (n: number) => Math.round(n * 10) / 10;

/** Draws the on-screen text as a transparent image the size of the output video. */
function drawOverlay(canvas: HTMLCanvasElement, text: string, position: TextPosition, w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  if (!text.trim()) return;

  const fontSize = Math.round(w * 0.065);
  ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const maxWidth = w * 0.82;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }

  const lineHeight = fontSize * 1.25;
  const padding = fontSize * 0.5;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padding * 2;
  const top = position === "alto" ? h * 0.12 : position === "centro" ? (h - boxHeight) / 2 : h * 0.78 - boxHeight;
  const left = (w - boxWidth) / 2;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(left, top, boxWidth, boxHeight, fontSize * 0.35);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, w / 2, top + padding + lineHeight * (i + 0.5)));
}

export default function VideoEditorPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [format, setFormat] = useState<VideoFormat>("verticale");
  const [fit, setFit] = useState<FitMode>("sfocato");
  const [mute, setMute] = useState(false);
  const [text, setText] = useState("");
  const [position, setPosition] = useState<TextPosition>("alto");
  const [topic, setTopic] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);
  const [busy, setBusy] = useState<"upload" | "render" | "hooks" | "save" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { w, h } = VIDEO_FORMATS[format];
  const total = clips.reduce((s, c) => s + (c.end - c.start), 0);

  useEffect(() => {
    if (overlayCanvas.current) drawOverlay(overlayCanvas.current, text, position, w, h);
  }, [text, position, w, h]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const duration = await new Promise<number>((resolve, reject) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => {
            resolve(v.duration);
            URL.revokeObjectURL(v.src);
          };
          v.onerror = () => reject(new Error(`"${file.name}" non sembra un video valido.`));
          v.src = URL.createObjectURL(file);
        });
        const form = new FormData();
        form.append("files", file);
        const res = await fetch("/api/media", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
        const d = round(duration);
        setClips((c) => [...c, { url: data.urls[0], name: file.name, duration: d, start: 0, end: d }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const updateClip = (i: number, patch: Partial<Clip>) =>
    setClips((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const moveClip = (i: number, delta: number) =>
    setClips((cs) => {
      const next = [...cs];
      const [item] = next.splice(i, 1);
      next.splice(i + delta, 0, item);
      return next;
    });

  async function suggestHooks() {
    setBusy("hooks");
    setError(null);
    try {
      setHooks((await api<Hooks>("/api/ai/video-text", { body: { topic } })).options);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function render() {
    setBusy("render");
    setError(null);
    setResult(null);
    try {
      let overlayUrl: string | null = null;
      if (text.trim() && overlayCanvas.current) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          overlayCanvas.current!.toBlob((b) => (b ? resolve(b) : reject(new Error("Testo non valido"))), "image/png"),
        );
        const form = new FormData();
        form.append("files", new File([blob], "testo.png", { type: "image/png" }));
        const res = await fetch("/api/media", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
        overlayUrl = data.urls[0];
      }
      const { url } = await api<{ url: string }>("/api/video", {
        body: {
          clips: clips.map(({ url, start, end }) => ({ url, start, end })),
          format,
          fit,
          mute,
          overlayUrl,
        },
      });
      setResult(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveAsPost() {
    if (!result) return;
    setBusy("save");
    const post: PostInput = {
      title: text.trim().split("\n")[0] || topic.trim() || "Nuovo video",
      type: format === "verticale" ? "reel" : "post",
      platforms: format === "verticale" ? ["instagram", "tiktok"] : ["instagram", "facebook"],
      captions: {},
      hashtags: [],
      scheduledAt: null,
      status: "bozza",
      imageIdea: "",
      media: [result],
      videoScript: "",
      notes: topic,
    };
    try {
      await api("/api/posts", { body: post });
      router.push("/calendario");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title="Video" subtitle="Taglia e unisci le clip, scegli il formato e aggiungi un testo in sovrimpressione." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">1. Clip</h2>
              <span className="text-sm text-stone-500">Totale: {round(total)} s</span>
            </div>
            {clips.map((clip, i) => (
              <div key={`${clip.url}-${i}`} className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 sm:flex-row">
                <video
                  src={`${clip.url}#t=${clip.start}`}
                  controls
                  playsInline
                  className="h-40 w-full rounded bg-black object-contain sm:w-48"
                  id={`clip-${i}`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="truncate text-sm font-medium">{clip.name}</div>
                  <div className="text-xs text-stone-500">Durata originale: {clip.duration} s</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Inizio (s)">
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        max={clip.end - 0.1}
                        className={inputClass}
                        value={clip.start}
                        onChange={(e) => updateClip(i, { start: Math.max(0, Number(e.target.value)) })}
                      />
                    </Field>
                    <Field label="Fine (s)">
                      <input
                        type="number"
                        step={0.1}
                        min={clip.start + 0.1}
                        max={clip.duration}
                        className={inputClass}
                        value={clip.end}
                        onChange={(e) => updateClip(i, { end: Math.min(clip.duration, Number(e.target.value)) })}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {(["start", "end"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50"
                        onClick={() => {
                          const v = document.getElementById(`clip-${i}`) as HTMLVideoElement | null;
                          if (v) updateClip(i, { [k]: round(v.currentTime) });
                        }}
                      >
                        {k === "start" ? "Inizia da qui ▶" : "Finisci qui ■"}
                      </button>
                    ))}
                    <span className="flex-1" />
                    <button type="button" disabled={i === 0} className="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-30" onClick={() => moveClip(i, -1)}>
                      ↑
                    </button>
                    <button type="button" disabled={i === clips.length - 1} className="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-30" onClick={() => moveClip(i, 1)}>
                      ↓
                    </button>
                    <button type="button" className="rounded px-2 py-1 text-red-700 hover:bg-red-50" onClick={() => setClips((cs) => cs.filter((_, j) => j !== i))}>
                      Rimuovi
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => upload(e.target.files)} />
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
              {busy === "upload" ? <><Spinner /> Carico…</> : "🎬 Aggiungi clip"}
            </Button>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">2. Formato</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Formato">
                <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as VideoFormat)}>
                  {Object.entries(VIDEO_FORMATS).map(([k, f]) => (
                    <option key={k} value={k}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Se la clip ha un formato diverso">
                <select className={inputClass} value={fit} onChange={(e) => setFit(e.target.value as FitMode)}>
                  <option value="sfocato">Mostra tutto, con sfondo sfocato</option>
                  <option value="riempi">Riempi lo schermo (taglia i bordi)</option>
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand-600" checked={mute} onChange={(e) => setMute(e.target.checked)} />
              Togli l&apos;audio originale (per aggiungere una musica di tendenza da Instagram o TikTok)
            </label>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">3. Testo sul video</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <Field label="Di cosa parla il video?">
                  <input className={inputClass} placeholder="Es. preparazione del gelato al pistacchio" value={topic} onChange={(e) => setTopic(e.target.value)} />
                </Field>
              </div>
              <Button variant="secondary" onClick={suggestHooks} disabled={busy !== null || topic.trim().length < 3}>
                {busy === "hooks" ? <><Spinner /> Penso…</> : "✨ Suggerisci testi"}
              </Button>
            </div>
            {hooks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hooks.map((hook) => (
                  <button key={hook} type="button" onClick={() => setText(hook)} className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm text-brand-700 hover:bg-brand-100">
                    {hook}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Testo" hint="Lascia vuoto per non mettere testo.">
                <textarea rows={2} className={inputClass} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
              <Field label="Posizione">
                <select className={inputClass} value={position} onChange={(e) => setPosition(e.target.value as TextPosition)}>
                  <option value="alto">In alto</option>
                  <option value="centro">Al centro</option>
                  <option value="basso">In basso</option>
                </select>
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-4">
            <h2 className="font-semibold">Anteprima</h2>
            <div className="relative mx-auto overflow-hidden rounded-lg bg-stone-900" style={{ aspectRatio: `${w} / ${h}`, maxHeight: 420 }}>
              {result ? (
                <video src={result} controls playsInline className="absolute inset-0 h-full w-full" />
              ) : (
                <>
                  {clips[0] && (
                    <video
                      src={`${clips[0].url}#t=${clips[0].start}`}
                      muted
                      playsInline
                      className={`absolute inset-0 h-full w-full ${fit === "riempi" ? "object-cover" : "object-contain"}`}
                    />
                  )}
                  <canvas ref={overlayCanvas} className="absolute inset-0 h-full w-full" />
                </>
              )}
            </div>
            {!result && (
              <Button className="w-full" onClick={render} disabled={busy !== null || clips.length === 0}>
                {busy === "render" ? <><Spinner /> Creo il video…</> : "🎬 Crea video"}
              </Button>
            )}
            {busy === "render" && <p className="text-xs text-stone-500">Può richiedere da qualche secondo a un paio di minuti.</p>}
            {result && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveAsPost} disabled={busy !== null}>
                  {busy === "save" && <Spinner />} Salva come contenuto
                </Button>
                <a href={result} download className="inline-flex items-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50">
                  Scarica
                </a>
                <Button variant="ghost" onClick={() => setResult(null)}>
                  Modifica ancora
                </Button>
              </div>
            )}
            <ErrorBox message={error} />
          </Card>
        </div>
      </div>
    </div>
  );
}
