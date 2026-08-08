import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
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
import { useHideBalance } from "@/hooks/useHideBalance";
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
  const { hidden, toggle, mask } = useHideBalance();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <Wallet className="size-4" /> Solde Imo Wallet
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={hidden ? "Afficher le solde" : "Masquer le solde"}
            className="rounded-xl p-1.5 opacity-80 transition hover:bg-primary-foreground/10 hover:opacity-100"
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="mt-2 text-3xl font-extrabold tracking-tight">{mask(money(wallet?.balance))}</p>
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
  const [method, setMethod] = useState<string>("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = methods.find((m) => m.name === method) ?? null;
  const amountValue = Number(amount || 0);

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
        amount: amountValue,
        method: method || "Non précisé",
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
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto rounded-3xl p-0">
        <div className="rounded-t-3xl bg-gradient-royal p-5 text-primary-foreground">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-extrabold">Recharger mon portefeuille</DialogTitle>
            <DialogDescription className="text-primary-foreground/70">
              Choisissez un moyen, payez, puis envoyez la preuve.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-2xl bg-primary-foreground/10 p-3">
            <Label htmlFor="dep-amount" className="text-[11px] uppercase tracking-wide opacity-70">
              Montant à recharger
            </Label>
            <div className="flex items-baseline gap-2">
              <Input
                id="dep-amount"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="h-11 border-0 bg-transparent px-0 text-2xl font-extrabold text-primary-foreground shadow-none placeholder:text-primary-foreground/40 focus-visible:ring-0"
              />
              <span className="text-sm font-semibold opacity-70">FCFA</span>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {[5000, 10000, 25000, 50000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="flex-1 rounded-xl bg-primary-foreground/10 py-1.5 text-[11px] font-semibold transition hover:bg-primary-foreground/20"
              >
                {v / 1000}k
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <section className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              1. Moyen de paiement
            </Label>
            {methods.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Aucun moyen de paiement configuré par l&apos;administrateur pour le moment.
              </p>
            )}
            <div className="grid gap-2">
              {methods.map((m) => {
                const active = m.name === method;
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setMethod(m.name)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-secondary bg-secondary/5 shadow-soft"
                        : "border-border bg-card hover:border-secondary/50"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                        active ? "bg-gradient-sky text-secondary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-primary">{m.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{m.details}</span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-secondary" />}
                  </button>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                2. Effectuer le paiement
              </Label>
              <div className="rounded-2xl bg-muted p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{selected.details}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(selected.details);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                      toast.success("Copié");
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-primary"
                    aria-label="Copier les détails"
                  >
                    {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </button>
                </div>
                {selected.link && (
                  <Button
                    asChild
                    className="mt-3 h-11 w-full gap-2 rounded-xl bg-gradient-sky text-secondary-foreground"
                  >
                    <a href={selected.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" /> Payer via {selected.name}
                    </a>
                  </Button>
                )}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              3. Preuve de paiement
            </Label>
            <div className="space-y-1.5">
              <Label htmlFor="dep-ref" className="text-xs">Référence de transaction</Label>
              <Input id="dep-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </div>
            <label
              htmlFor="dep-file"
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-3.5 transition hover:border-secondary"
            >
              <ImageUp className="size-5 text-secondary" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {file ? file.name : "Ajouter une capture d'écran"}
              </span>
            </label>
            <Input
              id="dep-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </section>

          <div className="flex items-center justify-between rounded-2xl bg-muted p-3 text-xs">
            <span className="text-muted-foreground">Total à créditer</span>
            <b className="text-primary">{money(amountValue)}</b>
          </div>

          <Button
            disabled={!amountValue || !method || submit.isPending}
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