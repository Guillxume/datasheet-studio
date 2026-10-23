"use client";

import { useId, useState } from "react";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Badge } from "@guillxume/ui/components/badge";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Button } from "@guillxume/ui/components/button";
import { Checkbox } from "@guillxume/ui/components/checkbox";
import { Label } from "@guillxume/ui/components/label";
import { ToggleGroup, ToggleGroupItem } from "@guillxume/ui/components/toggle-group";
import type { ApplyOutcome, ApplyTarget } from "@/lib/componentStore";
import type { ZoneName } from "@/lib/componentApply";

/**
 * Formulaire « Appliquer un composant » : la zone, les templates, la
 * publication. Une PAGE et non une boite de dialogue : il pose trois questions
 * sur une liste qui peut etre longue — voir src/components/Dialog.tsx, « une
 * boite qui pose deux questions est un formulaire ».
 *
 * BROUILLON PAR DEFAUT. La publication est une case, decochee : les templates
 * Acme sont partages entre recette et production, publier y touche la
 * production dans la seconde. Meme cochee, elle n'est pas faite la ou elle
 * livrerait autre chose que ce changement (brouillon qui attendait, template
 * jamais publie) — et le resultat le dit, template par template.
 */

const OUTCOME_LABEL: Record<ApplyOutcome["outcome"], string> = {
  unchanged: "déjà appliqué, rien à faire",
  draft: "brouillon enregistré",
  publish: "publié",
  "pending-draft": "brouillon enregistré, non publié : un brouillon attendait déjà, le publier l'aurait livré aussi",
  "never-published": "brouillon enregistré, non publié : ce template n'a jamais été publié",
};

export default function ApplyForm({
  scope,
  slug,
  componentPublished,
  canPublish,
  targets,
}: {
  scope: string;
  slug: string;
  /** Version publiee du composant : sans elle, les templates le citeraient pour rien. */
  componentPublished: number | null;
  canPublish: boolean;
  targets: ApplyTarget[];
}) {
  const id = useId();
  const [zone, setZone] = useState<ZoneName>("footer");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ApplyOutcome[] | null>(null);

  // Une zone deja appliquee n'est pas proposee : il n'y a rien a y faire.
  const actionable = targets.filter((target) => !target[zone].alreadyApplied);
  const allSelected = actionable.length > 0 && selected.size === actionable.length;

  const toggle = (targetId: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(targetId);
      else next.delete(targetId);
      return next;
    });

  async function appliquer() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/editor/template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "appliquer", scope, slug, zone, targets: [...selected], publish }),
      });
      const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      setOutcomes(data.outcomes as ApplyOutcome[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (outcomes) {
    return (
      <section className="grid max-w-3xl gap-4">
        <Alert variant="success">
          <AlertDescription>
            {outcomes.length === 0
              ? "Aucun template n'a été modifié."
              : `${outcomes.length} template${outcomes.length > 1 ? "s" : ""} traité${outcomes.length > 1 ? "s" : ""}.`}
          </AlertDescription>
        </Alert>
        <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
          {outcomes.map((item) => (
            <li key={`${item.shopSlug ?? "shared"}/${item.slug}`}>
              <strong>{item.name}</strong>{" "}
              <span className="text-muted-foreground font-mono text-xs">{item.shopSlug ?? "bibliothèque"}</span>
              {" — "}
              {OUTCOME_LABEL[item.outcome]}
              {item.version !== null ? ` (v${item.version})` : ""}
            </li>
          ))}
        </ul>
        <div>
          <Button asChild variant="outline" size="sm">
            <a href="/">Retour à la bibliothèque</a>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid max-w-3xl gap-5 text-sm">
      {componentPublished === null ? (
        <Alert variant="warning">
          <AlertDescription>
            Ce composant n&apos;est pas encore publié : les templates le citeront, mais la zone restera vide sur les
            fiches tant qu&apos;il ne l&apos;est pas.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <span id={`${id}-zone`} className="font-medium">
          Zone remplacée
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={zone}
          onValueChange={(value) => {
            // Radix rend une valeur vide quand on reclique le segment actif.
            if (!value) return;
            setZone(value as ZoneName);
            setSelected(new Set());
          }}
          aria-labelledby={`${id}-zone`}
        >
          <ToggleGroupItem value="header">En-tête</ToggleGroupItem>
          <ToggleGroupItem value="footer">Pied de page</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <div className="flex items-center justify-between gap-2">
          <legend className="font-medium">
            Templates{" "}
            <span className="text-muted-foreground font-normal">
              — {actionable.length} possible{actionable.length > 1 ? "s" : ""}
            </span>
          </legend>
          {actionable.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(allSelected ? new Set() : new Set(actionable.map((target) => target.id)))}
            >
              {allSelected ? "Tout décocher" : "Tout cocher"}
            </Button>
          ) : null}
        </div>

        {targets.length === 0 ? (
          <p className="text-muted-foreground m-0">Aucun template ne peut citer ce composant.</p>
        ) : (
          <ul className="m-0 grid list-none gap-0 rounded border p-0">
            {targets.map((target) => {
              const summary = target[zone];
              const inputId = `${id}-${target.id}`;
              return (
                <li key={target.id} className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0">
                  <Checkbox
                    id={inputId}
                    className="mt-0.5"
                    disabled={summary.alreadyApplied}
                    checked={selected.has(target.id)}
                    onCheckedChange={(value) => toggle(target.id, value === true)}
                  />
                  <Label htmlFor={inputId} className="grid flex-1 gap-1 font-normal">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{target.name}</span>
                      {target.shopSlug ? (
                        <span className="text-muted-foreground font-mono text-xs">{target.shopSlug}</span>
                      ) : (
                        <Badge variant="outline">bibliothèque</Badge>
                      )}
                      {target.publishedVersion === null ? (
                        <Badge variant="outline">jamais publié</Badge>
                      ) : target.draftVersion !== target.publishedVersion ? (
                        <BadgeStatus status="amber">brouillon en cours</BadgeStatus>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {summary.alreadyApplied
                        ? "cite déjà ce composant"
                        : summary.blocks === 0
                          ? "zone vide"
                          : `${summary.blocks} bloc${summary.blocks > 1 ? "s" : ""} remplacé${summary.blocks > 1 ? "s" : ""} par le composant`}
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {canPublish ? (
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${id}-publish`}
            className="mt-0.5"
            checked={publish}
            onCheckedChange={(value) => setPublish(value === true)}
          />
          <Label htmlFor={`${id}-publish`} className="grid gap-1 leading-snug font-normal">
            <span className="font-medium">Publier aussitôt les templates modifiés</span>
            <span className="text-muted-foreground">
              Les boutiques régénèrent alors leurs fiches. Ne sont pas publiés les templates qui avaient déjà un
              brouillon en cours (il serait livré avec), ni ceux jamais publiés.
            </span>
          </Label>
        </div>
      ) : null}

      <p className="text-muted-foreground m-0 max-w-prose">
        À vérifier ensuite dans chaque template : la hauteur réservée à la zone (« Bande haute » ou « Bande basse »,
        onglet Corps). Ce qui dépasse est masqué à l&apos;impression.
      </p>

      {error ? (
        <p role="alert" className="text-destructive m-0">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={appliquer} disabled={busy || selected.size === 0}>
          {busy
            ? "Application…"
            : selected.size === 0
              ? "Cocher au moins un template"
              : `${publish ? "Remplacer et publier" : "Remplacer"} — ${selected.size} template${selected.size > 1 ? "s" : ""}`}
        </Button>
        <Button asChild variant="outline">
          <a href="/">Annuler</a>
        </Button>
      </div>
    </section>
  );
}
