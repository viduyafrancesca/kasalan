"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";

type CeremonyType = "catholic" | "civil" | "christian" | "garden" | "beach";

const CEREMONY_TYPE_OPTIONS: { value: CeremonyType; label: string }[] = [
  { value: "catholic",  label: "Catholic Church" },
  { value: "civil",     label: "Civil / Courthouse" },
  { value: "christian", label: "Christian / Non-denom" },
  { value: "garden",    label: "Garden / Outdoor" },
  { value: "beach",     label: "Beach" },
];

const EMPTY_FORM = {
  coupleName1: "",
  coupleName2: "",
  weddingDate: "",
  ceremonyVenue: "",
  receptionVenue: "",
  ceremonyType: "catholic" as CeremonyType,
  hasCoordinator: false,
  hasCotillion: false,
  hasCivilRegistration: true,
  hasSecondarySponsors: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [hasSetupRow, setHasSetupRow] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);

    const { data: setupRow } = await supabase
      .from("wedding_setup")
      .select("*")
      .eq("wedding_id", w.id)
      .maybeSingle();

    setHasSetupRow(!!setupRow);
    setForm({
      coupleName1: w.couple_name_1 ?? "",
      coupleName2: w.couple_name_2 ?? "",
      weddingDate: w.wedding_date ?? "",
      ceremonyVenue: w.ceremony_venue ?? "",
      receptionVenue: w.reception_venue ?? "",
      ceremonyType: (setupRow?.ceremony_type ?? "catholic") as CeremonyType,
      hasCoordinator: setupRow?.has_coordinator ?? false,
      hasCotillion: setupRow?.has_cotillion ?? false,
      hasCivilRegistration: setupRow?.has_civil_registration ?? true,
      hasSecondarySponsors: setupRow?.has_secondary_sponsors ?? true,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!weddingId) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const { error: weddingError } = await supabase
      .from("weddings")
      .update({
        couple_name_1: form.coupleName1.trim(),
        couple_name_2: form.coupleName2.trim(),
        wedding_date: form.weddingDate || null,
        ceremony_venue: form.ceremonyVenue || null,
        reception_venue: form.receptionVenue || null,
      })
      .eq("id", weddingId);

    if (weddingError) {
      setSaveError(weddingError.message);
      setSaving(false);
      return;
    }

    const setupPayload = {
      wedding_id: weddingId,
      ceremony_type: form.ceremonyType,
      has_coordinator: form.hasCoordinator,
      has_cotillion: form.hasCotillion,
      has_civil_registration: form.hasCivilRegistration,
      has_secondary_sponsors: form.hasSecondarySponsors,
    };

    const { error: setupError } = hasSetupRow
      ? await supabase.from("wedding_setup").update(setupPayload).eq("wedding_id", weddingId)
      : await supabase.from("wedding_setup").insert(setupPayload);

    if (setupError) {
      setSaveError(setupError.message);
      setSaving(false);
      return;
    }

    setHasSetupRow(true);
    setSaving(false);
    setSaved(true);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
        <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">
        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <h1 className="font-display text-2xl">Settings</h1>
        </div>

        <div className="px-4 py-6 space-y-8">

          <div className="space-y-3">
            <h2 className="font-display text-lg">Couple & Date</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Partner 1 name</Label>
                <Input value={form.coupleName1} onChange={(e) => setForm((f) => ({ ...f, coupleName1: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Partner 2 name</Label>
                <Input value={form.coupleName2} onChange={(e) => setForm((f) => ({ ...f, coupleName2: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Wedding date</Label>
              <Input type="date" value={form.weddingDate} onChange={(e) => setForm((f) => ({ ...f, weddingDate: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg">Venues</h2>
            <div className="space-y-1.5">
              <Label>Ceremony venue</Label>
              <Input placeholder="e.g. San Agustin Church" value={form.ceremonyVenue} onChange={(e) => setForm((f) => ({ ...f, ceremonyVenue: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reception venue</Label>
              <Input placeholder="e.g. Manila Hotel" value={form.receptionVenue} onChange={(e) => setForm((f) => ({ ...f, receptionVenue: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg">Ceremony details</h2>
            <p className="text-xs text-muted-fg">
              Changing these won&apos;t regenerate your checklist — it only updates what&apos;s saved here.
            </p>
            <div className="space-y-1.5">
              <Label>Ceremony type</Label>
              <div className="grid grid-cols-2 gap-2">
                {CEREMONY_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm((f) => ({ ...f, ceremonyType: opt.value }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      form.ceremonyType === opt.value
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[
                { key: "hasCoordinator" as const,      label: "We're hiring a wedding coordinator" },
                { key: "hasCotillion" as const,         label: "We're having a cotillion de honor" },
                { key: "hasCivilRegistration" as const, label: "We need civil registration tasks" },
                { key: "hasSecondarySponsors" as const, label: "We'll have secondary sponsors" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    form[key] ? "border-accent bg-terra-100" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0", form[key] ? "border-accent bg-accent" : "border-border")}>
                    {form[key] && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <Button className="w-full" disabled={saving} onClick={save}>
            {saving ? "Saving..." : saved ? "Saved!" : "Save changes"}
          </Button>

          <div className="space-y-3 pt-4 border-t border-border">
            <h2 className="font-display text-lg">Account</h2>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>

        </div>
      </div>
      <BottomNav />
    </div>
  );
}
