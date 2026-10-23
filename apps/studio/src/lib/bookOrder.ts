/**
 * Deplacer un element d'une position a une autre (glisser-deposer, fleches).
 *
 * Module pur, teste (bookOrder.test.ts) : l'ordre d'un book se fait a la main,
 * et un deplacement qui perd ou duplique une fiche produirait un document
 * plausible et faux. Utilise par src/lib/bookGroups.ts.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to || from < 0 || from >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
