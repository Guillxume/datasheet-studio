import type { ReactNode } from "react";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Card } from "@guillxume/ui/components/card";
import { cn } from "@guillxume/ui/lib/utils";

/**
 * Un chiffre et ce qu'il mesure, en chasse fixe.
 *
 * `size="hero"` : LE chiffre de la vue, un seul par ecran, sans cadre. En tres
 * grand corps, la chasse fixe donne aux chiffres l'aspect d'un afficheur — ce
 * qu'on veut lire vite. Chiffres PROPORTIONNELS malgre tout : tabular-nums
 * donne a chaque chiffre la largeur d'un zero, ce qui fait flotter un grand
 * nombre isole. Les tuiles, elles, gardent tabular-nums.
 *
 * `state` colore un MOT (`stateLabel`, dans un BadgeStatus), jamais une
 * pastille seule : un rouge seul est illisible pour une partie des lecteurs,
 * et ambigu pour les autres — on ne sait pas s'il veut dire « eleve » ou
 * « mauvais ».
 */
export type MetricState = "good" | "warning" | "critical";

const STATUS = { good: "green", warning: "amber", critical: "red" } as const;

const LABEL = "text-muted-foreground m-0 font-mono text-xs tracking-wider uppercase";

export default function Metric({
  label,
  value,
  unit,
  note,
  state,
  stateLabel,
  size = "tile",
}: {
  label: ReactNode;
  value: ReactNode;
  /** Unite, posee en petit apres le chiffre. */
  unit?: string;
  note?: ReactNode;
  state?: MetricState;
  /** Le mot qui accompagne l'etat. Sans lui, `state` ne doit pas etre renseigne. */
  stateLabel?: ReactNode;
  size?: "hero" | "tile";
}) {
  const hero = size === "hero";
  const content = (
    <>
      <p className={LABEL}>{label}</p>
      <p
        className={cn(
          "mt-0.5 mb-0 font-mono font-medium",
          hero ? "text-[3.25rem] leading-none tracking-[-0.01em]" : "text-2xl leading-tight tabular-nums",
        )}
      >
        {value}
        {unit ? <span className="text-muted-foreground ml-[0.35em] text-[0.42em]">{unit}</span> : null}
      </p>
      {note ? <p className={cn(LABEL, "mt-2 tracking-wide")}>{note}</p> : null}
      {/*
       * `state && stateLabel`, PAS `stateLabel` SEUL — comportement du Tile()
       * qu'il remplace, et src/app/(studio)/journal/page.tsx en depend : la tuile
       * « Attente en file au p95 » passe TOUJOURS stateLabel="attente
       * sensible" mais `state` seulement quand le seuil est franchi. Rendre
       * stateLabel sans state afficherait cette annotation en permanence, sans
       * couleur — une annotation muette plutot qu'une vraie alerte.
       */}
      {state && stateLabel ? (
        <div className="mt-2 border-t pt-2">
          <BadgeStatus status={STATUS[state]} className="font-mono uppercase tracking-wide">
            {stateLabel}
          </BadgeStatus>
        </div>
      ) : null}
    </>
  );

  return hero ? <div className="mb-8">{content}</div> : <Card className="gap-0 px-3.5 py-3 shadow-none">{content}</Card>;
}
