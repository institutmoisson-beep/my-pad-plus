import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, HandCoins, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { playChime } from "@/lib/sound";

export function OfflineClaimsInbox({ landlordId }: { landlordId: string }) {
  const queryClient = useQueryClient();

  const { data: claims } = useQuery({
    queryKey: ["offline-claims-inbox", landlordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offline_payment_claims")
        .select("id, amount, note, created_at, cycle_id, tenant_id, rent_cycles(period)")
        .eq("landlord_id", landlordId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_offline_payment", { _id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      playChime("success");
      toast.success(v.approve ? "Paiement confirmé" : "Déclaration rejetée");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  if (!claims || claims.length === 0) return null;

  return (
    <section className="mt-5 space-y-3 rounded-3xl border border-secondary/30 bg-card p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
        <HandCoins className="size-4 text-secondary" /> Paiements hors application à valider
      </h2>
      {claims.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-primary">{money(c.amount)}</p>
          <p className="text-xs text-muted-foreground">
            Loyer de{" "}
            {c.rent_cycles?.period
              ? new Date(c.rent_cycles.period).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
              : "—"}{" "}
            · déclaré le {new Date(c.created_at).toLocaleDateString("fr-FR")}
          </p>
          {c.note && <p className="mt-1 text-xs italic text-muted-foreground">« {c.note} »</p>}
          <div className="mt-2 flex gap-2">
            <Button
              disabled={review.isPending}
              onClick={() => review.mutate({ id: c.id, approve: true })}
              className="h-9 flex-1 gap-1 rounded-xl bg-gradient-emerald text-xs text-success-foreground"
            >
              <Check className="size-3.5" /> Confirmer
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: c.id, approve: false })}
              className="h-9 flex-1 gap-1 rounded-xl text-xs"
            >
              <X className="size-3.5" /> Rejeter
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}