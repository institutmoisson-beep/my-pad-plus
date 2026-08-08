import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  EyeOff,
  Home,
  Loader2,
  Receipt,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile, useRoles, useWallet } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Accueil — Imo MSN" },
      { name: "description", content: "Votre tableau de bord Imo MSN : solde, loyer et biens." },
      { property: "og:title", content: "Accueil — Imo MSN" },
      { property: "og:description", content: "Votre tableau de bord Imo MSN : solde, loyer et biens." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { userId } = useAuth();
  const { data: profile } = useProfile();
  const { data: roles = [] } = useRoles();
  const { data: wallet } = useWallet();
  const { hidden, toggle, mask } = useHideBalance();

  const isLandlord = roles.includes("landlord");
  const isTenant = roles.includes("tenant");

  const { data: tenancies, isLoading } = useQuery({
    queryKey: ["tenancies", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenancies")
        .select("*, properties(*)")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const asTenant = (tenancies ?? []).filter((t) => t.tenant_id === userId);
  const asLandlord = (tenancies ?? []).filter((t) => t.landlord_id === userId);
  const dueTotal = asTenant.reduce(
    (sum, t) => sum + Math.max(0, Number(t.properties?.rent_amount ?? 0) - Number(t.paid_current_cycle)),
    0,
  );

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-sm text-muted-foreground">Bonjour 👋</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">
          {profile?.full_name || "Bienvenue"}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={toggle} className="text-left" aria-label={hidden ? "Afficher le solde" : "Masquer le solde"}>
          <StatCard label="Solde Imo Wallet" value={mask(money(wallet?.balance))} icon={hidden ? EyeOff : Wallet} tone="navy" />
        </button>
        {isTenant ? (
          <StatCard label="Reste à payer" value={money(dueTotal)} icon={Receipt} tone="sky" />
        ) : (
          <StatCard label="Statut" value={isLandlord ? "Propriétaire" : "Utilisateur"} icon={Sparkles} tone="sky" />
        )}
      </div>

      {isLandlord && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="Mes biens loués" value={`${asLandlord.length}`} icon={Building2} tone="emerald" />
          <StatCard label="Locataires actifs" value={`${new Set(asLandlord.map((t) => t.tenant_id)).size}`} icon={CheckCircle2} tone="plain" />
        </div>
      )}

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Actions rapides
        </h2>
        <div className="grid gap-3">
          <Link to="/app/lier">
            <Button variant="outline" className="h-14 w-full justify-start gap-3 rounded-2xl border-border bg-card text-base shadow-soft">
              <Search className="size-5 text-secondary" />
              Rechercher mon propriétaire
            </Button>
          </Link>
          <Link to="/app/portefeuille">
            <Button variant="outline" className="h-14 w-full justify-start gap-3 rounded-2xl border-border bg-card text-base shadow-soft">
              <Wallet className="size-5 text-success" />
              Recharger mon portefeuille
            </Button>
          </Link>
          <Link to="/app/biens">
            <Button variant="outline" className="h-14 w-full justify-start gap-3 rounded-2xl border-border bg-card text-base shadow-soft">
              <Building2 className="size-5 text-primary" />
              {isLandlord ? "Gérer mes biens" : "Devenir propriétaire"}
            </Button>
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Mes logements
        </h2>
        {isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin text-secondary" />
        ) : asTenant.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center">
            <Home className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Aucun logement associé pour le moment.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {asTenant.map((t) => (
              <li key={t.id} className="rounded-3xl bg-card p-4 shadow-soft">
                <p className="font-semibold text-primary">{t.properties?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.properties?.city} · {t.properties?.district}
                </p>
                <p className="mt-2 text-sm font-bold text-success">
                  {money(t.properties?.rent_amount)} / mois
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}