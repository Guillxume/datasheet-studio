import { looksLikePdf } from "./datasheets";

/**
 * Le devis du client dans un book : un PDF joint a la demande, place a la fin,
 * avant la quatrieme de couverture. Module pur et sans dependance : la page du
 * book (BookEditor.tsx) refuse un mauvais fichier des qu'on le choisit, la route
 * (src/app/api/book/route.ts) refait le meme controle, avec la meme regle.
 *
 * IL N'EST PAS CONSERVE. Le Studio ne stocke aucun PDF (README) : le devis part
 * avec la demande, passe par le dossier temporaire du book, et disparait avec
 * lui. C'est l'onglet qui le garde, tant qu'il est ouvert, pour regenerer.
 *
 * PLUS TARD, L'ERP. Quand il saura rendre un devis par sa reference, la demande
 * portera cette reference au lieu du fichier : seule l'origine des octets
 * changera, pas ce qui en est fait ensuite.
 */

/** Au-dela, c'est un catalogue plutot qu'un devis — et il ferait attendre tout le book. */
export const MAX_QUOTE_BYTES = 20 * 1024 * 1024;

/**
 * Ce qui ne va pas dans le devis, ou null, d'apres sa taille et ses premiers
 * octets (`head` : quatre suffisent). Ne juge que ce qui se voit sans l'ouvrir :
 * un PDF protege par un mot de passe a la bonne signature, et seul Gotenberg le
 * revele — controle prealable dans la route.
 */
export function quoteProblem(size: number, head: Uint8Array): string | null {
  if (size === 0) return "Le devis est vide.";
  if (size > MAX_QUOTE_BYTES) return `Devis trop lourd : au plus ${MAX_QUOTE_BYTES / 1024 / 1024} Mo.`;
  if (!looksLikePdf(head)) return "Le devis n'est pas un PDF.";
  return null;
}
