"use client";

import { useState } from "react";
import { Badge } from "@guillxume/ui/components/badge";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Button } from "@guillxume/ui/components/button";
import { Checkbox } from "@guillxume/ui/components/checkbox";
import { Label } from "@guillxume/ui/components/label";
import { Spinner } from "@guillxume/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@guillxume/ui/components/tooltip";
import { cn } from "@guillxume/ui/lib/utils";
import { SAMPLE_PROFILES, sampleProfileLabel, type SampleProfileId } from "@/lib/sampleProfiles";
import { VARIABLES, VARIABLE_NOTES } from "@/lib/variables";
import type { CanvasMetrics } from "./measure";

/**
 * Panneaux de l'editeur : presentation seule.
 *
 * Extraits de EditorClient, qui porte deja l'etat des trois arbres, la boucle de
 * veille du canvas et l'orchestration des rendus. Ces quatre blocs n'ont aucune
 * logique propre : les separer laisse dans EditorClient ce qui merite d'y etre lu.
 */

export type PreviewMeta = {
  profile: SampleProfileId;
  pages: number | null;
  warnings: string[];
  bytes: number;
};

export type CheckRow = {
  profile: SampleProfileId;
  state: "pending" | "running" | "ok" | "error";
  pages?: number | null;
  warnings?: string[];
  ms?: number;
  error?: string;
};

/**
 * Une valeur mesuree, avec son unite en corps reduit et attenue. Un « 3 » nu
 * ne dit pas s'il compte des pages, des millimetres ou des kilo-octets ; ce
 * panneau n'affiche jamais un nombre sans dire ce qu'il mesure.
 * `whitespace-nowrap` colle le nombre a son unite : les deux se separeraient
 * sinon au saut de ligne.
 */
function Dimension({ value, unit }: { value: string | number; unit: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {value}
      <span className="text-muted-foreground ml-[0.18em] text-[0.8em] font-normal">{unit}</span>
    </span>
  );
}

/** Panneau depliant sous la barre (variables, controle). */
const PANEL = "bg-card max-h-[46vh] overflow-y-auto border-b px-4 pt-3 pb-4";

/**
 * Barre de mesure : ce que le canvas sait dire sans passer par Chromium.
 *
 * Voir measure.ts pour ce que cette mesure est, et surtout ce qu'elle n'est pas.
 * Elle est le cadran de l'editeur : elle reste lisible d'un coup d'oeil.
 */
export function Metrics({ metrics, zone }: { metrics: CanvasMetrics; zone: string }) {
  const bar = "text-muted-foreground ml-auto flex flex-wrap items-baseline gap-2";

  if (metrics === null) {
    return <span className={cn(bar, "opacity-60")}>mesure du canvas…</span>;
  }

  if (metrics.kind === "band") {
    const over = metrics.usedMm - metrics.reservedMm;
    return (
      <span className={bar}>
        <strong className="text-foreground">
          <Dimension value={metrics.usedMm.toFixed(1)} unit="mm" />
        </strong>{" "}
        occupés sur <Dimension value={metrics.reservedMm} unit="mm" /> réservés
        {over > 0.4 ? (
          <BadgeStatus status="red">
            <Dimension value={over.toFixed(1)} unit="mm" />{" "}
            masqués à l&apos;impression
          </BadgeStatus>
        ) : (
          <BadgeStatus status="green">tient dans la bande</BadgeStatus>
        )}
      </span>
    );
  }

  if (zone !== "body") return null;

  return (
    <span className={bar}>
      <strong className="text-foreground">
        {/* Un bloc « absent du PDF » occupe de la place a l'ecran et aucune a
            l'impression : l'estimation est alors approchee, et le dit. */}
        {metrics.voids > 0 ? "≈ " : ""}
        {metrics.pages} page{metrics.pages > 1 ? "s" : ""}
      </strong>
      <span>
        dernière page remplie à <Dimension value={metrics.lastPageFill} unit="%" /> ·{" "}
        <Dimension value={metrics.usedMm.toFixed(0)} unit="mm" /> de contenu pour{" "}
        <Dimension value={metrics.contentMm} unit="mm" /> par page
      </span>
      {metrics.splits.length > 0 ? (
        <BadgeStatus status="amber">
          {metrics.splits
            .map((split) => `« ${split.label} » coupé entre les pages ${split.page} et ${split.page + 1}`)
            .join(" · ")}
        </BadgeStatus>
      ) : null}
      {metrics.voids > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* tabIndex : l'explication doit aussi s'atteindre au clavier. */}
            <Badge variant="outline" tabIndex={0} className="text-muted-foreground cursor-help">
              {metrics.voids} bloc(s) absent(s) du PDF
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Ces blocs occupent de la place à l&apos;écran mais aucune dans le PDF : la mesure les
            compte, l&apos;aperçu PDF non.
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

/**
 * Variables disponibles, groupees, avec copie au clic.
 *
 * La liste vient de src/lib/variables.ts, partagee avec GET /api/v1/schema pour
 * que l'editeur et l'aide du back-office ne puissent pas decrire deux contrats
 * differents.
 */
export function VariablesPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  const groups = VARIABLES.reduce<Record<string, typeof VARIABLES>>((into, variable) => {
    (into[variable.group] ??= []).push(variable);
    return into;
  }, {});

  return (
    <div className={PANEL}>
      <p className="text-muted-foreground mb-3 text-sm">
        Cliquer sur un token pour le copier, puis le coller dans un champ du panneau de droite.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-x-6 gap-y-4">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-muted-foreground mb-1.5 font-mono text-xs tracking-wider uppercase">{group}</h3>
            <ul>
              {items.map((variable) => (
                <li key={variable.token}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 px-1 py-0.5 text-left font-normal"
                    title={`Copier ${variable.token}`}
                    onClick={() => {
                      navigator.clipboard?.writeText(variable.token);
                      setCopied(variable.token);
                      window.setTimeout(() => setCopied(null), 1200);
                    }}
                  >
                    <code className="font-mono text-xs">{variable.token}</code>
                    <span className="text-muted-foreground min-w-0 truncate">{variable.label}</span>
                    {/* Une liste ne s'interpole pas dans une phrase : elle
                        alimente un bloc repete. Le signaler evite l'erreur
                        la plus courante. */}
                    {variable.kind === "list" ? (
                      <Badge variant="outline" className="text-muted-foreground px-1.5 py-0 font-normal">
                        liste
                      </Badge>
                    ) : null}
                    {copied === variable.token ? (
                      <strong className="ml-auto text-xs font-medium text-green-700 dark:text-green-400">
                        copié
                      </strong>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <ul className="text-muted-foreground mt-4 list-disc pl-4 text-sm">
        {VARIABLE_NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Controle avant publication : le template rendu sur chaque profil de donnees.
 *
 * C'est le seul tableau de l'editeur qui parle du CATALOGUE et non d'un produit.
 */
export function CheckPanel({ rows, onClose }: { rows: CheckRow[]; onClose: () => void }) {
  const cell = (row: CheckRow) => {
    if (row.state === "ok") return row.pages === null || row.pages === undefined ? "?" : `${row.pages}`;
    if (row.state === "error") return "—";
    return row.state === "running" ? "…" : "";
  };

  const head = "text-muted-foreground font-mono text-xs tracking-wider uppercase";

  return (
    <div className={PANEL}>
      <div className="text-muted-foreground mb-3 flex items-baseline gap-3 text-sm">
        <p>
          Le template rendu par le moteur de production sur chacun des {SAMPLE_PROFILES.length}{" "}
          profils. C&apos;est ce
          tableau qui dit si une fiche basculera sur une deuxième page pour les produits qui sortent de
          l&apos;ordinaire.
        </p>
        <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={onClose}>
          Masquer
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={head}>Profil</TableHead>
            <TableHead className={cn(head, "text-right")}>Pages</TableHead>
            <TableHead className={head}>Avertissements</TableHead>
            <TableHead className={cn(head, "text-right")}>Durée</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const meta = SAMPLE_PROFILES.find((entry) => entry.id === row.profile);
            return (
              <TableRow key={row.profile}>
                <TableCell className="max-w-96 align-top whitespace-normal">
                  <strong className="font-medium">{meta?.label}</strong>
                  <span className="text-muted-foreground block text-xs">{meta?.purpose}</span>
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{cell(row)}</TableCell>
                <TableCell className="align-top whitespace-normal">
                  {row.state === "error" ? (
                    <span className="text-destructive">{row.error}</span>
                  ) : row.warnings && row.warnings.length > 0 ? (
                    <ul className="list-disc pl-4 text-amber-700 dark:text-amber-400">
                      {row.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : row.state === "ok" ? (
                    "aucun"
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell className="text-right align-top">
                  {row.ms === undefined ? "" : <Dimension value={row.ms} unit="ms" />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Apercu PDF, pose A COTE du canvas et non par-dessus : on compare le rendu a la
 * composition sans perdre sa position d'edition.
 */
export function PreviewDock(props: {
  url: string | null;
  meta: PreviewMeta | null;
  busy: boolean;
  auto: boolean;
  full: boolean;
  downloadName: string;
  onAutoChange: (auto: boolean) => void;
  onToggleFull: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      className={cn(
        "bg-card flex flex-col",
        props.full ? "fixed inset-0 z-60" : "w-[44%] min-w-80 border-l",
      )}
      aria-label="Aperçu PDF"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
        <strong className="font-semibold">Aperçu PDF</strong>
        {props.busy ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <Spinner size="sm" className="text-primary" />
            rendu…
          </span>
        ) : null}
        {props.meta ? (
          <span className="text-muted-foreground">
            {props.meta.pages === null ? "? page" : `${props.meta.pages} page(s)`} ·{" "}
            {sampleProfileLabel(props.meta.profile)} ·{" "}
            <Dimension value={Math.round(props.meta.bytes / 1024)} unit="Ko" />
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <Checkbox
            id="ed-dock-auto"
            checked={props.auto}
            onCheckedChange={(checked) => props.onAutoChange(checked === true)}
          />
          <Label htmlFor="ed-dock-auto" className="text-muted-foreground font-normal">
            auto
          </Label>
        </div>
        <Button variant="outline" size="sm" onClick={props.onRefresh} disabled={props.busy}>
          Rafraîchir
        </Button>
        <Button variant="outline" size="sm" onClick={props.onToggleFull}>
          {props.full ? "Réduire" : "Plein écran"}
        </Button>
        {props.url ? (
          <Button asChild variant="outline" size="sm">
            <a href={props.url} download={props.downloadName}>
              Télécharger
            </a>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={props.onClose}>
          Fermer
        </Button>
      </div>

      {props.meta && props.meta.warnings.length > 0 ? (
        <ul className="max-h-24 list-disc overflow-y-auto border-b py-2 pr-3 pl-6 text-xs text-amber-700 dark:text-amber-400">
          {props.meta.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {props.url ? (
        <iframe title="Aperçu PDF" src={props.url} className="w-full flex-1 border-0" />
      ) : (
        <p className="text-muted-foreground m-0 flex flex-1 items-center justify-center text-sm">
          Aucun rendu pour l&apos;instant.
        </p>
      )}
    </aside>
  );
}
