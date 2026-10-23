"use client";

import { Button } from "@guillxume/ui/components/button";
import { useState } from "react";
import Dialog from "@/components/Dialog";

/**
 * Actions d'une ligne de la liste des templates.
 *
 * TROIS ACTIONS, ET LEUR PRESENCE DEPEND DU ROLE :
 *
 *   Editer     n'apparait qu'avec templates:write. Un importateur qui verrait le
 *              lien tomberait sur /acces-refuse — le menu doit dire la verite.
 *   Apercu     pour tout le monde. C'est LA reponse au besoin de l'importateur :
 *              voir la fiche que produit un template sans pouvoir y toucher. Le
 *              rendu part de la version publiee, sur donnees d'exemple.
 *   Supprimer  templates:write, avec confirmation en deux temps quand le
 *              template a servi recemment (voir /api/editor/template).
 *
 * L'APERCU OUVRE UN OBJET BLOB ET NON UNE URL. La route d'apercu est un POST —
 * elle recoit quel template et quelle version. Passer par un GET signifierait
 * une URL qui rend un PDF, donc un rendu Chromium declenchable par un
 * prechargement de navigateur.
 */

/** null : pas de boite ouverte. "usage" absent : rien n'a encore servi. */
type Confirmation = { usage: number | null } | null;

export default function TemplateRowActions({
  scope,
  slug,
  name,
  canWrite,
  published,
  kind = "template",
}: {
  scope: string;
  slug: string;
  name: string;
  canWrite: boolean;
  published: number | null;
  /** Un composant gagne « Appliquer… » : le poser d'un coup dans les en-tetes ou pieds. */
  kind?: "template" | "component";
}) {
  const [busy, setBusy] = useState<"apercu" | "suppression" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  async function apercu() {
    setBusy("apercu");
    setError(null);

    try {
      const response = await fetch("/api/editor/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Sans version publiee, l'apercu se rabat sur le brouillon : sinon un
          // template tout juste cree n'aurait rien a montrer.
          template: { scope, slug, version: published === null ? "draft" : "published" },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener");
      // Le revoke est differe : le revoquer tout de suite viderait l'onglet qui
      // vient de s'ouvrir avant qu'il n'ait lu le document.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function supprimer(force: boolean) {
    setBusy("suppression");
    setError(null);

    try {
      const response = await fetch("/api/editor/template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "supprimer", scope, slug, force }),
      });
      const data = await response.json().catch(() => ({}));

      if (data.confirmable === true) {
        // Le serveur vient de decouvrir l'usage recent : la boite se rouvre
        // avec le vrai chiffre, la personne n'a rien reclique pour l'obtenir.
        setBusy(null);
        setConfirmation({ usage: typeof data.usage === "number" ? data.usage : null });
        return;
      }
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      window.location.reload();
    } catch (cause) {
      // La boite se ferme : le message d'erreur, lui, est sous les boutons
      // qu'elle recouvrait — la laisser ouverte le rendrait invisible.
      setConfirmation(null);
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {/*
        Un bouton a contour et non un lien nu : dans une cellule ou les autres
        actions sont des boutons, un lien souligne se lit comme un oubli. Et il
        reste un LIEN — ouvrir l'editeur est une navigation, ce qui preserve le
        nouvel onglet et le clic du milieu.
      */}
      {canWrite ? (
        <Button asChild variant="outline" size="sm">
          <a href={`/editor/${encodeURIComponent(scope)}/${encodeURIComponent(slug)}`}>Éditer</a>
        </Button>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={apercu} disabled={busy !== null}>
        {busy === "apercu" ? "Rendu…" : "Aperçu"}
      </Button>

      {/* Composant seulement : le poser d'un coup dans les en-tetes ou pieds de
          plusieurs templates. Une page, pas une boite — c'est un formulaire. */}
      {canWrite && kind === "component" ? (
        <Button asChild variant="outline" size="sm">
          <a href={`/composants/${encodeURIComponent(scope)}/${encodeURIComponent(slug)}/appliquer`}>Appliquer…</a>
        </Button>
      ) : null}

      {canWrite ? (
        <Button
          type="button"
          variant="outline"
          color="destructive"
          size="sm"
          disabled={busy !== null}
          onClick={() => setConfirmation({ usage: null })}
        >
          Supprimer
        </Button>
      ) : null}

      {error ? (
        <span role="alert" className="text-destructive text-sm whitespace-normal">
          {error}
        </span>
      ) : null}

      {confirmation ? (
        <Dialog
          destructive
          title="Supprimer le template"
          confirmLabel={confirmation.usage !== null ? "Supprimer quand même" : "Supprimer"}
          busy={busy === "suppression"}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => supprimer(confirmation.usage !== null)}
        >
          {confirmation.usage !== null ? (
            <>
              « {name} » a servi à <strong>{confirmation.usage} rendu(s)</strong> de production sur
              les 90 derniers jours et reste peut-être utilisé par une boutique. Le supprimer détruit
              ses versions et son historique de rendus.
            </>
          ) : (
            <>
              Supprimer « {name} » et tout son historique ? Cette action est irréversible.
            </>
          )}
        </Dialog>
      ) : null}
    </span>
  );
}
