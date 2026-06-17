import { TaskRow } from "./TaskRow";
import type { ChecklistItem } from "@/lib/db/schema";

interface ChecklistGroupProps {
  label: string;
  items: ChecklistItem[];
}

export function ChecklistGroup({ label, items }: ChecklistGroupProps) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.completed).length;
  const isOverdue = label.startsWith("Overdue");
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between px-4 mb-2">
        <h2 className={`text-xs uppercase tracking-widest font-semibold ${isOverdue ? "text-red-600" : "text-accent"}`}>{label}</h2>
        <span className="text-xs text-muted-fg">{done}/{items.length}</span>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {items.map((item) => (
          <TaskRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
