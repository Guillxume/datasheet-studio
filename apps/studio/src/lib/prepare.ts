import { isAssetRef, resolveImageRef, type AssetBag, type AssetMode } from "./assets";
import { sanitizeRichHtml } from "./html";

/**
 * Normalise le payload AVANT la liaison aux props des blocs.
 *
 * Deux transformations, faites ici une fois pour toutes plutot que dans chaque
 * bloc — les composants restent ainsi de simples fonctions de presentation :
 *
 *   1. "asset://cle" -> "./fichier.jpg" (ou data URI en mode inline)
 *   2. tout champ *_html -> assaini
 *
 * Les references d'assets introuvables sont ramenees a "" et signalees dans
 * `warnings` : un picto manquant ne doit pas faire echouer une fiche entiere,
 * mais doit rester visible dans les logs de rendu.
 */

export type PreparedData = {
  data: unknown;
  warnings: string[];
};

/**
 * Ajoute product.price.formatted a partir du montant brut.
 *
 * Le formatage est fait ICI et non par la boutique appelante, pour une raison
 * concrete : cote PrestaShop, Context::getCurrentLocale() renvoie null en CLI,
 * si bien qu'une fiche generee par le cron afficherait "349" quand la meme fiche
 * generee depuis le web afficherait "349,00 €". Le Studio, lui, recoit toujours
 * la locale dans le payload et dispose d'Intl : le resultat est identique quelle
 * que soit l'origine de la demande.
 */
function formatPrice(data: unknown, locale: string): void {
  if (data === null || typeof data !== "object") return;

  const price = (data as { product?: { price?: Record<string, unknown> } }).product?.price;
  if (!price || typeof price.amount !== "string" || price.amount === "") return;

  const amount = Number(price.amount);
  if (!Number.isFinite(amount)) return;

  const currency = typeof price.currency === "string" && price.currency !== "" ? price.currency : null;

  try {
    price.formatted = new Intl.NumberFormat(locale, {
      style: currency ? "currency" : "decimal",
      currency: currency ?? undefined,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Locale ou code devise inconnu : le montant brut reste exploitable, une
    // fiche ne doit pas echouer pour un probleme de formatage.
    price.formatted = currency ? `${price.amount} ${currency}` : price.amount;
  }
}

export function prepareData(data: unknown, bag: AssetBag, mode: AssetMode, locale = "fr"): PreparedData {
  const warnings: string[] = [];

  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "string") {
      if (isAssetRef(value)) {
        const resolved = resolveImageRef(value, bag, mode);
        if (resolved === null) {
          warnings.push(`asset introuvable a ${path} : ${value}`);
          return "";
        }
        return resolved;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => walk(item, `${path}[${index}]`));
    }

    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (key.endsWith("_html") && (typeof inner === "string" || inner === null || inner === undefined)) {
          out[key] = sanitizeRichHtml(inner as string | null | undefined);
          continue;
        }
        out[key] = walk(inner, path ? `${path}.${key}` : key);
      }
      return out;
    }

    return value;
  };

  const prepared = walk(data, "");
  formatPrice(prepared, locale);

  return { data: prepared, warnings };
}
