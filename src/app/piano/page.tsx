"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorBox, Field, PageHeader, PlatformBadge, PlatformPicker, Spinner, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { Plan } from "@/lib/ai";
import { monthKey } from "@/lib/dates";
import { POST_TYPE_LABELS, type Platform, type PostInput } from "@/lib/types";

function PlanPageContent() {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  });
  const [postsPerWeek, setPostsPerWeek] = useState(4);
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "facebook", "tiktok"]);
  const [goals, setGoals] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Plan>("/api/ai/plan", { body: { month, postsPerWeek, platforms, goals } });
      setPlan(result);
      setSelected(new Set(result.items.map((_, i) => i)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    setError(null);
    const posts: PostInput[] = plan.items
      .filter((_, i) => selected.has(i))
      .map((item) => ({
        title: item.title,
        type: item.type,
        platforms: item.platforms,
        captions: {},
        hashtags: [],
        scheduledAt: `${item.date}T${item.time}`,
        status: "bozza",
        imageIdea: "",
        media: [],
        videoScript: "",
        notes: `${item.idea}\n\nPerché: ${item.reason}`,
      }));
    try {
      await api("/api/posts", { body: posts });
      router.push("/calendario");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <PageHeader title="Piano del mese" subtitle="L'AI prepara il calendario editoriale del mese: tu scegli cosa tenere." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mese">
              <input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field label="Contenuti a settimana">
              <input
                type="number"
                min={1}
                max={21}
                className={inputClass}
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Social">
            <PlatformPicker value={platforms} onChange={setPlatforms} />
          </Field>
          <Field label="Obiettivi e novità del mese (facoltativo)" hint="Es. lancio gusti invernali, promo cioccolata calda, chiusura per ferie dal 10 al 15.">
            <textarea rows={4} className={inputClass} value={goals} onChange={(e) => setGoals(e.target.value)} />
          </Field>
          <Button onClick={generate} disabled={loading || platforms.length === 0} className="w-full">
            {loading ? (
              <>
                <Spinner /> Sto preparando il piano…
              </>
            ) : (
              "✨ Genera piano"
            )}
          </Button>
          <ErrorBox message={error} />
        </Card>

        <div className="space-y-4">
          {loading && (
            <Card className="flex items-center gap-3 text-sm text-stone-500">
              <Spinner /> Un piano completo richiede di solito 30-60 secondi.
            </Card>
          )}
          {plan && !loading && (
            <>
              <Card>
                <div className="mb-1 text-sm font-semibold">Strategia</div>
                <p className="text-sm text-stone-700">{plan.strategy}</p>
              </Card>
              <div className="space-y-2">
                {plan.items.map((item, i) => (
                  <label
                    key={i}
                    className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-4 ${selected.has(i) ? "border-brand-500" : "border-stone-200 opacity-60"}`}
                  >
                    <input type="checkbox" className="mt-1 accent-brand-600" checked={selected.has(i)} onChange={() => toggle(i)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="font-medium capitalize text-stone-700">
                          {new Date(`${item.date}T${item.time}`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}{" "}
                          · {item.time}
                        </span>
                        <span>{POST_TYPE_LABELS[item.type]}</span>
                        {item.platforms.map((p) => (
                          <PlatformBadge key={p} platform={p} />
                        ))}
                      </div>
                      <div className="mt-1 font-medium">{item.title}</div>
                      <p className="mt-1 text-sm text-stone-600">{item.idea}</p>
                      <p className="mt-1 text-xs text-stone-500">💡 {item.reason}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="sticky bottom-4 flex justify-end">
                <Button onClick={save} disabled={saving || selected.size === 0} className="shadow-lg">
                  {saving && <Spinner />} Aggiungi {selected.size} contenuti al calendario
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Dates depend on the visitor's clock, so this page renders at request time.
export default function PlanPage() {
  return (
    <Suspense fallback={<div className="text-sm text-stone-500">Caricamento…</div>}>
      <PlanPageContent />
    </Suspense>
  );
}
