import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { attachFile, AssetError, isRemoteRef } from "../core/assets";
import { csvRecord, mapRecord, KNOWN_ROOTS, type MappingTable } from "@/lib/importMapping";
import { parseExpression } from "@/lib/mapping";
import type { CollectedAsset, CollectedProduct, FeatureInput, Source } from "../core/types";
import { streamCsvRows } from "@/lib/csv";

/**
 * Collecteur CSV : un export de catalogue -> des fiches PDF.
 *
 * LA CONVENTION, en une phrase : l'en-tete de colonne EST le chemin du champ
 * dans `data`.
 *
 *   product.name ; product.sku ; product.price.amount ; images.0.src
 *
 * Le choix se defend contre l'alternative evidente — deviner ("Reference" ->
 * `product.sku`, "Prix" -> `product.price.amount`). Une table d'alias se trompe
 * silencieusement : "Description" est-elle `description_html` ou
 * `description_short` ? La reponse change le rendu et rien ne signale l'erreur.
 * Un export qu'on ne maitrise pas se traite avec --mapping, ou la
 * correspondance est ECRITE quelque part et se relit.
 *
 * Quatre conveniences par-dessus, pour les formes que prennent les vrais exports :
 *
 *   feature:Capacite de charge      une colonne par caracteristique
 *   feature:Capacite de charge@Q    idem, avec la lettre de renvoi au schema
 *   features                        UNE colonne portant toute la liste, au
 *                                   format PrestaShop Nom:Valeur:Position
 *   badges / category_path          listes, separees par --list-sep (defaut |)
 *
 * Et le fichier long, quand les caracteristiques varient d'un produit a
 * l'autre : --features fichier.csv, colonnes ref;name;value;abbreviation;group.
 *
 * Une cible de --mapping peut porter une transformation, comme dans le
 * collecteur d'API : "Resume": "product.description_short | html2text". C'est
 * ce qui evite qu'un resume HTML n'imprime ses balises dans un champ que le
 * contrat declare comme du texte.
 *
 * CE FICHIER NE PORTE PLUS LA SEMANTIQUE DU MAPPING, seulement ce qui est
 * propre au CSV : lire le flux, resoudre l'en-tete, filtrer les lignes, joindre
 * les images du disque. Le passage « un enregistrement + une table -> les
 * donnees du contrat » vit dans src/lib/importMapping.ts, parce que la page
 * d'import du Studio l'applique aussi, dans le navigateur, sur le meme fichier
 * et avec le meme mapping. Deux implementations donneraient deux payloads, et
 * l'apercu montrerait autre chose que ce que le lot enverrait.
 */

export type CsvSourceOptions = {
  file: string;
  delimiter?: string;
  /** En-tete du fichier -> chemin dans `data`. Pour les exports subis. */
  mapping?: Record<string, string>;
  /** Colonne portant la reference stable. Defaut : ref, puis product.sku. */
  refColumn?: string;
  featuresFile?: string;
  /** Racine des chemins d'image relatifs. Defaut : le dossier du CSV. */
  assetsDir?: string;
  listSeparator: string;
  /** Une ligne dont une image manque echoue au lieu de perdre l'image. */
  strict: boolean;
  /**
   * Colonne portant toute la liste des caracteristiques au format PrestaShop.
   * Equivaut a mapper cette colonne sur le chemin "features".
   */
  featuresColumn?: string;
  /** Une caracteristique repetee devient une ligne a valeurs multiples. */
  mergeFeatures?: boolean;
  /**
   * Lignes a garder. Sans filtre, un export PrestaShop rend aussi les produits
   * desactives — 409 sur les 1042 de l'export qui a servi de reference.
   */
  filters?: RowFilter[];
};

export type RowFilter = { column: string; negate: boolean; value: string };

/** "Actif (0/1)=1" ou "Etat!=obsolete". */
export function parseFilter(expression: string): RowFilter {
  const negated = expression.includes("!=");
  const [column, ...rest] = expression.split(negated ? "!=" : "=");
  if (rest.length === 0) {
    throw new Error(`filtre attendu sous la forme "Colonne=valeur" — recu "${expression}"`);
  }
  return { column: column.trim(), negate: negated, value: rest.join(negated ? "!=" : "=").trim() };
}

export class CsvSource implements Source {
  readonly name: string;
  /** Lignes ecartees par --where. Lu par la commande pour le dire a l'ecran. */
  filtered = 0;
  /** Colonnes qui n'alimentent rien. Dites une fois, pas par produit. */
  readonly ignored: string[] = [];
  private readonly options: CsvSourceOptions;
  private readonly assetsDir: string;
  private features = new Map<string, FeatureInput[]>();

  constructor(options: CsvSourceOptions) {
    this.options = options;
    this.name = `csv ${options.file}`;
    this.assetsDir = options.assetsDir ?? dirname(resolve(options.file));
  }

  async *list(): AsyncIterable<CollectedProduct> {
    if (this.options.featuresFile) {
      this.features = await loadFeaturesFile(this.options.featuresFile, this.options.delimiter);
    }

    const stream = createReadStream(this.options.file, { encoding: "utf8" });
    let header: { headers: string[]; table: MappingTable } | null = null;
    let line = 1;

    for await (const row of streamCsvRows(stream, this.options.delimiter)) {
      if (header === null) {
        header = this.compileHeader(row);
        this.checkFilters(header.headers);
        continue;
      }
      line += 1;
      // Le filtre porte sur l'EN-TETE DU FICHIER, pas sur le chemin cible :
      // c'est le nom que l'utilisateur a sous les yeux dans son export.
      if (!this.keeps(header.headers, row)) {
        this.filtered += 1;
        continue;
      }
      yield await this.toProduct(header.headers, header.table, row, line);
    }
  }

  /**
   * L'en-tete -> la table de correspondance passee au mapping commun.
   *
   * Les en-tetes sont conserves POSITIONNELLEMENT a cote : les filtres et la
   * lecture des cellules travaillent par indice de colonne, la table par nom.
   */
  private compileHeader(row: string[]): { headers: string[]; table: MappingTable } {
    const mapping = this.options.mapping;
    const headers = row.map((cell) => cell.trim());
    const table: MappingTable = {};

    for (const header of headers) {
      if (header === "") continue;

      if (header === this.options.featuresColumn) {
        table[header] = "features";
        continue;
      }

      // Un --mapping est une LISTE BLANCHE : ce qui n'y figure pas n'a pas ete
      // choisi. C'est ce qui rend utilisable un export de 54 colonnes dont on
      // en veut 15, sans avoir a declarer les 39 autres.
      if (mapping) {
        const target = mapping[header];
        if (target === undefined) this.ignored.push(header);
        // Une cible de mapping peut porter des transformations, comme dans le
        // collecteur d'API : "Resume": "product.description_short | html2text".
        else table[header] = target;
        continue;
      }

      const { path } = parseExpression(header);
      if (path !== "" && !path.startsWith("feature:") && !KNOWN_ROOTS.has(path.split(".")[0])) {
        this.ignored.push(header);
        continue;
      }
      table[header] = header;
    }

    return { headers, table };
  }

  /**
   * Un filtre sur une colonne absente ecarterait TOUT en silence : mieux vaut
   * refuser de commencer, en nommant les colonnes disponibles.
   */
  private checkFilters(headers: string[]): void {
    for (const filter of this.options.filters ?? []) {
      if (!headers.includes(filter.column)) {
        throw new Error(
          `--where porte sur une colonne absente : "${filter.column}"\n` +
            `colonnes du fichier : ${headers.filter((h) => h !== "").join(", ")}`
        );
      }
    }
  }

  private keeps(headers: string[], row: string[]): boolean {
    for (const filter of this.options.filters ?? []) {
      const index = headers.indexOf(filter.column);
      const cell = (row[index] ?? "").trim();
      if ((cell === filter.value) === filter.negate) return false;
    }
    return true;
  }

  private async toProduct(
    headers: string[],
    table: MappingTable,
    row: string[],
    line: number
  ): Promise<CollectedProduct> {
    const assets: CollectedAsset[] = [];
    const warnings: string[] = [];
    const record = csvRecord(headers, row);
    const refTarget = this.options.refColumn ?? "ref";

    const mapped = await mapRecord(record, table, {
      listSeparator: this.options.listSeparator,
      mergeFeatures: this.options.mergeFeatures,
      refTarget,
      strict: this.options.strict,
      extraFeatures: this.longFeaturesFor(record, table, refTarget),
      fallbackRef: `ligne-${line}`,
      resolveImage: (raw) => this.resolveImage(raw, assets, warnings),
    });

    return {
      ref: mapped.ref,
      data: mapped.data as CollectedProduct["data"],
      assets,
      ...(mapped.template ? { template: mapped.template } : {}),
      ...(mapped.locale ? { locale: mapped.locale } : {}),
      ...(warnings.length + mapped.warnings.length > 0
        ? { warnings: [...warnings, ...mapped.warnings] }
        : {}),
    };
  }

  /**
   * Les caracteristiques du fichier long qui reviennent a cette ligne.
   *
   * La jointure se fait sur la valeur BRUTE de la colonne de reference, et non
   * sur la reference finale : le repli sur `product.sku` ou sur le numero de
   * ligne n'a aucun sens dans un fichier que l'utilisateur a lui-meme indexe
   * par reference.
   */
  private longFeaturesFor(
    record: ReturnType<typeof csvRecord>,
    table: MappingTable,
    refTarget: string
  ): FeatureInput[] {
    if (this.features.size === 0) return [];
    const source = Object.entries(table).find(
      ([, target]) => parseExpression(target).path === refTarget
    )?.[0];
    if (source === undefined) return [];
    const ref = record.read(source);
    return ref === undefined ? [] : (this.features.get(String(ref)) ?? []);
  }

  /**
   * Un chemin de fichier local devient une piece jointe ; une URL publique et
   * une reference asset:// traversent sans rien couter.
   *
   * C'est la difference entre les deux transports du contrat : joindre une image
   * deja servie par un CDN ferait transiter des octets pour rien, et laisser un
   * chemin local dans le payload donnerait une reference que Chromium ne sait
   * pas resoudre — refusee par le Studio, qui n'accepte ni file:// ni chemin nu.
   */
  private async resolveImage(
    raw: string,
    assets: CollectedAsset[],
    warnings: string[]
  ): Promise<string | undefined> {
    if (isRemoteRef(raw)) return raw;

    const path = isAbsolute(raw) ? raw : resolve(this.assetsDir, raw);
    try {
      const asset = await attachFile(path);
      // Deux lignes peuvent partager une image (un logo de gamme) : la meme cle
      // ne doit etre jointe qu'une fois par requete.
      if (!assets.some((existing) => existing.key === asset.key)) assets.push(asset);
      return `asset://${asset.key}`;
    } catch (cause) {
      const message =
        cause instanceof AssetError
          ? cause.message
          : `image introuvable : ${path} (relative a ${this.assetsDir})`;
      // Le --strict est applique par mapRecord, qui seul sait qu'une valeur
      // absente vient d'une image : l'avertissement est pose ici dans les deux
      // cas, parce qu'il nomme le chemin ABSOLU cherche, ce que le module
      // commun ignore.
      warnings.push(message);
      return undefined;
    }
  }
}

/**
 * Le fichier long des caracteristiques, charge d'un bloc.
 *
 * C'est le seul endroit qui ne soit pas en flux, et c'est un choix : joindre
 * deux flux demanderait qu'ils soient tries de la meme facon, ce qu'aucun export
 * ne garantit. Quelques dizaines de milliers de lignes de caracteristiques
 * tiennent en memoire ; le catalogue, lui, reste en flux.
 */
async function loadFeaturesFile(
  path: string,
  delimiter?: string
): Promise<Map<string, FeatureInput[]>> {
  const text = await readFile(path, "utf8");
  const rows = await collect(streamCsvRows(oneChunk(text), delimiter));
  const features = new Map<string, FeatureInput[]>();
  if (rows.length === 0) return features;

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const index = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  // Les noms de colonnes de CE fichier sont fixes par le collecteur, pas subis :
  // en accepter la version francaise n'est pas une devinette.
  const columns = {
    ref: index("ref", "reference", "sku"),
    name: index("name", "nom"),
    value: index("value", "valeur"),
    abbreviation: index("abbreviation", "abreviation", "abrev"),
    group: index("group", "groupe"),
  };
  if (columns.ref === -1 || columns.name === -1 || columns.value === -1) {
    throw new Error(
      `${path} : colonnes ref, name et value attendues — trouve : ${header.join(", ")}`
    );
  }

  for (const row of rows.slice(1)) {
    const ref = (row[columns.ref] ?? "").trim();
    const name = (row[columns.name] ?? "").trim();
    const value = (row[columns.value] ?? "").trim();
    if (ref === "" || name === "" || value === "") continue;

    const feature: FeatureInput = { name, value };
    const abbreviation = columns.abbreviation === -1 ? "" : (row[columns.abbreviation] ?? "").trim();
    const group = columns.group === -1 ? "" : (row[columns.group] ?? "").trim();
    if (abbreviation !== "") feature.abbreviation = abbreviation;
    if (group !== "") feature.group = group;

    const existing = features.get(ref);
    if (existing) existing.push(feature);
    else features.set(ref, [feature]);
  }
  return features;
}

async function* oneChunk(text: string): AsyncGenerator<string> {
  yield text;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}
