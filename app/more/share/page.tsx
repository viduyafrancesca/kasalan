"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/shared/BottomNav";
import Link from "next/link";

export default function SharePage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);

  const [partnerInviteUrl, setPartnerInviteUrl] = useState<string | null>(null);
  const [generatingPartner, setGeneratingPartner] = useState(false);
  const [partnerCopied, setPartnerCopied] = useState(false);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (w) setWeddingId(w.id);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generatePartnerInvite() {
    if (!weddingId) return;
    setGeneratingPartner(true);
    const { data } = await supabase
      .from("partner_invites")
      .insert({ wedding_id: weddingId })
      .select("token")
      .single();
    if (data) setPartnerInviteUrl(`${location.origin}/invite/${data.token}`);
    setGeneratingPartner(false);
  }

  async function copyPartnerInvite() {
    if (!partnerInviteUrl) return;
    await navigator.clipboard.writeText(partnerInviteUrl);
    setPartnerCopied(true);
    setTimeout(() => setPartnerCopied(false), 2000);
  }

  async function generateShareLink() {
    if (!weddingId) return;
    setGeneratingShare(true);
    const { data } = await supabase
      .from("share_tokens")
      .insert({ wedding_id: weddingId })
      .select("token")
      .single();
    if (data) setShareUrl(`${location.origin}/share/${data.token}`);
    setGeneratingShare(false);
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">
        <div className="bg-background px-4 py-5 border-b border-border flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <h1 className="font-display text-2xl">Share</h1>
        </div>

        <div className="px-4 py-6 space-y-8">

          {/* Partner invite */}
          <div className="space-y-3">
            <h2 className="font-display text-lg">Invite your partner</h2>
            <p className="text-sm text-muted-fg">
              Generate a link and send it to your partner — they&apos;ll sign in and get full edit access to your wedding plan.
            </p>
            {partnerInviteUrl ? (
              <div className="space-y-2">
                <div className="bg-card rounded-lg border border-border px-3 py-2 text-sm break-all text-muted-fg">
                  {partnerInviteUrl}
                </div>
                <Button className="w-full" onClick={copyPartnerInvite}>
                  {partnerCopied ? "Copied!" : "Copy invite link"}
                </Button>
                <button
                  onClick={() => setPartnerInviteUrl(null)}
                  className="w-full text-xs text-muted-fg hover:text-foreground transition-colors"
                >
                  Generate a new link
                </button>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={generatePartnerInvite}
                disabled={generatingPartner || !weddingId}
              >
                {generatingPartner ? "Generating..." : "Generate partner invite link"}
              </Button>
            )}
          </div>

          {/* Family view-only link */}
          <div className="space-y-3">
            <h2 className="font-display text-lg">Family view-only link</h2>
            <p className="text-sm text-muted-fg">
              Share a read-only link with family and friends so they can follow along.
            </p>
            {shareUrl ? (
              <div className="space-y-2">
                <div className="bg-card rounded-lg border border-border px-3 py-2 text-sm break-all text-muted-fg">
                  {shareUrl}
                </div>
                <Button variant="outline" className="w-full" onClick={copyShareLink}>
                  {shareCopied ? "Copied!" : "Copy link"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={generateShareLink}
                disabled={generatingShare || !weddingId}
              >
                {generatingShare ? "Generating..." : "Generate share link"}
              </Button>
            )}
          </div>

        </div>
      </div>
      <BottomNav />
    </div>
  );
}
