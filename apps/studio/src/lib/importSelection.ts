import { csvRecord } from "./importMapping";
import { getPath } from "./mapping";

/**
 * Quelles lignes du catalogue entrent dans le lot.
 *
 * POURQUOI CE MODULE EXISTE. La fonction vivait dans le composant de la page
 * d'import, donc hors de portee de `pnpm test`. Or se tromper d'un indice ici,
 * c'est rendre 399 fiches sur 400 — ou en rendre 400 dont une de trop — sans
 * que rien ne le signale : le rapport de lot dit « 399 rendues, 0 echec », ce
 * qui a l'air parfait.
 *
 * Le format CSV et le format JSON sont traites par le meme chemin, et c'est
 * volontaire : le filtre doit se comporter a l'identique sur les deux, sinon la
 * meme regle donne deux lots differents selon le fichier fourni.
 */

export type Catalog =
  | { kind: "csv"; fileName: string; columns: string[]; rows: string[][] }
  | {
      kind: "json";
      fileName: string;
      columns: string[];
      items: unknown[];
      itemsPath: string;
      root: unknown;
    };

/** « Actif (0/1) = 1 », comme le --where du collecteur CSV. */
export type RowFilter = { column: string; value: string; negate: boolean };

/** Le nombre d'enregistrements, quel que soit le format. */
export function catalogSize(catalog: Catalog | null): number {
  if (catalog === null) return 0;
  return catalog.kind === "csv" ? catalog.rows.length : catalog.items.length;
}

/**
 * Les INDICES des lignes que le filtre garde, dans l'ordre du fichier.
 *
 * Des indices et non les lignes elles-memes : l'appelant s'en sert pour numeroter
 * la progression et pour rejouer un echec isole, ce qui demande de savoir OU la
 * ligne se trouvait dans le fichier d'origine.
 */
export function selectRows(catalog: Catalog | null, filter: RowFilter): number[] {
  if (catalog === null) return [];

  const all = Array.from({ length: catalogSize(catalog) }, (_, index) => index);
  if (filter.column === "") return all;

  return all.filter((index) => {
    const value =
      catalog.kind === "csv"
        ? csvRecord(catalog.columns, catalog.rows[index]).read(filter.column)
        : getPath(catalog.items[index], filter.column);

    /*
     * Une cellule vide vaut "" ici, et non « absente » : filtrer sur la valeur
     * vide est un usage legitime — « garder les lignes sans date de retrait ».
     *
     * Les deux cotes sont detrempes (`trim`), parce qu'un export de catalogue
     * porte regulierement des espaces de fin invisibles a l'oeil et qu'un
     * filtre qui echoue sur « 1 » contre « 1 » est indiagnosticable.
     */
    return (String(value ?? "").trim() === filter.value.trim()) !== filter.negate;
  });
}
