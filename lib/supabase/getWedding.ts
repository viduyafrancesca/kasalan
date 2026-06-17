import { type SupabaseClient } from "@supabase/supabase-js";

// Returns the wedding for a user — checking owner first, then collaborator.
// Works with both browser and server Supabase clients.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWeddingForUser(supabase: SupabaseClient<any, any, any>, userId: string) {
  const { data: owned } = await supabase
    .from("weddings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (owned) return owned;

  const { data: collab } = await supabase
    .from("collaborators")
    .select("wedding_id")
    .eq("user_id", userId)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!collab) return null;

  const { data: wedding } = await supabase
    .from("weddings")
    .select("*")
    .eq("id", collab.wedding_id)
    .maybeSingle();

  return wedding ?? null;
}
