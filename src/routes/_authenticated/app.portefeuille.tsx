import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  ExternalLink,
  ImageUp,
  Loader2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, useRoles, useSettings, useWallet } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/portefeuille")({
  head: () => ({
    meta: [
      { title: "Portefeuille — Imo MSN" },
      { name: "description", content: "Rechargez votre portefeuille, suivez vos transactions et demandez un retrait." },
      { property: "og:title", content: "Portefeuille — Imo MSN" },
      { property: "og:description", content: "Rechargez votre portefeuille, suivez vos transactions et demandez un retrait." },
    ],
  }),
  component: WalletPage,
});

type Method = { name: string; details: string; link?: string };

function WalletPage() {
  const { userId } = useAuth();
  const { data: wallet } = useWallet();
  const { data: roles = [] } = useRoles();
  const { data: settings } = useSettings();
  const methods = (settings?.payment_methods ?? []) as unknown as Method[];

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["my-requests", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [dep, wit] = await Promise.all([
        supabase.from("deposit_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      ]);
      return { deposits: dep.data ?? [], withdrawals: wit.data ?? [] };
    },
  });

  return (
    <AppShell title="Portefeuille">
      <div className="rounded-3xl bg-gradient-royal p-6 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-2 text-xs opacity-80">
          <Wallet className="size-4" /> Solde Imo Wallet
        </div>
        <p className="mt-2 text-3xl font-extrabold tracking-tight">{money(wallet?.balance)}</p>
        <div className="mt-5 flex gap-2">
          <DepositDialog methods={methods} />
          {roles.includes("landlord") && <WithdrawDialog balance={Number(wallet?.balance ?? 0)} />}
        </div>
      </div>

      <Tabs defaultValue="history" className="mt-6">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted p-1">
          <TabsTrigger value="history" className="rounded-xl">Historique</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl">Demandes</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4 space-y-2">
          {isLoading && <Loader2 className="mx-auto size-5 animate-spin text-secondary" />}
          {(transactions ?? []).length === 0 && !isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune transaction.</p>
          )}
          {(transactions ?? []).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-soft">
              <div>
                <p className="text-sm font-semibold text-primary">{tx.label ?? tx.kind}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(tx.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              <span className={Number(tx.amount) < 0 ? "font-bold text-destructive" : "font-bold text-success"}>
                {Number(tx.amount) < 0 ? "-" : "+"}
                {money(Math.abs(Number(tx.amount)))}
              </span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-2">
          {[...(requests?.deposits ?? []).map((d) => ({ ...d, type: "Rechargement" })),
            ...(requests?.withdrawals ?? []).map((w) => ({ ...w, type: "Retrait" }))]
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-soft">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {r.type} · {money(r.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          {(requests?.deposits.length ?? 0) + (requests?.withdrawals.length ?? 0) === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande.</p>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "bg-secondary/10 text-secondary" },
    approved: { label: "Approuvé", className: "bg-success/10 text-success" },
    rejected: { label: "Rejeté", className: "bg-destructive/10 text-destructive" },
  };
  const item = map[status] ?? map["pending"]!;
  return <Badge className={`rounded-full border-0 ${item.className}`}>{item.label}</Badge>;
}

function DepositDialog({ methods }: { methods: Method[] }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]?.name ?? "Wave");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      let proofUrl: string | null = null;
      if (file) {
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("deposit-proofs").upload(path, file);
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const { error } = await supabase.from("deposit_requests").insert({
        user_id: userId!,
        amount: Number(amount),
        method,
        reference: reference.trim() || null,
        proof_url: proofUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée", { description: "Un administrateur va la vérifier." });
      setOpen(false);
      setAmount("");
      setReference("");
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 flex-1 gap-2 rounded-2xl bg-background text-primary hover:bg-background/90">
          <ArrowDownToLine className="size-4" /> Recharger
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Recharger mon portefeuille</DialogTitle>
          <DialogDescription>Effectuez le paiement puis envoyez la preuve.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Moyen de paiement</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              {methods.find((m) => m.name === method)?.details}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-amount">Montant</Label>
            <Input id="dep-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-ref">Référence de transaction</Label>
            <Input id="dep-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-file">Capture d&apos;écran</Label>
            <Input id="dep-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button
            disabled={!amount || submit.isPending}
            onClick={() => submit.mutate()}
            className="h-12 w-full rounded-2xl"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Envoyer la demande"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ balance }: { balance: number }) {
  const { userId } = useAuth();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState("Wave");
  const [account, setAccount] = useState("");

  const percent = Number(settings?.withdrawal_fee_percent ?? 0);
  const fixed = Number(settings?.withdrawal_fee_fixed ?? 0);
  const value = Number(amount || 0);
  const fee = Math.round((value * percent) / 100 + fixed);
  const net = Math.max(0, value - fee);

  const submit = useMutation({
    mutationFn: async () => {
      if (value > balance) throw new Error("Solde insuffisant");
      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: userId!,
        amount: value,
        fee,
        net_amount: net,
        network,
        account_number: account.trim(),
      });
      if (error) throw error;
      await supabase.from("payout_methods").insert({
        user_id: userId!,
        network,
        account_number: account.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Demande de retrait envoyée");
      setOpen(false);
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 flex-1 gap-2 rounded-2xl border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowUpFromLine className="size-4" /> Retirer
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Demande de retrait</DialogTitle>
          <DialogDescription>Solde disponible : {money(balance)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Réseau de paiement</Label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Orange Money", "Moov Money", "MTN Money", "Wave", "Virement bancaire (IBAN)", "Crypto USDT"].map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-acc">Numéro / IBAN / Adresse</Label>
            <Input id="wd-acc" value={account} onChange={(e) => setAccount(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-amount">Montant</Label>
            <Input id="wd-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="rounded-2xl bg-muted p-3 text-xs">
            <div className="flex justify-between"><span>Frais ({percent}%{fixed ? ` + ${money(fixed)}` : ""})</span><b>{money(fee)}</b></div>
            <div className="mt-1 flex justify-between text-success"><span>Vous recevez</span><b>{money(net)}</b></div>
          </div>
          <Button
            disabled={!value || !account || submit.isPending}
            onClick={() => submit.mutate()}
            className="h-12 w-full rounded-2xl bg-gradient-emerald text-success-foreground"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Demander le retrait"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}