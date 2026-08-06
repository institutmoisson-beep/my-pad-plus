import { useMutation } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { leaseContractHtml, openPrintable } from "@/lib/lease";

export function LeaseContractButton({ tenancyId }: { tenancyId: string }) {
  const download = useMutation({
    mutationFn: async () => {
      const { data: lease, error } = await supabase
        .from("lease_contracts")
        .select("*")
        .eq("tenancy_id", tenancyId)
        .maybeSingle();
      if (error) throw error;
      if (!lease) throw new Error("Contrat indisponible pour ce bail.");

      const [{ data: property }, { data: profiles }] = await Promise.all([
        supabase
          .from("properties")
          .select("name, type, city, district, address")
          .eq("id", lease.property_id)
          .maybeSingle(),
        supabase.from("profiles").select("id, full_name").in("id", [lease.landlord_id, lease.tenant_id]),
      ]);
      const nameOf = (id: string) => (profiles ?? []).find((p) => p.id === id)?.full_name ?? "";

      openPrintable(
        leaseContractHtml({
          reference: lease.reference,
          rent_amount: lease.rent_amount,
          due_day: lease.due_day,
          deposit_amount: lease.deposit_amount,
          start_date: lease.start_date,
          duration_months: lease.duration_months,
          landlordName: nameOf(lease.landlord_id),
          tenantName: nameOf(lease.tenant_id),
          property: {
            name: property?.name ?? "—",
            type: property?.type ?? "autre",
            city: property?.city ?? null,
            district: property?.district ?? null,
            address: property?.address ?? null,
          },
        }),
      );
    },
    onError: (e: Error) => toast.error("Contrat indisponible", { description: e.message }),
  });

  return (
    <Button
      variant="outline"
      disabled={download.isPending}
      onClick={() => download.mutate()}
      className="w-full gap-2 rounded-xl text-xs"
    >
      {download.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
      Contrat de bail
    </Button>
  );
}