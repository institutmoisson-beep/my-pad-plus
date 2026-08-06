import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, HandCoins, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

type Cycle = {
  id: string;
  period: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
  formal_notice_at: string | null;
};

const LABELS: Record<string, { text: string; className: string }> = {
  paid: { text: "Payé", className: "bg-success/10 text-success" },
  partial: { text: "Partiel", className: "bg-secondary/10 text-secondary" },
  late: { text: "En retard", className: "bg-destructive/10 text-destructive" },
  pending: { text: "En cours", className: "bg-muted text-muted-foreground" },
};

function monthLabel(period: string) {
  return new Date(period).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function RentCycles({ tenancyId }: { tenancyId: string }) {
  const [claimFor, setClaimFor] = useState<Cycle | null>(null);

  const { data: cycles, isLoading } = useQuery({
    queryKey: ["rent-cycles", tenancyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rent_cycles")
        .select("id, period, amount_due, amount_paid, due_date, status, formal_notice_at")
        .eq("tenancy_id", tenancyId)
        .order("period", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as Cycle[];
    },
  });

  const { data: claims } = useQuery({
    queryKey: ["my-offline-claims", tenancyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offline_payment_claims")
        .select("id, cycle_id, amount, status")
        .eq("tenancy_id", tenancyId);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Loader2 className="mx-auto mt-3 size-4 animate-spin text-secondary" />;
  if (!cycles || cycles.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-primary">Échéances mensuelles</p>
      {cycles.map((c) => {
        const remaining = Math.max(0, Number(c.amount_due) - Number(c.amount_paid));
        const badge = LABELS[c.status] ?? LABELS["pending"]!;
        const pending = (claims ?? []).some((cl) => cl.cycle_id === c.id && cl.status === "pending");
        return (
          <div key={c.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold capitalize text-primary">{monthLabel(c.period)}</p>
                <p className="text-xs text-muted-foreground">
                  Payé {money(c.amount_paid)} / {money(c.amount_due)}
                  {remaining > 0 ? ` · reste ${money(remaining)}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
                {c.status === "paid" ? (
                  <CheckCircle2 className="mr-1 inline size-3" />
                ) : c.status === "late" ? (
                  <AlertTriangle className="mr-1 inline size-3" />
                ) : (
                  <Clock className="mr-1 inline size-3" />
                )}
                {badge.text}
              </span>
            </div>

            {c.formal_notice_at && remaining > 0 && (
              <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-[11px] text-destructive">
                Mise en demeure émise le {new Date(c.formal_notice_at).toLocaleDateString("fr-FR")}. Régularisez sous
                30 jours pour éviter une procédure de résiliation devant le tribunal.
              </p>
            )}

            {remaining > 0 &&
              (pending ? (
                <p className="mt-2 text-[11px] font-medium text-secondary">
                  Déclaration hors application en attente de confirmation du propriétaire.
                </p>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setClaimFor(c)}
                  className="mt-2 h-8 w-full gap-1.5 rounded-xl text-[11px] text-muted-foreground"
                >
                  <HandCoins className="size-3.5" /> J&apos;ai payé hors application
                </Button>
              ))}
          </div>
        );
      })}

      <OfflineClaimDialog cycle={claimFor} onClose={() => setClaimFor(null)} tenancyId={tenancyId} />
    </div>
  );
}

function OfflineClaimDialog({
  cycle,
  onClose,
  tenancyId,
}: {
  cycle: Cycle | null;
  onClose: () => void;
  tenancyId: string;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const remaining = cycle ? Math.max(0, Number(cycle.amount_due) - Number(cycle.amount_paid)) : 0;

  const declare = useMutation({
    mutationFn: async () => {
      const value = Math.min(Number(amount || remaining), remaining);
      const { error } = await supabase.rpc("declare_offline_payment", {
        _cycle_id: cycle!.id,
        _amount: value,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Déclaration envoyée", { description: "Le propriétaire doit la confirmer." });
      setAmount("");
      setNote("");
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["my-offline-claims", tenancyId] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={!!cycle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Paiement hors application</DialogTitle>
          <DialogDescription>
            Déclarez un loyer payé directement au propriétaire (espèces, mobile money, virement). Il devra confirmer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            inputMode="numeric"
            placeholder={`Montant (max ${money(remaining)})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
          <Textarea
            placeholder="Précisions (mode de paiement, date, référence)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            disabled={declare.isPending || remaining <= 0}
            onClick={() => declare.mutate()}
            className="h-11 w-full rounded-xl bg-gradient-sky"
          >
            {declare.isPending ? <Loader2 className="size-4 animate-spin" /> : "Envoyer la déclaration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}