import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

/** Affiche la preuve de paiement dans l'application (aucune URL de stockage exposée). */
export function ProofViewer({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    let cancelled = false;
    setError(null);
    setSrc(null);
    void (async () => {
      const { data, error: dlError } = await supabase.storage.from("deposit-proofs").download(path);
      if (cancelled) return;
      if (dlError || !data) {
        setError("Preuve introuvable ou inaccessible.");
        return;
      }
      url = URL.createObjectURL(data);
      setSrc(url);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, path]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-2 gap-1.5 rounded-xl text-xs"
      >
        <Receipt className="size-3.5" /> Voir la preuve
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Preuve de paiement</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-40 place-items-center overflow-hidden rounded-2xl bg-muted">
            {error && <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>}
            {!error && !src && <Loader2 className="size-5 animate-spin text-secondary" />}
            {src && <img src={src} alt="Preuve de paiement envoyée par l'utilisateur" className="max-h-[70vh] w-full object-contain" />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
