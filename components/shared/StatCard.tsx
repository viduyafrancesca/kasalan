import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string | number;
  label: string;
  className?: string;
}

export function StatCard({ value, label, className }: StatCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-4 text-center", className)}>
      <div className="font-display text-2xl font-semibold text-accent">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-fg mt-0.5">{label}</div>
    </div>
  );
}
