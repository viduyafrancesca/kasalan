"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "@/lib/db/schema";

interface TaskRowProps {
  item: ChecklistItem;
  onToggle?: (id: string, completed: boolean) => void;
}

export function TaskRow({ item, onToggle }: TaskRowProps) {
  const [completed, setCompleted] = useState(item.completed);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function toggle() {
    setLoading(true);
    const next = !completed;
    setCompleted(next);
    await supabase
      .from("checklist_items")
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", item.id);
    onToggle?.(item.id, next);
    setLoading(false);
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-border last:border-0", loading && "opacity-60")}>
      <button
        onClick={toggle}
        disabled={loading}
        className={cn(
          "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
          completed ? "bg-accent border-accent" : "border-terra-400"
        )}
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      >
        {completed && <span className="text-white text-[10px]">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", completed && "line-through text-muted-fg")}>{item.title}</p>
        {item.notes && <p className="text-xs text-muted-fg truncate">{item.notes}</p>}
      </div>
      <span className="text-[10px] text-muted-fg flex-shrink-0">{item.category}</span>
    </div>
  );
}
