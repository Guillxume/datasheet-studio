import { can, type Capability, type Role } from "./roles";

/**
 * LA NAVIGATION DU STUDIO, EN DONNEE.
 *
 * Elle vit ici et non dans le composant qui la dessine, pour deux raisons.
 *
 * PARCE QU'ELLE SE DEDUIT DES PERMISSIONS, et qu'une deduction se teste. Un
 * menu qui mene a un refus est un menu qui MENT : l'importateur qui voit
 * « Administration », clique et se fait renvoyer sur /acces-refuse apprend
 * qu'il ne faut pas se fier au menu — et ne se fiera plus a rien. Ce n'est PAS
 * une mesure de securite (chaque page revalide, voir src/lib/guard.ts), c'est
 * la condition pour que l'interface reste lisible. La regle est donc verrouillee
 * par sections.test.ts, ce qu'un JSX melant permissions et mise en forme
 * n'aurait pas permis.
 *
 * PARCE QUE LA CLEF DE SECTION EST UN CONTRAT ENTRE LES PAGES ET LA BARRE.
 * Chaque page declare la section ou elle se trouve (`active`), le typage
 * empeche d'en inventer une, et /admin/comptes sait ainsi allumer « ADMIN »
 * sans qu'aucune comparaison d'URL ne traine dans un composant.
 */

export type SectionKey =
  | "templates"
  | "regles"
  | "import"
  | "images"
  | "consultation"
  | "journal"
  | "documentation"
  | "retours"
  | "admin";

export type Section = {
  key: SectionKey;
  href: string;
  label: string;
  /** Une seule suffit : le lien apparait des que l'une est accordee. */
  needs: readonly Capability[];
};

export const SECTIONS: readonly Section[] = [
  { key: "templates", href: "/", label: "Templates", needs: ["templates:read"] },
  /*
   * « Regles » suit « Templates » : c'est le prolongement du meme travail —
   * composer un modele, puis dire a quels produits il s'applique.
   */
  { key: "regles", href: "/regles", label: "Règles", needs: ["templates:write"] },
  { key: "import", href: "/import", label: "Import", needs: ["import:run"] },
  { key: "images", href: "/assets", label: "Images", needs: ["assets:read"] },
  /*
   * « Consultation » avant « Journal » : on y vient voir les fiches qu'une
   * boutique publie, le journal dit comment leur production s'est passee.
   */
  { key: "consultation", href: "/consultation", label: "Consultation", needs: ["datasheets:read"] },
  { key: "journal", href: "/journal", label: "Journal", needs: ["journal:read"] },
  /*
   * Le mode d'emploi du Studio, pour ceux qui composent les templates et
   * televersent les pictos. Tous les roles sauf le commercial (docs:read).
   */
  { key: "documentation", href: "/documentation", label: "Documentation", needs: ["docs:read"] },
  /*
   * ACCORDEE A TOUS LES ROLES, LE COMMERCIAL COMPRIS (voir src/lib/roles.ts), mais ce n'est pas la
   * seule condition d'affichage : le super-administrateur peut eteindre la
   * page entiere depuis /admin. Cette bascule est un etat en base et non une
   * permission de role, donc elle ne peut pas vivre dans `needs` — SectionBar
   * retire ce lien quand le reglage est desactive. Voir StudioHead.tsx.
   */
  { key: "retours", href: "/retours", label: "Retours", needs: ["feedback:send"] },
  { key: "admin", href: "/admin", label: "Administration", needs: ["admin:users", "admin:shops"] },
];

export function sectionsFor(role: Role): readonly Section[] {
  return SECTIONS.filter((section) => section.needs.some((capability) => can(role, capability)));
}
