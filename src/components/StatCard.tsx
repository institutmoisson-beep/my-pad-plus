import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "navy",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "navy" | "sky" | "emerald" | "plain";
  hint?: string;
}) {
  const toneClass =
    tone === "navy"
      ? "bg-gradient-royal text-primary-foreground"
      : tone === "sky"
        ? "bg-gradient-sky text-secondary-foreground"
        : tone === "emerald"
          ? "bg-gradient-emerald text-success-foreground"
          : "bg-card text-card-foreground";

  return (
    <div className={cn("rounded-3xl p-4 shadow-soft", toneClass)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <Icon className="size-4 opacity-80" />
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-75">{hint}</p>}
    </div>
  );
}