import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2, Search, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { money, typeLabel } from "@/lib/format";
import { playChime } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/app/lier")({
  head: () => ({
    meta: [
      { title: "Rechercher mon propriétaire — Imo MSN" },
      { name: "description", content: "Trouvez votre propriétaire et revendiquez le bien que vous occupez." },
      { property: "og:title", content: "Rechercher mon propriétaire — Imo MSN" },
      { property: "og:description", content: "Trouvez votre propriétaire et revendiquez le bien que vous occupez." },
    ],
  }),
  component: LinkPage,
});

function LinkPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<{ id: string; full_name: string } | null>(null);

  const results = useQuery({
    queryKey: ["search-users", submitted],
    enabled: submitted.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_users", { _q: submitted });
      if (error) throw error;
      return data ?? [];
    },
  });

  const properties = useQuery({
    queryKey: ["landlord-properties", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_landlord_properties", {
        _landlord_id: selected!.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const claim = useMutation({
    mutationFn: async (propertyId: string) => {
      const { error } = await supabase.rpc("claim_tenancy", { _property_id: propertyId });
      if (error) throw error;
    },
    onSuccess: () => {
      playChime("success");
      toast.success("Bien revendiqué", { description: "Votre onglet Loyer est maintenant actif." });
      void queryClient.invalidateQueries();
      void navigate({ to: "/app/loyer" });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <AppShell title="Rechercher mon propriétaire" subtitle="Par email ou numéro de téléphone exact">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSelected(null);
          setSubmitted(query.trim());
        }}
        className="flex gap-2"
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Email ou téléphone exact" maxLength={80} />
        <Button type="submit" className="rounded-xl"><Search className="size-4" /></Button>
      </form>

      {results.isFetching && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-secondary" />}

      {!selected && (results.data ?? []).length > 0 && (
        <ul className="mt-5 space-y-2">
          {(results.data ?? []).map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected({ id: u.id, full_name: u.full_name })}
                className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-soft active:scale-[0.99]"
              >
                <UserCheck className="size-5 text-secondary" />
                <div>
                  <p className="text-sm font-semibold text-primary">{u.full_name || "Sans nom"}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {submitted && !results.isFetching && (results.data ?? []).length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
      )}

      {selected && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-primary">
            Biens de {selected.full_name}
          </h2>
          {properties.isLoading && <Loader2 className="mx-auto size-5 animate-spin text-secondary" />}
          {(properties.data ?? []).length === 0 && !properties.isLoading && (
            <p className="text-sm text-muted-foreground">Ce propriétaire n&apos;a aucun bien listé.</p>
          )}
          <ul className="space-y-3">
            {(properties.data ?? []).map((p) => (
              <li key={p.id} className="rounded-3xl bg-card p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-5 text-secondary" />
                  <div className="flex-1">
                    <p className="font-semibold text-primary">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabel(p.type)} · {p.city} {p.district}
                    </p>
                    <p className="mt-1 text-sm font-bold text-success">{money(p.rent_amount)} / mois</p>
                  </div>
                </div>
                <Button
                  disabled={claim.isPending}
                  onClick={() => claim.mutate(p.id)}
                  className="mt-3 h-11 w-full rounded-2xl bg-gradient-sky"
                >
                  Revendiquer comme locataire
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => setSelected(null)} className="mt-4 w-full text-muted-foreground">
            Retour aux résultats
          </Button>
        </section>
      )}
    </AppShell>
  );
}