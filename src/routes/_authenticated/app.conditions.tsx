import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/app/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — Imo MSN" },
      {
        name: "description",
        content:
          "Conditions générales d'utilisation d'Imo MSN, marque de l'Institut Moisson, pour les propriétaires et locataires en Côte d'Ivoire.",
      },
      { property: "og:title", content: "Conditions d'utilisation — Imo MSN" },
      {
        property: "og:description",
        content: "CGU d'Imo MSN, marque de l'Institut Moisson, conformes au droit ivoirien.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConditionsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function ConditionsPage() {
  return (
    <AppShell title="Conditions d'utilisation" subtitle="Imo MSN — une marque de l'Institut Moisson">
      <div className="space-y-3">
        <p className="rounded-2xl bg-secondary/10 p-4 text-xs leading-relaxed text-foreground">
          Dernière mise à jour : août 2026. En créant un compte et en utilisant Imo MSN, vous acceptez
          sans réserve les présentes conditions générales d'utilisation (CGU). Ce document est rédigé
          au regard du droit ivoirien et n'est pas un conseil juridique&nbsp;: il est maintenu et
          modifiable par l'Institut Moisson.
        </p>

        <Section title="1. Éditeur et objet">
          <p>
            Imo MSN est une marque et un service exploités par l'Institut Moisson (ci-après
            «&nbsp;l'Éditeur&nbsp;»). Imo MSN est une plateforme numérique de mise en relation et de
            gestion locative permettant aux propriétaires (bailleurs) d'enregistrer leurs biens, aux
            locataires de s'y rattacher, de suivre et de payer leurs loyers, d'échanger par
            messagerie et d'utiliser un portefeuille interne.
          </p>
          <p>
            L'Éditeur n'est ni bailleur, ni agent immobilier partie au contrat de bail. Le contrat de
            location demeure conclu directement entre le propriétaire et le locataire.
          </p>
        </Section>

        <Section title="2. Cadre légal ivoirien applicable">
          <p>
            Les présentes CGU sont régies par la loi ivoirienne, notamment&nbsp;: la loi n°2019-576
            du 26 juin 2019 instituant Code de l'électricité et les textes relatifs au bail
            d'habitation (loi n°2018-575 du 13 juin 2018 relative au bail à usage d'habitation), la
            loi n°2013-450 du 19 juin 2013 relative à la protection des données à caractère
            personnel, la loi n°2013-451 du 19 juin 2013 relative à la lutte contre la cybercriminalité,
            la loi n°2013-546 du 30 juillet 2013 relative aux transactions électroniques, ainsi que
            les dispositions de l'OHADA applicables aux activités commerciales.
          </p>
          <p>
            Conformément à la réglementation ivoirienne sur le bail à usage d'habitation, la caution
            et l'avance exigibles sont encadrées et ne peuvent excéder les plafonds légaux. Les
            propriétaires s'engagent à respecter ces plafonds lorsqu'ils publient un bien ou
            réclament un paiement via Imo MSN.
          </p>
        </Section>

        <Section title="3. Compte utilisateur, PIN et biométrie">
          <p>
            L'inscription requiert des informations exactes (nom, email, téléphone). Chaque
            utilisateur est responsable de la confidentialité de son mot de passe, de son code PIN à
            4 chiffres et de l'appareil sur lequel la connexion biométrique est activée. Toute
            opération réalisée avec ces identifiants est réputée effectuée par le titulaire du compte.
          </p>
          <p>
            Un même utilisateur peut cumuler les qualités de locataire et de propriétaire. Les rôles
            (utilisateur, locataire, propriétaire, administrateur) déterminent les fonctionnalités
            accessibles.
          </p>
        </Section>

        <Section title="4. Propriétaires (bailleurs)">
          <p>
            Le propriétaire déclare disposer d'un droit réel ou d'un mandat l'autorisant à mettre le
            bien en location. Il garantit l'exactitude des informations publiées (type de bien,
            montant du loyer, jour d'échéance, ville, quartier, adresse, photos) et s'interdit toute
            annonce mensongère ou discriminatoire.
          </p>
          <p>
            Il est seul responsable de ses obligations légales de bailleur&nbsp;: délivrance d'un
            logement décent, quittances, préavis, restitution de la caution, déclarations fiscales et
            paiement de l'impôt foncier.
          </p>
        </Section>

        <Section title="5. Locataires">
          <p>
            Le locataire s'engage à se rattacher uniquement aux biens qu'il occupe réellement, à
            payer son loyer aux échéances convenues et à utiliser les modes de paiement proposés
            (paiement libre, quotidien ou intégral) de bonne foi.
          </p>
          <p>
            Les reçus générés par l'application attestent d'un paiement effectué via Imo MSN&nbsp;;
            ils ne remplacent pas la quittance de loyer que le bailleur doit délivrer.
          </p>
        </Section>

        <Section title="6. Portefeuille, recharges et retraits">
          <p>
            Le portefeuille interne est un simple compte technique de suivi et ne constitue ni un
            compte bancaire, ni un dépôt rémunéré. Les recharges sont validées après vérification du
            justificatif par l'administration. Les retraits sont soumis à validation et à des frais
            affichés avant confirmation.
          </p>
          <p>
            Les paiements sont exécutés en FCFA. Conformément aux obligations de lutte contre le
            blanchiment de capitaux et le financement du terrorisme (UEMOA/BCEAO), l'Éditeur peut
            demander des justificatifs supplémentaires, suspendre une opération suspecte ou la
            signaler aux autorités compétentes.
          </p>
        </Section>

        <Section title="7. Messagerie et contenus">
          <p>
            La messagerie est réservée aux échanges liés à la location. Sont interdits&nbsp;: les
            propos injurieux, diffamatoires, haineux, les escroqueries, l'usurpation d'identité et
            tout contenu illicite au sens de la loi n°2013-451 relative à la cybercriminalité. Les
            contenus signalés peuvent être examinés et le compte concerné suspendu.
          </p>
        </Section>

        <Section title="8. Données personnelles">
          <p>
            L'Éditeur traite les données strictement nécessaires au service&nbsp;: identité,
            coordonnées, rôles, biens, baux, paiements, messages et justificatifs. Les données sont
            conservées pendant la durée de la relation puis pour les durées légales de conservation
            comptable.
          </p>
          <p>
            Conformément à la loi n°2013-450, vous disposez d'un droit d'accès, de rectification,
            d'opposition et de suppression de vos données, exerçable auprès de l'Institut Moisson via
            l'assistance de l'application. L'accès aux profils est techniquement restreint aux
            parties liées par un bail actif et aux administrateurs.
          </p>
        </Section>

        <Section title="9. Rôle et responsabilité de l'Éditeur">
          <p>
            L'Éditeur fournit un outil technique. Il ne garantit ni la solvabilité du locataire, ni la
            véracité absolue des annonces, ni l'exécution du bail. Sa responsabilité ne peut être
            engagée pour les litiges entre propriétaire et locataire, ni pour les interruptions dues à
            la maintenance, au réseau ou à un cas de force majeure.
          </p>
        </Section>

        <Section title="10. Administration">
          <p>
            L'administrateur de l'Institut Moisson peut valider les recharges et retraits, consulter
            les données nécessaires au contrôle, paramétrer les moyens de paiement et les frais, et
            suspendre un compte en cas de fraude ou de manquement aux présentes CGU.
          </p>
        </Section>

        <Section title="11. Résiliation et litiges">
          <p>
            Vous pouvez cesser d'utiliser Imo MSN à tout moment&nbsp;; les obligations nées avant la
            clôture (loyers dus, opérations en cours) demeurent. En cas de différend, les parties
            privilégient un règlement amiable. À défaut, les juridictions compétentes d'Abidjan,
            République de Côte d'Ivoire, sont seules compétentes, la loi ivoirienne étant applicable.
          </p>
        </Section>

        <Section title="12. Modification des CGU">
          <p>
            L'Institut Moisson peut modifier les présentes conditions pour tenir compte d'évolutions
            légales ou fonctionnelles. La poursuite de l'utilisation après publication vaut
            acceptation de la version en vigueur.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}