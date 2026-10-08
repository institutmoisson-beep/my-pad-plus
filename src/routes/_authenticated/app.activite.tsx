import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, CalendarDays, Eye, Loader2, MousePointerClick, Radio, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { useRoles } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/activite")({
  head: () => ({
    meta: [
      { title: "Activité en direct — Imo MSN" },
      { name: "description", content: "Tableau de bord administrateur : utilisateurs connectés, pages et actions." },
      { property: "og:title", content: "Activité en direct — Imo MSN" },
      { property: "og:description", content: "Suivi en temps réel de l'utilisation d'Imo MSN." },
    ],
  }),
  component: ActivityPage,
});

const PAGE_NAMES: Record<string, string> = {
  "/app": "Accueil",
  "/app/loyer": "Loyer",
  "/app/portefeuille": "Portefeuille",
  "/app/biens": "Mes Biens",
  "/app/chat": "Chat",
  "/app/profil": "Profil",
  "/app/admin": "Administration",
  "/app/activite": "Activité",
  "/app/lier": "Lier un bien",
  "/app/conditions": "Conditions",
};
const pageName = (p: string) => PAGE_NAMES[p] ?? p;

type Stats = {
  online: number;
  today: number;
  month: number;
  total_users: number;
  events: number;
  daily: { day: string; users: number; views: number }[];
  monthly: { month: string; users: number; views: number }[];
  top_pages: { path: string; views: number; users: number }[];
  top_actions: { label: string; count: number }[];
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

async function names(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || "Sans nom"]));
}

function ActivityPage() {
  const { data: roles = [], isLoading } = useRoles();
  const [days, setDays] = useState(30);
  const queryClient = useQueryClient();
  const isAdmin = roles.includes("admin");

  const stats = useQuery({
    queryKey: ["admin-analytics", days],
    enabled: isAdmin,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_analytics", { _days: days });
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  const presence = useQuery({
    queryKey: ["admin-presence"],
    enabled: isAdmin,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_presence")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(100);
      if (error) throw error;
      const map = await names((data ?? []).map((r) => r.user_id));
      return (data ?? []).map((r) => ({ ...r, name: map.get(r.user_id) ?? "Utilisateur" }));
    },
  });

  const feed = useQuery({
    queryKey: ["admin-feed"],
    enabled: isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const map = await names(Array.from(new Set((data ?? []).map((r) => r.user_id))));
      return (data ?? []).map((r) => ({ ...r, name: map.get(r.user_id) ?? "Utilisateur" }));
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-presence"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-feed"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [isAdmin, queryClient]);

  if (isLoading) {
    return (
      <AppShell title="Activité">
        <Loader2 className="mx-auto mt-10 size-5 animate-spin text-secondary" />
      </AppShell>
    );
  }
  if (!isAdmin) {
    return (
      <AppShell title="Activité">
        <p className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Accès réservé aux administrateurs.
        </p>
      </AppShell>
    );
  }

  const s = stats.data;
  const online = (presence.data ?? []).filter((p) => Date.now() - new Date(p.last_seen).getTime() < 120000);
  const maxDaily = Math.max(1, ...(s?.daily ?? []).map((d) => d.users));
  const maxPage = Math.max(1, ...(s?.top_pages ?? []).map((p) => p.views));
  const maxMonth = Math.max(1, ...(s?.monthly ?? []).map((m) => m.users));

  return (
    <AppShell title="Activité en direct" subtitle="Connexions, pages et actions des utilisateurs">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="En ligne" value={String(s?.online ?? online.length)} icon={Radio} tone="emerald" hint="2 dernières minutes" />
          <StatCard label="Aujourd'hui" value={String(s?.today ?? 0)} icon={Users} tone="navy" hint="utilisateurs actifs" />
          <StatCard label="Ce mois" value={String(s?.month ?? 0)} icon={CalendarDays} tone="sky" hint="utilisateurs actifs" />
          <StatCard label="Inscrits" value={String(s?.total_users ?? 0)} icon={Activity} tone="plain" hint={`${s?.events ?? 0} actions / ${days} j`} />
        </div>

        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-semibold",
                days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {d} jours
            </button>
          ))}
        </div>

        <Section title="Connectés maintenant" icon={Radio}>
          {online.length === 0 && <Empty text="Personne en ligne pour le moment." />}
          {online.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {pageName(p.current_path ?? "")} {p.device ? `· ${p.device}` : ""}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{timeAgo(p.last_seen)}</span>
            </div>
          ))}
        </Section>

        <Section title="Utilisateurs actifs par jour" icon={CalendarDays}>
          <div className="flex h-36 items-end gap-1 rounded-2xl bg-card p-3 shadow-soft">
            {(s?.daily ?? []).length === 0 && <Empty text="Pas encore de données." />}
            {(s?.daily ?? []).map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100">{d.users}</span>
                <div className="w-full rounded-t-md bg-gradient-sky" style={{ height: `${(d.users / maxDaily) * 100}%`, minHeight: 3 }} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Par mois" icon={CalendarDays}>
          {(s?.monthly ?? []).map((m) => (
            <Bar
              key={m.month}
              label={new Date(`${m.month}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              value={m.users}
              max={maxMonth}
              suffix={`${m.users} utilisateurs · ${m.views} vues`}
            />
          ))}
        </Section>

        <Section title="Pages les plus consultées" icon={Eye}>
          {(s?.top_pages ?? []).length === 0 && <Empty text="Pas encore de données." />}
          {(s?.top_pages ?? []).map((p) => (
            <Bar key={p.path} label={pageName(p.path)} value={p.views} max={maxPage} suffix={`${p.views} vues · ${p.users} pers.`} />
          ))}
        </Section>

        <Section title="Fonctionnalités les plus utilisées" icon={MousePointerClick}>
          {(s?.top_actions ?? []).length === 0 && <Empty text="Pas encore de données." />}
          {(s?.top_actions ?? []).map((a, i) => (
            <div key={a.label} className="flex items-center justify-between rounded-2xl bg-card px-3 py-2.5 shadow-soft">
              <span className="truncate text-sm text-primary">
                <span className="mr-2 font-bold text-secondary">#{i + 1}</span>
                {a.label}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">{a.count}</span>
            </div>
          ))}
        </Section>

        <Section title="Journal d'activité" icon={Activity}>
          {(feed.data ?? []).map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2 border-b border-border py-2 last:border-0">
              <p className="text-xs text-foreground">
                <span className="font-semibold text-primary">{e.name}</span>{" "}
                {e.action === "page_view" ? (
                  <>a ouvert <b>{pageName(e.path)}</b></>
                ) : (
                  <>a appuyé sur « {e.label} » ({pageName(e.path)})</>
                )}
              </p>
              <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</span>
            </div>
          ))}
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Eye; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-primary">
        <Icon className="size-4" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold capitalize text-primary">{label}</span>
        <span className="text-muted-foreground">{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-emerald" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="w-full py-4 text-center text-xs text-muted-foreground">{text}</p>;
}
