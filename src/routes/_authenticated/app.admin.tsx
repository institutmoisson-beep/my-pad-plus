import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ExternalLink, Loader2, Plus, Settings, Trash2, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/routes/_authenticated/app.portefeuille";
import { useRoles, useSettings } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Imo MSN" },
      { name: "description", content: "Panneau d'administration : demandes, utilisateurs et configuration." },
      { property: "og:title", content: "Administration — Imo MSN" },
      { property: "og:description", content: "Panneau d'administration Imo MSN." },
    ],
  }),
  component: AdminPage,
});

type Method = { name: string; details: string; link?: string };

/** Attaches each row's requester profile by fetching profiles separately —
 * user_id columns reference auth.users, not public.profiles, so PostgREST
 * can't auto-embed `profiles:user_id(...)`. */
async function withRequesterNames<T extends { user_id: string }>(rows: T[]) {
  if (rows.length === 0) return [] as (T & { profile: { full_name: string } | null })[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profs, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw error;
  const map = new Map((profs ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
}

function AdminPage() {
  const { data: roles = [], isLoading: rolesLoading } = useRoles();

  if (rolesLoading) {
    return (
      <AppShell title="Administration">
        <Loader2 className="mx-auto mt-10 size-5 animate-spin text-secondary" />
      </AppShell>
    );
  }

  if (!roles.includes("admin")) {
    return (
      <AppShell title="Administration">
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Accès réservé aux administrateurs.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Administration" subtitle="Demandes, utilisateurs et configuration">
      <Tabs defaultValue="deposits">
        <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-muted p-1">
          <TabsTrigger value="deposits" className="rounded-xl text-[11px]">Recharges</TabsTrigger>
          <TabsTrigger value="withdrawals" className="rounded-xl text-[11px]">Retraits</TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl text-[11px]">Utilisateurs</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl text-[11px]">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="mt-4">
          <DepositsPanel />
        </TabsContent>
        <TabsContent value="withdrawals" className="mt-4">
          <WithdrawalsPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function DepositsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return await withRequesterNames(rows ?? []);
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_deposit", { _id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande traitée");
      void queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  if (isLoading) return <Loader2 className="mx-auto size-5 animate-spin text-secondary" />;

  return (
    <div className="space-y-2">
      {(data ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande.</p>}
      {(data ?? []).map((d) => {
        const prof = d.profile;
        return (
          <div key={d.id} className="rounded-2xl bg-card p-3.5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">{prof?.full_name || "Utilisateur"} · {money(d.amount)}</p>
                <p className="text-[11px] text-muted-foreground">{d.method} {d.reference ? `· ${d.reference}` : ""}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
            {d.proof_url && (
              <a
                href={supabase.storage.from("deposit-proofs").getPublicUrl(d.proof_url).data.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-secondary underline"
              >
                Voir la preuve
              </a>
            )}
            {d.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: d.id, approve: true })}
                  className="flex-1 gap-1 rounded-xl bg-gradient-emerald text-success-foreground"
                >
                  <Check className="size-3.5" /> Approuver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: d.id, approve: false })}
                  className="flex-1 gap-1 rounded-xl text-destructive"
                >
                  <X className="size-3.5" /> Rejeter
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WithdrawalsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return await withRequesterNames(rows ?? []);
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_withdrawal", { _id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande traitée");
      void queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  if (isLoading) return <Loader2 className="mx-auto size-5 animate-spin text-secondary" />;

  return (
    <div className="space-y-2">
      {(data ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande.</p>}
      {(data ?? []).map((w) => {
        const prof = w.profile;
        return (
          <div key={w.id} className="rounded-2xl bg-card p-3.5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">{prof?.full_name || "Utilisateur"} · {money(w.amount)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {w.network} · {w.account_number} · net {money(w.net_amount)}
                </p>
              </div>
              <StatusBadge status={w.status} />
            </div>
            {w.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: w.id, approve: true })}
                  className="flex-1 gap-1 rounded-xl bg-gradient-emerald text-success-foreground"
                >
                  <Check className="size-3.5" /> Valider le retrait
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: w.id, approve: false })}
                  className="flex-1 gap-1 rounded-xl text-destructive"
                >
                  <X className="size-3.5" /> Rejeter
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UsersPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Loader2 className="mx-auto size-5 animate-spin text-secondary" />;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Users className="size-3.5" /> {(data ?? []).length} utilisateurs inscrits
      </p>
      {(data ?? []).map((u) => (
        <div key={u.id} className="rounded-2xl bg-card p-3.5 shadow-soft">
          <p className="text-sm font-semibold text-primary">{u.full_name || "Sans nom"}</p>
          <p className="text-[11px] text-muted-foreground">{u.email ?? "—"} {u.phone ? `· ${u.phone}` : ""}</p>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel() {
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const [methods, setMethods] = useState<Method[]>((settings?.payment_methods as unknown as Method[]) ?? []);
  const [percent, setPercent] = useState(String(settings?.withdrawal_fee_percent ?? 1.5));
  const [fixed, setFixed] = useState(String(settings?.withdrawal_fee_fixed ?? 0));
  const [newName, setNewName] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newLink, setNewLink] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !settings) return;
    setMethods((settings.payment_methods ?? []) as unknown as Method[]);
    setPercent(String(settings.withdrawal_fee_percent ?? 1.5));
    setFixed(String(settings.withdrawal_fee_fixed ?? 0));
    setHydrated(true);
  }, [settings, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_settings", {
        _methods: methods as never,
        _fee_percent: Number(percent),
        _fee_fixed: Number(fixed),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration mise à jour");
      void queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-primary">
          <Settings className="size-4" /> Moyens de paiement
        </h3>
        <div className="space-y-2">
          {methods.map((m, i) => (
            <div key={`${m.name}-${i}`} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{m.name}</p>
                <p className="text-[11px] text-muted-foreground">{m.details}</p>
                {m.link && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-secondary">
                    <ExternalLink className="size-3 shrink-0" /> {m.link}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMethods((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2 rounded-2xl bg-muted p-3">
          <Input placeholder="Nom (ex: Wave)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="Détails (numéro, IBAN...)" value={newDetails} onChange={(e) => setNewDetails(e.target.value)} />
          <Input
            placeholder="Lien de paiement (facultatif, https://...)"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
          />
          <Button
            variant="outline"
            className="w-full gap-1.5 rounded-xl"
            disabled={!newName || !newDetails}
            onClick={() => {
              const link = newLink.trim();
              setMethods((prev) => [
                ...prev,
                { name: newName.trim(), details: newDetails.trim(), ...(link ? { link } : {}) },
              ]);
              setNewName("");
              setNewDetails("");
              setNewLink("");
            }}
          >
            <Plus className="size-4" /> Ajouter un moyen
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-primary">Frais de retrait</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fee-pct">Pourcentage (%)</Label>
            <Input id="fee-pct" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-fixed">Fixe (FCFA)</Label>
            <Input id="fee-fixed" inputMode="numeric" value={fixed} onChange={(e) => setFixed(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
      </section>

      <Button disabled={save.isPending} onClick={() => save.mutate()} className="h-12 w-full rounded-2xl">
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer la configuration"}
      </Button>
    </div>
  );
}
