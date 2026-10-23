import iconNodes from "lucide-static/icon-nodes.json";
import iconTags from "lucide-static/tags.json";
import type { IconMarkup } from "./iconTypes";

/**
 * La bibliotheque d'icones du Studio : le jeu Lucide (licence ISC), plus les
 * images de la bibliotheque /assets.
 *
 * SERVEUR UNIQUEMENT. Les dessins des 1 800 icones pesent pres d'un megaoctet :
 * importes dans un composant client, ils partiraient dans le JavaScript de chaque
 * page. Le navigateur ne recoit que les icones qu'il affiche, deja dessinees, par
 * /api/icons ou en propriete d'un composant serveur.
 *
 * UNE REFERENCE, DEUX FORMES, et c'est elle qui est stockee :
 *   lucide:<nom>                une icone du jeu integre
 *   /assets/<portee>/<cle>      une image de la bibliotheque (pictos Acme…)
 */

type IconNode = [string, Record<string, string>][];

const NODES = iconNodes as unknown as Record<string, IconNode>;
const TAGS = iconTags as unknown as Record<string, string[]>;

export const LUCIDE_PREFIX = "lucide:";
/** L'icone d'un intercalaire tant que personne n'en a choisi une. */
export const DEFAULT_ICON = "lucide:folder";

/**
 * Chaque segment commence par une lettre ou un chiffre : « .. » satisfaisait le
 * motif, et « /assets/../x » serait sorti de la bibliotheque une fois normalise.
 */
const ASSET_REF = /^\/assets\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;

export function isLucideRef(ref: string): boolean {
  return ref.startsWith(LUCIDE_PREFIX) && Object.prototype.hasOwnProperty.call(NODES, ref.slice(LUCIDE_PREFIX.length));
}

export function isAssetIconRef(ref: string): boolean {
  return ASSET_REF.test(ref);
}

/** Une reference que le Studio sait afficher — tout le reste est refuse a l'ecriture. */
export function isIconRef(ref: string): boolean {
  return isLucideRef(ref) || isAssetIconRef(ref);
}

/**
 * QUELQUES MOTS FRANCAIS, parce que les mots-cles de Lucide sont en anglais :
 * « chaise » ne trouverait rien. La liste couvre le vocabulaire des catalogues
 * du parc (mobilier, rangement, manutention) ; elle n'a pas a etre exhaustive,
 * le nom anglais reste cherchable.
 */
const FRENCH: Record<string, string[]> = {
  chaise: ["chair"],
  fauteuil: ["armchair", "chair"],
  siege: ["chair", "armchair"],
  canape: ["sofa"],
  bureau: ["desk", "office", "briefcase"],
  table: ["table"],
  lampe: ["lamp"],
  eclairage: ["lamp", "lightbulb"],
  armoire: ["cabinet", "archive", "box"],
  rangement: ["archive", "box", "package", "container"],
  casier: ["lock", "locker", "archive"],
  vestiaire: ["shirt", "lock", "user"],
  etagere: ["layers", "library", "shelf"],
  rayonnage: ["warehouse", "layers"],
  entrepot: ["warehouse"],
  atelier: ["wrench", "hammer", "factory"],
  outil: ["wrench", "hammer", "tool"],
  manutention: ["forklift", "truck", "package"],
  chariot: ["shopping-cart", "truck"],
  transport: ["truck"],
  carton: ["package", "box"],
  accueil: ["door-open", "hand", "users"],
  reunion: ["users", "presentation"],
  affichage: ["presentation", "panel-top", "monitor"],
  tableau: ["presentation", "clipboard"],
  ecran: ["monitor"],
  informatique: ["monitor", "laptop", "cpu"],
  securite: ["shield", "lock"],
  exterieur: ["trees", "sun", "tent"],
  jardin: ["trees", "flower"],
  cuisine: ["utensils", "coffee"],
  cafe: ["coffee"],
  sante: ["heart-pulse", "stethoscope"],
  ecole: ["school", "graduation-cap"],
  enfant: ["baby", "school"],
  accessoire: ["sparkles", "puzzle", "plus"],
  dossier: ["folder"],
  document: ["file-text"],
  livre: ["book", "book-open"],
  poubelle: ["trash"],
  signalisation: ["signpost", "triangle-alert"],
  garantie: ["shield-check", "badge-check"],
  promotion: ["percent", "tag"],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Les icones dont le nom, un mot-cle, ou un mot francais correspondent.
 *
 * Le nom d'abord, puis les mots-cles : chercher « chair » doit montrer « chair »
 * avant « sofa ».
 */
export function searchIcons(query: string, limit = 60): string[] {
  const needle = normalize(query);
  const names = Object.keys(NODES);
  if (needle === "") return names.slice(0, limit);

  const english = new Set<string>([needle]);
  for (const [french, words] of Object.entries(FRENCH)) {
    if (french.startsWith(needle) || needle.startsWith(french)) words.forEach((word) => english.add(word));
  }

  const byName: string[] = [];
  const byTag: string[] = [];
  for (const name of names) {
    if ([...english].some((word) => name.includes(word))) byName.push(name);
    else if ((TAGS[name] ?? []).some((tag) => [...english].some((word) => tag.includes(word)))) byTag.push(name);
  }
  return [...byName, ...byTag].slice(0, limit);
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Le SVG d'une icone Lucide, pret a inserer dans une page ou dans le HTML d'un
 * PDF. `currentColor` par defaut : l'icone prend la couleur du texte qui
 * l'entoure, donc celle de la boutique quand on la lui donne.
 *
 * Les attributs viennent du paquet, mais sont echappes quand meme : cette chaine
 * finit en innerHTML, et un echappement ne coute rien.
 */
export function lucideSvg(name: string, options: { size?: number; color?: string; strokeWidth?: number } = {}): string {
  const node = NODES[name];
  if (!node) return "";

  const size = options.size ?? 24;
  const children = node
    .map(
      ([tag, attributes]) =>
        `<${tag} ${Object.entries(attributes)
          .map(([key, value]) => `${key}="${escapeAttribute(String(value))}"`)
          .join(" ")}/>`
    )
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${escapeAttribute(options.color ?? "currentColor")}" stroke-width="${options.strokeWidth ?? 2}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`
  );
}

export function iconMarkup(ref: string | null | undefined, size = 24): IconMarkup {
  const chosen = ref && isIconRef(ref) ? ref : DEFAULT_ICON;
  if (isLucideRef(chosen)) {
    return { ref: chosen, svg: lucideSvg(chosen.slice(LUCIDE_PREFIX.length), { size }), src: null };
  }
  return { ref: chosen, svg: null, src: chosen };
}
