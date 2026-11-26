"use client";

import { useState } from "react";
import { Button, Card, ErrorBox, PageHeader, PlatformBadge, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { BestTimes } from "@/lib/ai";

export default function BestTimesPage() {
  const [data, setData] = useState<BestTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await api<BestTimes>("/api/ai/best-times", { body: {} }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Orari migliori"
        subtitle="Quando pubblicare su ogni social, in base alla tua attività e ai tuoi clienti."
        action={
          <Button onClick={load} disabled={loading}>
            {loading ? <><Spinner /> Analizzo…</> : data ? "Aggiorna" : "✨ Calcola orari"}
          </Button>
        }
      />
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Per ora i consigli si basano sul tipo di attività e sulle abitudini tipiche di ogni social. Quando collegheremo i tuoi account,
        useranno le visualizzazioni reali dei tuoi post.
      </div>
      <ErrorBox message={error} />
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.platforms.map((p) => (
            <Card key={p.platform}>
              <div className="mb-3">
                <PlatformBadge platform={p.platform} />
              </div>
              <div className="space-y-3">
                {p.slots.map((s, i) => (
                  <div key={i}>
                    <div className="text-sm font-semibold">
                      {s.days} · {s.times}
                    </div>
                    <p className="text-xs text-stone-500">{s.reason}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <Card className="md:col-span-3">
            <div className="mb-2 text-sm font-semibold">Consigli</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
              {data.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
