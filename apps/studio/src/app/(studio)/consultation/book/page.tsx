import { requirePage } from "@/lib/guard";
import { listShops } from "@/lib/repository";
import { datasheetsBySelection } from "@/lib/datasheetsStore";
import { listBookPages } from "@/lib/bookPagesStore";
import { parseSelection, selectionValue, topCategory, usableUrl } from "@/lib/datasheets";
import { MAX_BOOK_DATASHEETS } from "@/lib/book";
import { can } from "@/lib/roles";
import { env } from "@/lib/env";
import { shopErpEntities } from "@/lib/shopsAdmin";
import StudioHead from "@/components/StudioHead";
import BookEditor, { type BookCover, type BookDivider } from "./BookEditor";

/**
 * Le generateur de book : on y arrive depuis /consultation, avec les fiches
 * cochees dans l'URL (formulaire GET : une selection se recharge et se partage).
 *
 * COUVERTURES ET INTERCALAIRES SONT DESSINES A PART, poses par le
 * super-administrateur dans les reglages du book. Ici, on choisit les
 * couvertures parmi celles de la boutique, si les intercalaires s'impriment,
 * l'ordre des fiches et sous quel intercalaire une fiche se range.
 */

export const dynamic = "force-dynamic";

const imageUrl = (shop: string, id: string, version: string) =>
  `/api/book/pages/image?boutique=${encodeURIComponent(shop)}&id=${id}&v=${encodeURIComponent(version)}`;

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ boutique?: string; fiche?: string | string[] }>;
}) {
  const user = await requirePage("datasheets:read");

  const params = await searchParams;
  const shops = await listShops();
  const shop = shops.find((item) => item.slug === params.boutique);
  const values = ([] as string[]).concat(params.fiche ?? []);
  const selection = values.map((value) => parseSelection(value)).filter((item) => item !== null);

  if (!shop || selection.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl">
        <StudioHead title="Book" />
        <p className="text-muted-foreground text-sm">
          Un book se compose à partir de fiches cochées sur la page{" "}
          <a href="/consultation" className="text-primary underline underline-offset-4">
            Consultation
          </a>
          , ou importées d&apos;un devis par son bouton <strong>Import produits</strong>.
        </p>
      </main>
    );
  }

  const [rows, pages, erpEntities] = await Promise.all([
    datasheetsBySelection(shop.slug, selection),
    listBookPages(shop.slug),
    shopErpEntities(shop.slug),
  ]);

  const fiches = rows
    .filter((row) => usableUrl(row.datasheet_url) !== null)
    .map((row) => ({
      value: selectionValue(row.locale, row.product_key),
      name: row.product_name,
      productId: row.product_id ?? row.product_key,
      category: topCategory(row.category_path),
    }));

  const version = (page: { updated_at: string | Date }) => new Date(page.updated_at).getTime().toString(36);
  const dividers: BookDivider[] = pages
    .filter((page) => page.kind === "intercalaire")
    .map((page) => ({
      id: page.id,
      title: page.title ?? "",
      categories: page.categories,
      image: imageUrl(shop.slug, page.id, version(page)),
    }));
  // Dans l'ordre des reglages : la premiere est proposee par defaut.
  const coversOf = (kind: "couverture" | "quatrieme"): BookCover[] =>
    pages
      .filter((page) => page.kind === kind)
      .map((page) => ({ id: page.id, title: page.title ?? "", image: imageUrl(shop.slug, page.id, version(page)) }));

  return (
    <main className="mx-auto w-full max-w-[86rem]">
      <StudioHead title="Book" />
      <BookEditor
        shop={shop.slug}
        fiches={fiches}
        dividers={dividers}
        covers={coversOf("couverture")}
        backs={coversOf("quatrieme")}
        max={MAX_BOOK_DATASHEETS}
        ignored={values.length - fiches.length}
        canConfigure={can(user.role, "book:configure")}
        // Le devis par sa reference : seulement si le Studio connait l'ERP ET
        // l'entite de cette boutique. Sinon, le PDF televerse reste seul.
        erp={env.erp === null ? "absent" : erpEntities.length === 0 ? "sans-entite" : "pret"}
      />
    </main>
  );
}
