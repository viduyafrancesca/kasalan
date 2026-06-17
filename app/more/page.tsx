import Link from "next/link";
import { BottomNav } from "@/components/shared/BottomNav";
import { Heart, MapPin, Share2, Users } from "lucide-react";

const SECTIONS = [
  { href: "/more/sponsors", label: "Sponsors",      desc: "Ninong, ninang & secondary sponsors",       Icon: Heart },
  { href: "/more/vendors",  label: "Vendor Shortlist", desc: "Venues, caterers, photographers & more",  Icon: MapPin },
  { href: "/more/share",    label: "Share",          desc: "Invite partner or share with family",       Icon: Share2 },
];

export default function MorePage() {
  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">
        <div className="bg-background px-4 py-5 border-b border-border">
          <h1 className="font-display text-2xl">More</h1>
        </div>
        <div className="px-4 py-4 space-y-3">
          {SECTIONS.map(({ href, label, desc, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 bg-card rounded-xl border border-border px-4 py-4 hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-terra-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-fg">{desc}</p>
              </div>
              <span className="ml-auto text-muted-fg">›</span>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
