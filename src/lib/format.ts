export function money(value: number | string | null | undefined, currency = "FCFA") {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;
}

export function nextDueDate(dueDay: number, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), Math.min(dueDay, 28));
  if (d < from) d.setMonth(d.getMonth() + 1);
  return d;
}

export function daysUntil(date: Date, from = new Date()) {
  return Math.max(1, Math.ceil((date.getTime() - from.getTime()) / 86400000));
}

export const PROPERTY_TYPES = [
  { value: "studio", label: "Studio" },
  { value: "studio_americain", label: "Studio américain" },
  { value: "2_pieces", label: "2 pièces" },
  { value: "3_pieces", label: "3 pièces" },
  { value: "4_pieces", label: "4 pièces" },
  { value: "villa", label: "Villa" },
  { value: "villa_piscine", label: "Villa avec piscine" },
  { value: "appart_1", label: "Appartement 1 pièce" },
  { value: "appart_2", label: "Appartement 2 pièces" },
  { value: "appart_3", label: "Appartement 3 pièces" },
  { value: "magasin", label: "Magasin" },
  { value: "bureau", label: "Bureau" },
  { value: "autre", label: "Autre" },
] as const;

export function typeLabel(value: string) {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label ?? "Autre";
}