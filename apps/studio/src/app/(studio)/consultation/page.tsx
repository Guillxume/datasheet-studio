import { requirePage } from "@/lib/guard";
import { listShops } from "@/lib/repository";
import { categoryIcons, hiddenCategories, hiddenDatasheets, indexLocales, listDatasheets } from "@/lib/datasheetsStore";
import { MAX_SELECTION, parseSort, selectionValue, topCategory, usableUrl } from "@/lib/datasheets";
import { iconMarkup } from "@/lib/icons";
import type { IconMarkup } from "@/lib/iconTypes";
import { can } from "@/lib/roles";
import StudioHead from "@/components/StudioHead";
import { Button } from "@guillxume/ui/components/button";
import ConsultationClient from "./ConsultationClient";
import FiltersForm from "./FiltersForm";

/**
 * Consultation des fiches techniques d'une boutique.
 *
 * LA LISTE EST CELLE DE L'INDEX DU STUDIO (table datasheets), alimente a chaque
 * rendu : un produit jamais genere n'y figure pas. La page le dit, plutot que
 * de laisser croire a un catalogue complet.
 *
 * LE CHOIX DE LA BOUTIQUE ET LA RECHERCHE PASSENT PAR L'URL (formulaire GET,
 * FiltersForm.tsx) : une liste filtree se partage et se recharge telle quelle.
 */

export const dynamic = "force-dynamic";

function instant(value: string | Date): string {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ boutique?: string; q?: string; tri?: string }>;
}) {
  const user = await requirePage("datasheets:read");

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const sort = parseSort(params.tri);
  const shops = await listShops();
  // Une seule boutique : rien a choisir, la page l'ouvre directement.
  const shop = shops.find((item) => item.slug === params.boutique) ?? (shops.length === 1 ? shops[0] : undefined);
  const [rows, icons, locales] = shop
    ? await Promise.all([listDatasheets(shop.slug, query, sort), categoryIcons(shop.slug), indexLocales(shop.slug)])
    : [[], new Map<string, string>(), []];

  // Les categories masquees ne se signalent qu'a qui peut les gerer : pour les
  // autres comptes, elles n'existent simplement pas (migration 014).
  const canConfigure = can(user.role, "consultation:configure");
  const [hiddenCount, hiddenFiches] =
    shop && canConfigure
      ? await Promise.all([
          hiddenCategories(shop.slug).then((list) => list.length),
          hiddenDatasheets(shop.slug).then((list) => list.length),
        ])
      : [0, 0];
  const masques = [
    hiddenCount > 0 ? `${hiddenCount} catégorie${hiddenCount > 1 ? "s" : ""}` : null,
    hiddenFiches > 0 ? `${hiddenFiches} fiche${hiddenFiches > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  // Les icones des intercalaires sont dessinees ICI : le jeu complet ne doit pas
  // partir dans le JavaScript de la page (voir src/lib/icons.ts).
  const categoryMarkup: Record<string, IconMarkup> = {};
  for (const row of rows) {
    const category = topCategory(row.category_path);
    categoryMarkup[category] ??= iconMarkup(icons.get(category), 22);
  }

  return (
    <main className="mx-auto w-full max-w-[86rem]">
      <StudioHead title="Consultation des fiches" />

      {shops.length === 0 ? (
        <p className="text-muted-foreground mb-6 text-sm">
          Aucune boutique active. Les fiches sont rangées par boutique : en créer une depuis{" "}
          <code className="font-mono text-xs">/admin/boutiques</code>.
        </p>
      ) : (
        <FiltersForm shops={shops} current={shop?.slug ?? null} query={query} sort={sort} />
      )}

      {canConfigure && shop ? (
        <p className="text-muted-foreground -mt-2 mb-6 flex flex-wrap items-center gap-2 text-sm">
          {masques.length === 0
            ? "Rien de masqué pour cette boutique."
            : `Masqué : ${masques.join(" et ")} — invisibles ici pour tous les comptes.`}
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <a href={`/consultation/masquage?boutique=${encodeURIComponent(shop.slug)}`}>
              Gérer les catégories et fiches masquées
            </a>
          </Button>
        </p>
      ) : null}

      {shop ? (
        // Rendu meme sans resultat : la selection faite lors d'une recherche
        // precedente reste visible et envoyable (voir ConsultationClient).
        <ConsultationClient
          emptyMessage={
            query
              ? `Aucune fiche ne correspond à « ${query} » pour ${shop.name}.`
              : `Aucune fiche connue pour ${shop.name}. Une fiche apparaît ici après sa première génération par la boutique.`
          }
          shop={shop.slug}
          max={MAX_SELECTION}
          grouped={sort === "categorie"}
          icons={categoryMarkup}
          canEditIcons={can(user.role, "datasheets:write")}
          canHide={canConfigure}
          locales={locales.map((item) => item.locale)}
          rows={rows.map((row) => ({
            value: selectionValue(row.locale, row.product_key),
            productKey: row.product_key,
            productId: row.product_id ?? row.product_key,
            productName: row.product_name,
            locale: row.locale,
            url: usableUrl(row.datasheet_url),
            renderedAt: instant(row.rendered_at),
            category: topCategory(row.category_path),
            matchedRef: row.matched_supplier_sku
              ? { kind: "fournisseur", ref: row.matched_supplier_sku }
              : row.matched_variant_sku
                ? { kind: "déclinaison", ref: row.matched_variant_sku }
                : null,
          }))}
        />
      ) : null}

      <p className="text-muted-foreground mt-8 text-sm">
        Seuls les produits dont la fiche a déjà été générée au moins une fois sont listés : la génération
        en masse du module les couvre tous. Une fiche sans lien est connue du Studio, mais la boutique
        n&apos;a pas encore transmis son adresse publique (champ <code className="font-mono text-xs">product.datasheet_url</code>).
      </p>
    </main>
  );
}
