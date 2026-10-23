import { Heading } from "@guillxume/ui/components/heading";
import { cn } from "@guillxume/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Titre de page ou de section, ferme par un filet.
 *
 * LE DESIGNATEUR (`no`) rend la section citable — « le 02 est vide » plutot que
 * « le panneau de droite en haut ». Il est conseille des qu'un ecran porte plus
 * de deux sections, inutile en dessous.
 *
 * `aside` est pousse a droite : un decompte, une mesure. JAMAIS une action — les
 * actions ont leur rang a elles, sous le titre, et une action logee dans un
 * en-tete de section echappe a la lecture au clavier de la zone qu'elle modifie.
 */
export default function SectionHead({
  no,
  title,
  aside,
  as = "h2",
  level = "section",
}: {
  no?: string;
  title: string;
  aside?: ReactNode;
  /** « h1 » pour le titre de la page, pose par StudioHead. */
  as?: "h1" | "h2" | "h3";
  /** « panel » allege le filet : une sous-division, pas une section. */
  level?: "section" | "panel";
}) {
  const size = as === "h1" ? "2xl" : level === "panel" ? "base" : "lg";

  return (
    <div
      className={cn(
        "mb-4 flex items-baseline gap-3 border-b pb-2",
        as === "h1" ? "border-foreground mb-6" : level === "panel" ? "border-border" : "border-foreground/40 mt-8",
      )}
    >
      {no ? <span className="text-muted-foreground font-mono text-xs tabular-nums">{no}</span> : null}
      <Heading as={as} size={size}>
        {title}
      </Heading>
      {aside ? <span className="text-muted-foreground ml-auto text-sm tabular-nums">{aside}</span> : null}
    </div>
  );
}
