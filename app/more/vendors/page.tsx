import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/shared/BottomNav";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils";
import Link from "next/link";

const STATUS_VARIANT: Record<string, "default" | "success" | "secondary" | "destructive"> = {
  interested:  "secondary",
  shortlisted: "default",
  booked:      "success",
  declined:    "destructive",
};

const CATEGORY_LABELS: Record<string, string> = {
  venue:         "Venue",
  catering:      "Catering",
  photography:   "Photography",
  videography:   "Videography",
  flowers:       "Flowers",
  hair_makeup:   "Hair & Makeup",
  styling:       "Styling",
  sounds_lights: "Sounds & Lights",
  cake:          "Cake",
  transportation:"Transportation",
  other:         "Other",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id")
    .or(`owner_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!wedding) redirect("/setup");

  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .eq("wedding_id", wedding.id)
    .order("created_at", { ascending: true });

  const allVendors = vendors ?? [];
  const booked = allVendors.filter((v) => v.status === "booked").length;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    label: CATEGORY_LABELS[cat],
    items: allVendors.filter((v) => v.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <div className="flex-1 pb-20">
        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Vendors</h1>
            <p className="text-xs text-muted-fg">{booked} booked · {allVendors.length} total</p>
          </div>
        </div>

        <div className="px-4 py-4">
          {grouped.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">No vendors yet. Start adding vendors you&apos;re considering.</p>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-6">
                <h2 className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">{group.label}</h2>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  {group.items.map((vendor) => (
                    <div key={vendor.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{vendor.name}</p>
                        {vendor.contact && <p className="text-xs text-muted-fg">{vendor.contact}</p>}
                        {(vendor.price_range_min || vendor.price_range_max) && (
                          <p className="text-xs text-muted-fg">
                            {vendor.price_range_min ? formatPHP(Number(vendor.price_range_min)) : ""}
                            {vendor.price_range_min && vendor.price_range_max ? " – " : ""}
                            {vendor.price_range_max ? formatPHP(Number(vendor.price_range_max)) : ""}
                          </p>
                        )}
                      </div>
                      <Badge variant={STATUS_VARIANT[vendor.status] ?? "secondary"}>
                        {vendor.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
