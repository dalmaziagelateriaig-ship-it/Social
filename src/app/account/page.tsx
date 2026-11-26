"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { AccountsSummary } from "@/lib/types";

const OK_MESSAGES: Record<string, string> = {
  meta: "Facebook e Instagram collegati ✓",
  tiktok: "TikTok collegato ✓",
};

const connectClass =
  "inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700";

function AccountsView() {
  const params = useSearchParams();
  const [summary, setSummary] = useState<AccountsSummary | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [busy, setBusy] = useState(false);
  const ok = OK_MESSAGES[params.get("ok") ?? ""];

  useEffect(() => {
    api<AccountsSummary>("/api/accounts")
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, []);

  async function choosePage(selectedPageId: string) {
    setBusy(true);
    setError(null);
    try {
      setSummary(await api<AccountsSummary>("/api/accounts", { method: "PUT", body: { selectedPageId } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(platform: "meta" | "tiktok") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/accounts/${platform}`, { method: "DELETE" });
      setSummary(await api<AccountsSummary>("/api/accounts"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500">
        {error ? <ErrorBox message={error} /> : <><Spinner /> Carico…</>}
      </div>
    );
  }

  const { meta, tiktok } = summary;
  const selected = meta.pages.find((p) => p.id === meta.selectedPageId);

  return (
    <div className="space-y-6">
      {ok && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>}
      <ErrorBox message={error} />
      {!summary.publicUrl && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Per collegare gli account l&apos;app deve essere online con un indirizzo pubblico (su Render viene impostato da solo).
        </div>
      )}

      <Card>
        <div className="mb-1 font-semibold">Facebook e Instagram</div>
        <p className="mb-4 text-sm text-stone-500">
          Si collegano insieme: serve una Pagina Facebook con l&apos;account Instagram professionale collegato.
        </p>
        {!meta.configured ? (
          <p className="text-sm text-stone-500">Mancano le chiavi dell&apos;app Meta (META_APP_ID e META_APP_SECRET) nelle impostazioni del server.</p>
        ) : !meta.connected ? (
          <a href="/api/auth/meta/start" className={connectClass}>Collega Facebook e Instagram</a>
        ) : (
          <div className="space-y-4">
            {meta.pages.length === 0 ? (
              <p className="text-sm text-amber-800">Nessuna Pagina Facebook trovata su questo account.</p>
            ) : (
              <Field label="Pagina su cui pubblicare">
                <select
                  className={inputClass}
                  value={meta.selectedPageId ?? ""}
                  disabled={busy}
                  onChange={(e) => choosePage(e.target.value)}
                >
                  {!meta.selectedPageId && <option value="">Scegli…</option>}
                  {meta.pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.instagram ? ` · Instagram @${p.instagram}` : " · senza Instagram"}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {selected && !selected.instagram && (
              <p className="text-sm text-amber-800">
                Questa Pagina non ha un account Instagram professionale collegato: su Instagram non si potrà pubblicare.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <a href="/api/auth/meta/start" className={connectClass}>Ricollega</a>
              <Button variant="secondary" onClick={() => disconnect("meta")} disabled={busy}>Scollega</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-1 font-semibold">TikTok</div>
        <p className="mb-4 text-sm text-stone-500">
          Da qui si pubblicano su TikTok solo video. Finché TikTok non approva l&apos;app, i video escono come privati.
        </p>
        {!tiktok.configured ? (
          <p className="text-sm text-stone-500">Mancano le chiavi dell&apos;app TikTok (TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET) nelle impostazioni del server.</p>
        ) : !tiktok.connected ? (
          <a href="/api/auth/tiktok/start" className={connectClass}>Collega TikTok</a>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Collegato{tiktok.username ? ` come @${tiktok.username}` : ""}.
              {tiktok.expiresAt && (
                <span className="text-stone-500"> Da ricollegare entro il {new Date(tiktok.expiresAt).toLocaleDateString("it-IT")}.</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/auth/tiktok/start" className={connectClass}>Ricollega</a>
              <Button variant="secondary" onClick={() => disconnect("tiktok")} disabled={busy}>Scollega</Button>
            </div>
          </div>
        )}
      </Card>

      <p className="text-sm text-stone-500">
        I contenuti con stato &quot;Programmato&quot; vengono pubblicati da soli all&apos;ora indicata nel calendario.
      </p>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Account social" subtitle="Collega i tuoi profili per pubblicare in automatico." />
      <Suspense fallback={<Spinner />}>
        <AccountsView />
      </Suspense>
    </div>
  );
}
