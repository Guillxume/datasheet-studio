/*
 * Classes partagees par le generateur de book (BookEditor.tsx) et ses reglages
 * (reglages/BookSettings.tsx) : une section ouverte par un filet plein, un
 * titre d'etiquette, une vignette.
 *
 * VIGNETTES AU FORMAT A4 (1 : 1,414) : couvertures et intercalaires sont des
 * pages entieres, les montrer recadrees tromperait sur ce qui s'imprimera.
 */
export const SECTION = "border-foreground mt-8 border-t-2 pt-3";
export const TITLE = "mb-1 font-mono text-xs font-medium tracking-wider uppercase";
export const THUMB = "bg-card aspect-[210/297] w-12 shrink-0 border object-cover";
export const THUMB_EMPTY = "bg-muted inline-block border-dashed";
/** La vignette des reglages, plus grande : on y juge l'image elle-meme. */
export const THUMB_LARGE = "w-[6.5rem]";
