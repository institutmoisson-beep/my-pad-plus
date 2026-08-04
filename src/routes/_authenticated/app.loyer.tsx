import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Download, Loader2, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PropertyGallery } from "@/components/PropertyGallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, useWallet } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil, money, nextDueDate, typeLabel } from "@/lib/format";
import { playChime } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/app/loyer")({
  head: () => ({
    meta: [
      { title: "Loyer — Imo MSN" },
      { name: "description", content: "Suivez et payez votre loyer : paiement libre, quotidien ou total." },
      { property: "og:title", content: "Loyer — Imo MSN" },
      { property: "og:description", content: "Suivez et payez votre loyer : paiement libre, quotidien ou total." },
    ],
  }),
  component: LoyerPage,
});

function LoyerPage() {
  const { userId } = useAuth();
  const { data: wallet } = useWallet();

  const { data: tenancies, isLoading } = useQuery({
    queryKey: ["my-tenancies", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenancies")
        .select("*, properties(*)")
        .eq("tenant_id", userId!)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell title="Loyer" subtitle={`Solde disponible : ${money(wallet?.balance)}`}>
      {isLoading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-secondary" />
      ) : (tenancies ?? []).length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Receipt className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun bail actif. Associez-vous à un bien depuis l&apos;accueil.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {(tenancies ?? []).map((t) => (
            <RentCard key={t.id} tenancy={t} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

type Tenancy = {
  id: string;
  paid_current_cycle: number | string;
  properties: {
    name: string;
    type: string;
    rent_amount: number | string;
    due_day: number;
    city: string | null;
    district: string | null;
    photos?: string[] | null;
  } | null;
};

function RentCard({ tenancy }: { tenancy: Tenancy }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const rent = Number(tenancy.properties?.rent_amount ?? 0);
  const paid = Number(tenancy.paid_current_cycle);
  const remaining = Math.max(0, rent - paid);
  const due = nextDueDate(tenancy.properties?.due_day ?? 5);
  const days = daysUntil(due);
  const daily = Math.ceil(remaining / days);
  const progress = rent > 0 ? Math.min(100, (paid / rent) * 100) : 0;

  const pay = useMutation({
    mutationFn: async ({ value, mode }: { value: number; mode: string }) => {
      const { data, error } = await supabase.rpc("pay_rent", {
        _tenancy_id: tenancy.id,
        _amount: value,
        _mode: mode,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      playChime("success");
      toast.success("Paiement effectué", { description: "Votre reçu est disponible." });
      setAmount("");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Paiement refusé", { description: e.message }),
  });

  function receipt() {
    const html = `<html><head><meta charset="utf-8"><title>Reçu Imo MSN</title></head>
      <body style="font-family:system-ui;padding:32px;color:#0F172A">
      <h1 style="color:#0EA5E9">Imo MSN — Reçu de loyer</h1>
      <p><b>Bien :</b> ${tenancy.properties?.name ?? ""}</p>
      <p><b>Type :</b> ${typeLabel(tenancy.properties?.type ?? "autre")}</p>
      <p><b>Loyer mensuel :</b> ${money(rent)}</p>
      <p><b>Total payé ce cycle :</b> ${money(paid)}</p>
      <p><b>Reste à payer :</b> ${money(remaining)}</p>
      <p><b>Date :</b> ${new Date().toLocaleString("fr-FR")}</p>
      <hr><p style="color:#10B981"><b>Merci pour votre paiement.</b></p>
      <script>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    w?.document.write(html);
    w?.document.close();
  }

  return (
    <article className="rounded-3xl bg-card p-5 shadow-soft">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-primary">{tenancy.properties?.name}</h2>
          <p className="text-xs text-muted-foreground">
            {typeLabel(tenancy.properties?.type ?? "autre")} · {tenancy.properties?.city}
          </p>
        </div>
        <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
          {money(rent)}/mois
        </span>
      </header>

      <PropertyGallery
        photos={tenancy.properties?.photos ?? undefined}
        title={tenancy.properties?.name ?? "Bien"}
      />

      <div className="mt-4 space-y-2">
        <Progress value={progress} className="h-2.5" />
        <div className="flex justify-between text-xs">
          <span className="font-semibold text-success">Payé {money(paid)}</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
          <span className="font-semibold text-primary">Reste {money(remaining)}</span>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        Échéance : {due.toLocaleDateString("fr-FR")} ({days} jour{days > 1 ? "s" : ""})
      </p>

      <Tabs defaultValue="libre" className="mt-4">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted p-1 text-xs">
          <TabsTrigger value="libre" className="rounded-xl text-xs">Libre</TabsTrigger>
          <TabsTrigger value="quotidien" className="rounded-xl text-xs">Quotidien</TabsTrigger>
          <TabsTrigger value="total" className="rounded-xl text-xs">Total</TabsTrigger>
        </TabsList>

        <TabsContent value="libre" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Payez le montant que vous voulez, quand vous voulez.</p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              placeholder="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            />
            <Button
              disabled={pay.isPending || !amount || remaining === 0}
              onClick={() => pay.mutate({ value: Math.min(Number(amount), remaining), mode: "libre" })}
              className="rounded-xl"
            >
              Payer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="quotidien" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Reste {money(remaining)} sur {days} jour{days > 1 ? "s" : ""} → {money(daily)} par jour.
          </p>
          <Button
            disabled={pay.isPending || remaining === 0}
            onClick={() => pay.mutate({ value: Math.min(daily, remaining), mode: "quotidien" })}
            className="h-11 w-full rounded-xl bg-gradient-sky"
          >
            Payer {money(daily)} aujourd&apos;hui
          </Button>
        </TabsContent>

        <TabsContent value="total" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Soldez la totalité en un clic.</p>
          <Button
            disabled={pay.isPending || remaining === 0}
            onClick={() => pay.mutate({ value: remaining, mode: "total" })}
            className="h-11 w-full rounded-xl bg-gradient-emerald text-success-foreground"
          >
            Payer {money(remaining)}
          </Button>
        </TabsContent>
      </Tabs>

      <Button variant="ghost" onClick={receipt} className="mt-3 w-full gap-2 text-xs text-muted-foreground">
        <Download className="size-3.5" /> Télécharger le reçu
      </Button>
    </article>
  );
}