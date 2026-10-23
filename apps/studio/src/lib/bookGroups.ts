import { moveItem } from "./bookOrder";

/**
 * Le contenu d'un book : des groupes de fiches, chacun ouvert par un
 * intercalaire fixe (src/lib/bookPagesStore.ts), plus un groupe « a la suite »
 * sans intercalaire, toujours en dernier.
 *
 * Module pur et teste : c'est ici qu'une fiche peut se perdre ou se dupliquer
 * en silence quand on la deplace d'un groupe a l'autre.
 */

export type Divider = { id: string; title: string; categories: string[] };
export type GroupedFiche = { value: string; name: string; productId: string; category: string };
/** `dividerId` null : les fiches « a la suite », sans intercalaire. */
export type Group = { dividerId: string | null; fiches: GroupedFiche[] };

/**
 * Un groupe par intercalaire, dans l'ordre des intercalaires, puis le groupe
 * « a la suite ». Une fiche va sous l'intercalaire qui liste sa categorie ; sans
 * intercalaire, a la suite. Dans un groupe, par nom — l'ordre reste libre ensuite.
 *
 * Les groupes VIDES sont gardes : c'est la que l'on peut deplacer une fiche dont
 * la categorie n'a pas d'intercalaire (« Meuble d'accueil » sous « Accessoires »).
 */
export function initialGroups(fiches: GroupedFiche[], dividers: Divider[]): Group[] {
  const byCategory = new Map<string, string>();
  for (const divider of dividers) {
    for (const category of divider.categories) if (!byCategory.has(category)) byCategory.set(category, divider.id);
  }
  const sorted = [...fiches].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return [
    ...dividers.map((divider) => ({
      dividerId: divider.id as string | null,
      fiches: sorted.filter((fiche) => byCategory.get(fiche.category) === divider.id),
    })),
    { dividerId: null, fiches: sorted.filter((fiche) => !byCategory.has(fiche.category)) },
  ];
}

/** Deplace une fiche a la fin d'un autre groupe. */
export function moveToGroup(groups: Group[], value: string, target: string | null): Group[] {
  const fiche = groups.flatMap((group) => group.fiches).find((item) => item.value === value);
  if (!fiche || !groups.some((group) => group.dividerId === target)) return groups;
  return groups.map((group) => {
    const rest = group.fiches.filter((item) => item.value !== value);
    return group.dividerId === target ? { ...group, fiches: [...rest, fiche] } : { ...group, fiches: rest };
  });
}

/** Change l'ordre d'une fiche dans son groupe (glisser-deposer, fleches). */
export function reorderInGroup(groups: Group[], target: string | null, from: number, to: number): Group[] {
  return groups.map((group) => (group.dividerId === target ? { ...group, fiches: moveItem(group.fiches, from, to) } : group));
}

export function removeFiche(groups: Group[], value: string): Group[] {
  return groups.map((group) => ({ ...group, fiches: group.fiches.filter((item) => item.value !== value) }));
}

/**
 * Ce qui part au generateur : les groupes non vides, dans l'ordre. Un
 * intercalaire sans fiche n'est pas imprime — une section vide se lit comme une
 * erreur de mise en page.
 *
 * `skipped` : les intercalaires qu'on a choisi de ne pas imprimer. Leur section
 * garde sa place et l'ordre de ses fiches ; seule la page d'intercalaire saute —
 * trois fiches n'ont pas besoin d'une page de garde.
 */
export function bookSections(
  groups: Group[],
  skipped: ReadonlySet<string> = new Set()
): { divider: string | null; fiches: string[]; printDivider: boolean }[] {
  return groups
    .filter((group) => group.fiches.length > 0)
    .map((group) => ({
      divider: group.dividerId,
      fiches: group.fiches.map((fiche) => fiche.value),
      printDivider: group.dividerId === null || !skipped.has(group.dividerId),
    }));
}
