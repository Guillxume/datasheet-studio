import { createHash } from "node:crypto";
import { renderRequestSchema, type RenderRequest } from "@/lib/payload";
import type { CollectedAsset, CollectedProduct, ShopInput } from "./types";

/**
 * Assemblage et validation LOCALE du payload, avant tout appel reseau.
 *
 * Le Studio repond 422 avec le chemin exact du champ fautif : la validation
 * locale n'apporte donc pas un meilleur diagnostic, elle apporte le moment. Sur
 * une generation de 4000 fiches dont le mapping se trompe de champ, elle
 * transforme 4000 allers-retours HTTP en un echec immediat au premier produit.
 *
 * C'est le MEME schema zod que celui de la route de rendu, importe et non
 * recopie : deux descriptions du contrat divergeraient.
 */

export class PayloadError extends Error {
  readonly issues: unknown;

  constructor(message: string, issues: unknown) {
    super(message);
    this.name = "PayloadError";
    this.issues = issues;
  }

  describe(): string {
    if (!Array.isArray(this.issues)) return this.message;
    const details = (this.issues as Array<{ path?: unknown[]; message?: string }>)
      .slice(0, 5)
      .map((issue) => `${(issue.path ?? []).join(".") || "(racine)"} : ${issue.message ?? "?"}`);
    return `${this.message} — ${details.join(" ; ")}`;
  }
}

export type AssembleInput = {
  product: CollectedProduct;
  template: string;
  locale: string;
  /** Boutique commune a toutes les fiches (--shop). La source peut la surcharger. */
  shop?: ShopInput;
  /** Fige le rendu sur une version precise, pour rejouer une fiche archivee. */
  version?: "published" | number;
};

export function assemblePayload(input: AssembleInput): RenderRequest {
  const { product, template, locale, shop, version } = input;

  const candidate = {
    template,
    version: version ?? "published",
    locale: product.locale ?? locale,
    data: {
      ...product.data,
      // La source gagne champ par champ : un CSV qui porte une colonne
      // shop.url doit pouvoir la faire primer sans redecrire la boutique.
      shop: mergeShop(shop, product.data.shop),
    },
  };

  const parsed = renderRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PayloadError(`payload invalide pour ${product.ref}`, parsed.error.issues);
  }
  return parsed.data;
}

/**
 * Fusion sur deux niveaux seulement, `colors` et `company` etant les seuls
 * sous-objets de la boutique. Une fusion profonde generique se tromperait sur
 * les tableaux et n'aurait ici rien de plus a resoudre.
 */
export function mergeShop(base: ShopInput | undefined, override: ShopInput | undefined): ShopInput {
  if (!base) return override ?? {};
  if (!override) return base;
  return {
    ...base,
    ...definedOnly(override),
    colors: { ...base.colors, ...definedOnly(override.colors ?? {}) },
    company: { ...base.company, ...definedOnly(override.company ?? {}) },
  };
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>;
}

/**
 * Cle de fraicheur : ce qui decide qu'une fiche deja rendue est encore bonne.
 *
 * Elle couvre le payload ENTIER — donc le template et la locale, pas seulement
 * les donnees produit — et l'empreinte de chaque piece jointe. Retoucher une
 * image sans toucher au produit doit perimer la fiche ; hacher le contenu des
 * images couterait une lecture complete du catalogue a chaque comparaison, d'ou
 * l'empreinte "taille+mtime" decidee par la source.
 *
 * Ce qu'elle NE couvre PAS, volontairement : la republication du template. Rien
 * dans le payload ne change quand une nouvelle version est publiee — c'est la
 * comparaison de version, tenue par le journal, qui s'en charge.
 */
export function freshnessKey(payload: RenderRequest, assets: readonly CollectedAsset[] = []): string {
  const hash = createHash("sha256");
  hash.update(stableStringify(payload));
  for (const asset of [...assets].sort((a, b) => a.key.localeCompare(b.key))) {
    hash.update(` ${asset.key} ${asset.fingerprint}`);
  }
  return hash.digest("hex").slice(0, 32);
}

/**
 * JSON a ordre de cles stable. `JSON.stringify` suit l'ordre d'insertion : deux
 * mappings equivalents produiraient deux empreintes differentes, et tout le
 * catalogue serait regenere au premier changement d'ordre des colonnes.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}
