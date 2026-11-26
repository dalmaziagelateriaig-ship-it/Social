"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { PostEditor, emptyPost } from "@/components/PostEditor";
import { Button, ErrorBox, PageHeader, PlatformBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateKey, formatTime, monthGrid } from "@/lib/dates";
import type { Post, PostInput } from "@/lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const STATUS_STYLES: Record<Post["status"], string> = {
  bozza: "border-l-stone-400 bg-stone-50",
  programmato: "border-l-brand-500 bg-brand-50",
  in_pubblicazione: "border-l-amber-500 bg-amber-50",
  pubblicato: "border-l-emerald-500 bg-emerald-50",
  errore: "border-l-red-500 bg-red-50",
};

function CalendarPageContent() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [unscheduled, setUnscheduled] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | PostInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Post[]>(`/api/posts?from=${dateKey(days[0])}&to=${dateKey(days[41])}`),
      api<Post[]>("/api/posts"),
    ])
      .then(([inRange, all]) => {
        if (cancelled) return;
        setPosts(inRange);
        setUnscheduled(all.filter((p) => !p.scheduledAt));
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [days, version]);

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const key = p.scheduledAt!.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts]);

  const todayKey = dateKey(new Date());
  const shift = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div>
      <PageHeader
        title="Calendario"
        subtitle="Clicca su un giorno per aggiungere un contenuto, su un contenuto per modificarlo."
        action={<Button onClick={() => setEditing(emptyPost())}>+ Nuovo contenuto</Button>}
      />
      <ErrorBox message={error} />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" onClick={() => shift(-1)} aria-label="Mese precedente">
          ‹
        </Button>
        <Button variant="secondary" onClick={() => shift(1)} aria-label="Mese successivo">
          ›
        </Button>
        <h2 className="ml-2 text-lg font-medium capitalize">
          {cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
        </h2>
        <Button variant="ghost" className="ml-auto" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Oggi
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-xl border border-stone-200 bg-stone-200 gap-px">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-stone-50 px-2 py-2 text-center text-xs font-medium text-stone-500">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = dateKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const items = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                onClick={() => setEditing(emptyPost(`${key}T18:00`))}
                className={`min-h-28 cursor-pointer bg-white p-1.5 hover:bg-stone-50 ${inMonth ? "" : "opacity-40"}`}
              >
                <div
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    key === todayKey ? "bg-brand-600 font-semibold text-white" : "text-stone-500"
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                      }}
                      className={`block w-full rounded border-l-4 px-1.5 py-1 text-left text-xs ${STATUS_STYLES[p.status]}`}
                    >
                      <span className="font-medium">{formatTime(p.scheduledAt!)}</span> {p.title}
                      <span className="mt-0.5 flex flex-wrap gap-0.5">
                        {p.platforms.map((pl) => (
                          <PlatformBadge key={pl} platform={pl} />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-stone-400" />Bozza</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-500" />Programmato</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Pubblicato</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Errore</span>
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-2 text-sm font-medium text-stone-700">Bozze senza data</h3>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((p) => (
              <button key={p.id} onClick={() => setEditing(p)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:bg-stone-50">
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <PostEditor
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

// Dates depend on the visitor's clock, so this page renders at request time.
export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="text-sm text-stone-500">Caricamento…</div>}>
      <CalendarPageContent />
    </Suspense>
  );
}
