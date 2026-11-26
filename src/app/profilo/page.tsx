"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";

const FIELDS: { key: keyof Profile; label: string; placeholder: string; rows?: number }[] = [
  { key: "businessName", label: "Nome dell'attività", placeholder: "Es. Gelateria Dalmazia" },
  { key: "businessType", label: "Tipo di attività", placeholder: "Es. Gelateria artigianale" },
  { key: "city", label: "Città o zona", placeholder: "Es. Trieste, zona centro" },
  { key: "description", label: "Descrizione", placeholder: "Cosa vi rende speciali, la vostra storia…", rows: 3 },
  { key: "products", label: "Prodotti e servizi principali", placeholder: "Es. gelato artigianale, semifreddi, torte gelato, caffetteria", rows: 3 },
  { key: "audience", label: "I vostri clienti", placeholder: "Es. famiglie, studenti, turisti in estate", rows: 2 },
  { key: "tone", label: "Tono di voce", placeholder: "Es. allegro e familiare, con qualche emoji, mai troppo formale", rows: 2 },
  { key: "hashtags", label: "Hashtag che usate sempre", placeholder: "Es. #gelatoartigianale #trieste" },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>("/api/profile")
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      setProfile(await api<Profile>("/api/profile", { method: "PUT", body: profile }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="La mia attività" subtitle="L'AI usa queste informazioni per scrivere contenuti con il vostro stile." />
      <Card className="space-y-4">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.rows ? (
              <textarea
                rows={f.rows}
                className={inputClass}
                placeholder={f.placeholder}
                value={profile[f.key]}
                disabled={!loaded}
                onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })}
              />
            ) : (
              <input
                className={inputClass}
                placeholder={f.placeholder}
                value={profile[f.key]}
                disabled={!loaded}
                onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
        <ErrorBox message={error} />
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-700">Salvato ✓</span>}
          <Button onClick={save} disabled={saving || !loaded}>
            {saving && <Spinner />} Salva
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="mb-1 text-sm font-semibold">Account social</div>
        <p className="mb-3 text-sm text-stone-500">
          Il collegamento con Instagram, Facebook e TikTok per pubblicare in automatico e leggere le statistiche arriverà nella prossima fase.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Instagram", "Facebook", "TikTok"].map((s) => (
            <span key={s} className="rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-400">
              {s} · da collegare
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
