"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { PostEditor } from "@/components/PostEditor";
import { Button, Card, ErrorBox, LinkButton, PageHeader, PlatformBadge, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Ideas } from "@/lib/ai";
import { dateKey, formatDateTime } from "@/lib/dates";
import { POST_STATUS_LABELS, POST_TYPE_LABELS, type Post, type Profile } from "@/lib/types";

function DashboardPageContent() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Post[]>("/api/posts"), api<Profile>("/api/profile")])
      .then(([p, prof]) => {
        if (cancelled) return;
        setPosts(p);
        setProfile(prof);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function loadIdeas() {
    setLoadingIdeas(true);
    setError(null);
    try {
      setIdeas(await api<Ideas>("/api/ai/ideas", { body: {} }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingIdeas(false);
    }
  }

  const now = new Date();
  const todayKey = dateKey(now);
  const weekEnd = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const upcoming = posts.filter((p) => p.scheduledAt && p.scheduledAt >= todayKey && p.scheduledAt < weekEnd);
  const drafts = posts.filter((p) => p.status === "bozza").length;
  const scheduled = posts.filter((p) => p.status === "programmato").length;
  const published = posts.filter((p) => p.status === "pubblicato").length;
  const profileEmpty = profile !== null && !profile.businessName && !profile.businessType;

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile?.businessName ? `Ciao, ${profile.businessName}` : "Panoramica"}
        subtitle="I tuoi social in un colpo d'occhio."
        action={<LinkButton href="/crea">✨ Crea contenuto</LinkButton>}
      />

      {profileEmpty && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Prima di iniziare, <Link href="/profilo" className="font-semibold underline">descrivi la tua attività</Link>: l&apos;AI la userà per scrivere con il tuo stile.
        </div>
      )}
      <ErrorBox message={error} />

      <div className="grid grid-cols-3 gap-4">
        {[
          ["Bozze", drafts],
          ["Programmati", scheduled],
          ["Pubblicati", published],
        ].map(([label, n]) => (
          <Card key={label}>
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-sm text-stone-500">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Prossimi 7 giorni</h2>
            <Link href="/calendario" className="text-sm text-brand-700 hover:underline">
              Apri calendario
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-stone-500">
              Niente in programma. <Link href="/piano" className="text-brand-700 underline">Genera il piano del mese</Link> o crea un contenuto.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {upcoming.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setEditing(p)} className="flex w-full items-start justify-between gap-3 py-2 text-left hover:bg-stone-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.title}</div>
                      <div className="text-xs text-stone-500">
                        {formatDateTime(p.scheduledAt)} · {POST_TYPE_LABELS[p.type]} · {POST_STATUS_LABELS[p.status]}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {p.platforms.map((pl) => (
                        <PlatformBadge key={pl} platform={pl} />
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Contenuti consigliati</h2>
            <Button variant="secondary" onClick={loadIdeas} disabled={loadingIdeas}>
              {loadingIdeas ? <><Spinner /> Cerco idee…</> : ideas ? "Altre idee" : "✨ Suggeriscimi"}
            </Button>
          </div>
          {!ideas && !loadingIdeas && (
            <p className="text-sm text-stone-500">L&apos;AI ti propone cosa pubblicare nelle prossime due settimane, in base alla stagione e a quello che hai già in programma.</p>
          )}
          {ideas && (
            <ul className="space-y-3">
              {ideas.ideas.map((idea, i) => (
                <li key={i} className="rounded-lg border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    {POST_TYPE_LABELS[idea.type]}
                    {idea.platforms.map((p) => (
                      <PlatformBadge key={p} platform={p} />
                    ))}
                  </div>
                  <div className="mt-1 text-sm font-medium">{idea.title}</div>
                  <p className="mt-0.5 text-sm text-stone-600">{idea.idea}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-stone-500">💡 {idea.why}</p>
                    <Link
                      className="shrink-0 text-sm font-medium text-brand-700 hover:underline"
                      href={`/crea?${new URLSearchParams({ idea: `${idea.title}. ${idea.idea}`, type: idea.type, platforms: idea.platforms.join(",") })}`}
                    >
                      Crea →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">Report e statistiche</h2>
        <p className="text-sm text-stone-500">
          Visualizzazioni, follower e analisi della nicchia arriveranno quando collegheremo gli account Instagram, Facebook e TikTok.
        </p>
      </Card>

      {editing && (
        <PostEditor
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

// Dates depend on the visitor's clock, so this page renders at request time.
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-stone-500">Caricamento…</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
