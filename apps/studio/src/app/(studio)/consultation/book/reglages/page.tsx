import { requirePage } from "@/lib/guard";
import { listShops } from "@/lib/repository";
import { listBookPages } from "@/lib/bookPagesStore";
import { topCategories } from "@/lib/datasheetsStore";
import StudioHead from "@/components/StudioHead";
import { Button } from "@guillxume/ui/components/button";
import { Label } from "@guillxume/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import BookSettings, { type SettingsPage } from "./BookSettings";

/**
 * Reglages du book d'une boutique : premiere et quatrieme de couverture,
 * intercalaires et leurs images.
 *
 * RESERVE AU SUPER-ADMINISTRATEUR (book:configure) : ces pages engagent la
 * charte, une seule personne en decide. Le generateur les pose telles quelles.
 */

export const dynamic = "force-dynamic";

export default async function BookSettingsPage({ searchParams }: { searchParams: Promise<{ boutique?: string }> }) {
  await requirePage("book:configure");

  const params = await searchParams;
  const shops = await listShops();
  const shop = shops.find((item) => item.slug === params.boutique) ?? (shops.length === 1 ? shops[0] : undefined);

  const [pages, categories] = shop ? await Promise.all([listBookPages(shop.slug), topCategories(shop.slug)]) : [[], []];
  const imageUrl = (id: string, updated: string | Date) =>
    `/api/book/pages/image?boutique=${encodeURIComponent(shop!.slug)}&id=${id}&v=${new Date(updated).getTime().toString(36)}`;

  const settingsPages: SettingsPage[] = pages.map((page) => ({
    id: page.id,
    kind: page.kind,
    title: page.title ?? "",
    categories: page.categories,
    image: imageUrl(page.id, page.updated_at),
  }));

  return (
    <main className="mx-auto w-full max-w-[86rem]">
      <StudioHead title="Réglages du book" />

      {/* Formulaire GET : le Select Radix nomme rend un <select> natif cache,
          c'est lui qui porte « boutique » dans l'URL. Sans boutique choisie,
          `required` bloque l'envoi. */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="reglages-boutique">Boutique</Label>
          <Select name="boutique" defaultValue={shop?.slug} required>
            <SelectTrigger id="reglages-boutique" className="min-w-48">
              <SelectValue placeholder="Choisir une boutique" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Afficher</Button>
      </form>

      {shop ? <BookSettings shop={shop.slug} pages={settingsPages} categories={categories} /> : null}
    </main>
  );
}
