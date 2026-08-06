import { money, typeLabel } from "./format";

export type LeaseData = {
  reference: string;
  rent_amount: number | string;
  due_day: number;
  deposit_amount: number | string;
  start_date: string;
  duration_months: number;
  landlordName: string;
  tenantName: string;
  property: {
    name: string;
    type: string;
    city: string | null;
    district: string | null;
    address: string | null;
  };
};

function esc(v: string) {
  return v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

export function leaseContractHtml(d: LeaseData) {
  const start = new Date(d.start_date).toLocaleDateString("fr-FR");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>Contrat de bail ${esc(d.reference)} — Imo MSN</title>
  <style>
    body{font-family:Georgia,serif;color:#0F172A;padding:40px;line-height:1.6;max-width:800px;margin:auto}
    h1{color:#0EA5E9;font-size:22px;margin-bottom:2px}
    h2{font-size:15px;margin-top:22px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
    .ref{color:#64748b;font-size:12px}
    ul{padding-left:18px} li{margin:4px 0}
    .sign{display:flex;justify-content:space-between;margin-top:48px}
    .sign div{width:45%;border-top:1px solid #94a3b8;padding-top:6px;font-size:12px}
    footer{margin-top:36px;font-size:11px;color:#64748b}
  </style></head><body>
  <h1>CONTRAT DE BAIL À USAGE D'HABITATION</h1>
  <p class="ref">Référence : <b>${esc(d.reference)}</b> · Imo MSN, une marque de l'Institut Moisson · République de Côte d'Ivoire</p>

  <h2>Entre les parties</h2>
  <p><b>Le Bailleur :</b> ${esc(d.landlordName || "—")}</p>
  <p><b>Le Preneur (Locataire) :</b> ${esc(d.tenantName || "—")}</p>

  <h2>Article 1 — Objet et désignation du bien</h2>
  <p>Le Bailleur donne à bail au Preneur le bien ci-après désigné :
  <b>${esc(d.property.name)}</b> (${esc(typeLabel(d.property.type))}),
  situé à ${esc(d.property.city ?? "—")} ${esc(d.property.district ?? "")} ${esc(d.property.address ?? "")}.</p>

  <h2>Article 2 — Durée</h2>
  <p>Le présent bail est conclu pour une durée de ${d.duration_months} mois à compter du ${start},
  renouvelable par tacite reconduction, sauf congé donné par l'une des parties dans les formes légales.</p>

  <h2>Article 3 — Loyer et modalités de paiement</h2>
  <ul>
    <li>Loyer mensuel : <b>${money(d.rent_amount)}</b>, payable d'avance au plus tard le <b>${d.due_day}</b> de chaque mois.</li>
    <li>Le paiement s'effectue via le portefeuille électronique Imo MSN (paiement libre, quotidien ou total) ou hors application, sous réserve de confirmation du Bailleur.</li>
    <li>Tout solde impayé d'un mois écoulé est automatiquement prélevé sur le portefeuille du Preneur dès son rechargement, jusqu'à complet apurement.</li>
  </ul>

  <h2>Article 4 — Dépôt de garantie</h2>
  <p>Un dépôt de garantie de <b>${money(d.deposit_amount)}</b> (deux mois de loyer maximum, conformément à la
  loi n° 2018-575 du 13 juin 2018 relative au bail à usage d'habitation) est versé au Bailleur et restitué
  en fin de bail, déduction faite des sommes dues.</p>

  <h2>Article 5 — Retard de paiement</h2>
  <ul>
    <li>À défaut de paiement à l'échéance, un avis de retard est notifié aux deux parties par l'application.</li>
    <li>Passé quinze (15) jours, une mise en demeure de payer est adressée au Preneur.</li>
    <li>À défaut de régularisation dans les trente (30) jours suivant la mise en demeure, le Bailleur peut saisir
    la juridiction compétente aux fins de résiliation du bail et d'expulsion. Aucune expulsion ne peut intervenir
    sans décision de justice.</li>
    <li>Aucune pénalité de retard n'est appliquée automatiquement par la plateforme.</li>
  </ul>

  <h2>Article 6 — Obligations des parties</h2>
  <ul>
    <li>Le Bailleur délivre un logement décent, en assure la jouissance paisible et les grosses réparations.</li>
    <li>Le Preneur paie le loyer aux échéances, use paisiblement des lieux et assure l'entretien courant.</li>
  </ul>

  <h2>Article 7 — Rôle d'Imo MSN</h2>
  <p>Imo MSN, marque de l'Institut Moisson, agit uniquement comme intermédiaire technique de mise en relation,
  de suivi et de paiement. Elle n'est pas partie au bail et ne garantit pas l'exécution des obligations des parties.</p>

  <h2>Article 8 — Litiges</h2>
  <p>Les parties privilégient le règlement amiable. À défaut, compétence est attribuée aux juridictions
  ivoiriennes du lieu de situation de l'immeuble.</p>

  <div class="sign"><div>Le Bailleur<br>${esc(d.landlordName || "")}</div><div>Le Preneur<br>${esc(d.tenantName || "")}</div></div>
  <footer>Document généré électroniquement par Imo MSN le ${new Date().toLocaleString("fr-FR")}. Référence ${esc(d.reference)}.</footer>
  <script>window.print()</script></body></html>`;
}

export function openPrintable(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}