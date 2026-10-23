/**
 * La colonne « Caracteristiques (Nom:Valeur:Position) » des exports PrestaShop.
 *
 *   Gamme:Panneaux:3,Hauteur bureau (cm):75:10,Garantie (ans):5:170
 *
 * Sans elle, une fiche TECHNIQUE sort sans aucune caracteristique : c'est le
 * format dans lequel arrive le coeur du document, et aucune convention de
 * colonnes ne peut le remplacer puisque les caracteristiques varient d'un
 * produit a l'autre.
 *
 * LE PIEGE, ET IL EST MESURE. Le separateur d'enregistrements est la virgule,
 * et PrestaShop n'echappe RIEN : une valeur qui contient une virgule casse le
 * decoupage naif. Sur l'export de 1042 produits qui a servi de reference, 648
 * fragments sur 6557 — un sur dix — sont des morceaux a recoller :
 *
 *   "Epaisseur plateau (cm):2" + "5:25"          -> valeur "2,5", pas "2"
 *   "Option:Voile de fond 2 cm" + " H. 40 cm:116" -> une seule option
 *
 * D'ou l'accumulation ci-dessous plutot qu'un `split(",")`. On recolle les
 * fragments jusqu'a retrouver la FORME complete `Nom:Valeur:Position`, ce qui
 * leve l'ambiguite dans le bon sens : "Epaisseur plateau (cm):2" ne porte qu'un
 * seul deux-points, donc n'est pas un enregistrement, donc appelle la suite.
 *
 * Ce que cette heuristique ne sait PAS faire, et il faut le dire : une valeur
 * qui contient a la fois une virgule ET un deux-points suivi de chiffres
 * ("Horaires:9:00, 14:00:12") reste ambigue. Le format lui-meme l'est ; seul un
 * export corrige a la source le serait.
 *
 * VIT DANS src/lib ET NON DANS collectors/csv : la page d'import applique la
 * meme analyse quand une colonne est mappee sur `features`. Le collecteur CSV
 * l'importe par "@/lib/featureColumn". Module pur, sans node:*.
 */

/**
 * Ce que l'analyse produit : un nom et une valeur, rien de plus.
 *
 * Ni `abbreviation` ni `group` — le format PrestaShop ne les porte pas, et le
 * type est volontairement plus etroit que `featureSchema` pour le dire. Il est
 * structurellement compatible avec le `FeatureInput` des collecteurs, qui ne
 * declare ces deux champs qu'en option.
 */
export type ParsedFeature = { name: string; value: string };

/** Non gourmand a gauche, gourmand au milieu : la position est le dernier bloc. */
const RECORD = /^(.+?):([\s\S]*):(\d+)$/;

export type FeatureColumnOptions = {
  separator?: string;
  /** PrestaShop repete une caracteristique par valeur (4 dimensions de plateau). */
  merge?: boolean;
};

export function parseFeatureColumn(raw: string, options: FeatureColumnOptions = {}): ParsedFeature[] {
  const separator = options.separator ?? ",";
  const parsed: Array<{ name: string; value: string; position: number }> = [];
  let buffer = "";

  for (const fragment of raw.split(separator)) {
    buffer = buffer === "" ? fragment : `${buffer}${separator}${fragment}`;
    const match = buffer.match(RECORD);
    if (!match) continue;
    parsed.push({ name: match[1].trim(), value: match[2].trim(), position: Number(match[3]) });
    buffer = "";
  }

  // Reste sans position : PrestaShop l'omet parfois. Deux parties valent
  // Nom:Valeur ; en dessous, il n'y a rien a en tirer.
  const rest = buffer.trim();
  if (rest !== "") {
    const cut = rest.indexOf(":");
    if (cut > 0) {
      parsed.push({
        name: rest.slice(0, cut).trim(),
        value: rest.slice(cut + 1).trim(),
        // Sans position, on renvoie en fin de tableau plutot qu'en tete.
        position: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const kept = parsed.filter((feature) => feature.name !== "" && feature.value !== "");
  // Tri stable sur la position : c'est l'ordre voulu en back-office, et c'est
  // la seule information d'ordre que porte l'export.
  kept.sort((a, b) => a.position - b.position);

  return options.merge === false ? kept.map(strip) : merge(kept).map(strip);
}

/**
 * Une caracteristique repetee devient une ligne a valeurs multiples.
 *
 * PrestaShop exporte "Dimension du plateau (cm)" quatre fois, une par valeur.
 * Rendues telles quelles, ce sont quatre lignes identiques a gauche dans le
 * tableau de la fiche — ce qui se lit mal et mange la place qui manque deja.
 */
function merge(features: Array<{ name: string; value: string; position: number }>) {
  const byName = new Map<string, { name: string; value: string; position: number }>();
  for (const feature of features) {
    const existing = byName.get(feature.name);
    if (!existing) {
      byName.set(feature.name, { ...feature });
      continue;
    }
    if (!existing.value.split(" / ").includes(feature.value)) {
      existing.value = `${existing.value} / ${feature.value}`;
    }
  }
  return [...byName.values()];
}

function strip({ name, value }: { name: string; value: string }): ParsedFeature {
  return { name, value };
}
