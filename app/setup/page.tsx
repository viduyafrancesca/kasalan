"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { filterTemplates, groupByTimeline, type SetupAnswers } from "@/lib/checklist/generateChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

const CEREMONY_TYPES = [
  { value: "catholic",   label: "Catholic Church",        desc: "Traditional church ceremony with full sacraments" },
  { value: "civil",      label: "Civil / Courthouse",     desc: "Legal ceremony before a civil registrar" },
  { value: "christian",  label: "Christian / Non-denom",  desc: "Church or chapel, non-Catholic denomination" },
  { value: "garden",     label: "Garden / Outdoor",       desc: "Open-air venue ceremony" },
  { value: "beach",      label: "Beach",                  desc: "Seaside ceremony" },
] as const;

export default function SetupPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  const [coupleName1, setCoupleName1] = useState("");
  const [coupleName2, setCoupleName2] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [setup, setSetup] = useState<SetupAnswers>({
    ceremonyType: "catholic",
    hasCoordinator: false,
    hasCotillion: false,
    hasCivilRegistration: true,
    hasSecondarySponsors: true,
  });

  const preview = filterTemplates(setup);
  const grouped = groupByTimeline(preview, weddingDate || null);

  async function handleFinish() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: wedding, error: wErr } = await supabase
      .from("weddings")
      .insert({ owner_id: user.id, couple_name_1: coupleName1, couple_name_2: coupleName2, wedding_date: weddingDate || null })
      .select("id")
      .single();

    if (wErr || !wedding) { setSaving(false); return; }

    await supabase.from("wedding_setup").insert({
      wedding_id: wedding.id,
      ceremony_type: setup.ceremonyType,
      has_coordinator: setup.hasCoordinator,
      has_cotillion: setup.hasCotillion,
      has_civil_registration: setup.hasCivilRegistration,
      has_secondary_sponsors: setup.hasSecondarySponsors,
    });

    await supabase.from("wedding_sides").insert([
      { wedding_id: wedding.id, kind: "partner1_family", sort_order: 0 },
      { wedding_id: wedding.id, kind: "partner1_friend", sort_order: 1 },
      { wedding_id: wedding.id, kind: "partner2_family", sort_order: 2 },
      { wedding_id: wedding.id, kind: "partner2_friend", sort_order: 3 },
      { wedding_id: wedding.id, kind: "mutual_friend",   sort_order: 4 },
    ]);

    const items = preview.map((t) => ({
      wedding_id: wedding.id,
      title: t.title,
      category: t.category,
      months_before: t.monthsBefore,
      is_custom: false,
    }));
    await supabase.from("checklist_items").insert(items);

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-6 py-12 bg-background">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl text-foreground">Let&apos;s plan your wedding</h1>
          <p className="text-muted-fg text-sm mt-1">Step {step} of 5</p>
        </div>

        <div className="flex gap-1.5">
          {[1,2,3,4,5].map((s) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", s <= step ? "bg-accent" : "bg-terra-200")} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl">Who&apos;s getting married?</h2>
            <div className="space-y-1.5">
              <Label>Partner 1 name</Label>
              <Input placeholder="e.g. Maria" value={coupleName1} onChange={(e) => setCoupleName1(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Partner 2 name</Label>
              <Input placeholder="e.g. Juan" value={coupleName2} onChange={(e) => setCoupleName2(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Wedding date (optional — set later if unsure)</Label>
              <Input type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!coupleName1 || !coupleName2} onClick={() => setStep(2)}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl">What type of ceremony?</h2>
            <div className="space-y-2">
              {CEREMONY_TYPES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSetup((s) => ({ ...s, ceremonyType: c.value }))}
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-colors",
                    setup.ceremonyType === c.value
                      ? "border-accent bg-terra-100"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div className="font-medium text-sm">{c.label}</div>
                  <div className="text-xs text-muted-fg mt-0.5">{c.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl">A few more details</h2>
            <div className="space-y-3">
              {[
                { key: "hasCoordinator",       label: "We're hiring a wedding coordinator",    desc: "Tasks will be assigned to your coordinator" },
                { key: "hasCotillion",          label: "We're having a cotillion de honor",     desc: "18 roses / 18 candles — adds rehearsal tasks" },
                { key: "hasCivilRegistration",  label: "We need civil registration tasks",      desc: "LCR requirements, PSA documents, marriage license" },
                { key: "hasSecondarySponsors",  label: "We'll have secondary sponsors",         desc: "Cord, veil, arrhae, candle bearers" },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setSetup((s) => ({ ...s, [key]: !s[key as keyof SetupAnswers] }))}
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-colors flex items-start gap-3",
                    setup[key as keyof SetupAnswers]
                      ? "border-accent bg-terra-100"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div className={cn("mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center",
                    setup[key as keyof SetupAnswers] ? "border-accent bg-accent" : "border-border"
                  )}>
                    {setup[key as keyof SetupAnswers] && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-fg mt-0.5">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(4)}>Preview checklist</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl">Your personalised checklist</h2>
              <p className="text-sm text-muted-fg mt-1">{preview.length} tasks across {grouped.length} milestone groups. You can remove any task after setup.</p>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {grouped.map((group) => {
                const isOverdue = group.label.startsWith("Overdue");
                return (
                  <div key={group.label}>
                    <p className={cn("text-xs uppercase tracking-widest font-medium mb-2", isOverdue ? "text-red-600" : "text-accent")}>
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item, i) => (
                        <div key={i} className={cn("flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg border", isOverdue ? "bg-red-50 border-red-200" : "bg-card border-border")}>
                          <span className="text-muted-fg">○</span>
                          <span>{item.title}</span>
                          {item.isOptional && <span className="ml-auto text-xs text-muted-fg">optional</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(5)}>Looks good!</Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 text-center">
            <div className="text-6xl">💍</div>
            <div>
              <h2 className="font-display text-2xl">You&apos;re all set!</h2>
              <p className="text-muted-fg text-sm mt-1">Your personalised wedding checklist is ready. Time to start planning!</p>
            </div>
            <Button className="w-full" size="lg" disabled={saving} onClick={handleFinish}>
              {saving ? "Setting up..." : "Start planning →"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
