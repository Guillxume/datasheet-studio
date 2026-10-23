/**
 * Catalogue des profils de donnees d'exemple.
 *
 * Separe de src/lib/sampleData.ts, qui construit les jeux de donnees et se sert
 * de `Buffer` pour inliner ses images : ce module-ci est consomme par l'editeur,
 * cote NAVIGATEUR, ou `Buffer` n'existe pas.
 *
 * POURQUOI PLUSIEURS PROFILS. Un template valide sur le produit moyen casse sur
 * les quelques pour cent de produits qui sortent de l'ordinaire : quarante
 * caracteristiques au lieu de neuf, un nom sur trois lignes, aucune image. Sur un
 * parc de plus de mille fiches, ces fiches-la ne sont pas relues une par une —
 * elles sont generees en masse et publiees. Le seul moment ou le probleme peut
 * encore etre vu est la composition du template : l'editeur doit donc pouvoir
 * montrer les cas hostiles a la demande.
 */

export type SampleProfileId =
  | "typique"
  | "dense"
  | "minimal"
  | "sans-medias"
  | "vestiaire"
  | "siege"
  | "bureau";

export type SampleProfile = {
  id: SampleProfileId;
  /** Libelle court, affiche dans le selecteur de l'editeur. */
  label: string;
  /** Ce que ce profil est cense faire echouer. */
  purpose: string;
};

/** L'ordre est celui du selecteur : le cas courant, puis les cas hostiles. */
export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: "typique",
    label: "Typique",
    purpose: "Le produit moyen du catalogue : 9 caractéristiques, 5 visuels, un schéma.",
  },
  {
    id: "dense",
    label: "Dense (cas hostile)",
    purpose:
      "34 caractéristiques dont 4 doublons, nom sur trois lignes, description longue, 10 visuels. C'est ce profil qui fait basculer une fiche sur une deuxième page.",
  },
  {
    id: "minimal",
    label: "Minimal",
    purpose:
      "2 caractéristiques, un seul visuel, aucun schéma, aucun badge. Montre les trous laissés par les blocs qui s'effacent.",
  },
  {
    id: "sans-medias",
    label: "Sans médias",
    purpose:
      "Aucune image, aucun logo, aucun schéma. Le cas d'un produit fraîchement importé, plus courant qu'on ne le croit.",
  },
  /**
   * UN PROFIL PAR FAMILLE, et non un seul « produit configurable ».
   *
   * Composer la fiche des bureaux avec des donnees de vestiaire ne dit rien de
   * sa mise en page : le nombre de groupes de finitions, la longueur des
   * libelles et la forme du visuel different d'une famille a l'autre, et ce
   * sont precisement eux qui decident si la premiere page tient. Un fauteuil
   * declare trois groupes d'une seule valeur la ou un vestiaire en declare deux
   * dont un de quatre.
   */
  {
    id: "vestiaire",
    label: "Vestiaire",
    purpose:
      "Deux groupes de finitions dont quatre fermetures, quatre accessoires détaillés, un visuel légendé. Le produit type de la fiche vestiaire.",
  },
  {
    id: "siege",
    label: "Siège",
    purpose:
      "Trois groupes d'une seule valeur — dossier, assise, piètement — deux accessoires, un visuel légendé. Montre ce que devient le panneau de choix quand chaque groupe tient en une pastille.",
  },
  {
    id: "bureau",
    label: "Bureau",
    purpose:
      "Deux groupes de finitions dont des décors bois en texture, quatre options, un visuel large. Le seul profil qui éprouve le rendu d'une pastille en image plutôt qu'en aplat.",
  },
];

export const DEFAULT_SAMPLE_PROFILE: SampleProfileId = "typique";

export function isSampleProfileId(value: unknown): value is SampleProfileId {
  return SAMPLE_PROFILES.some((profile) => profile.id === value);
}

export function sampleProfileLabel(id: SampleProfileId): string {
  return SAMPLE_PROFILES.find((profile) => profile.id === id)?.label ?? id;
}
