import { requirePage } from "@/lib/guard";
import { listShops } from "@/lib/repository";
import { categoryTree, hiddenDatasheets } from "@/lib/datasheetsStore";
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
import SectionHead from "@/components/SectionHead";
import CategoriesClient from "./CategoriesClient";
import FichesMasqueesClient from "./FichesMasqueesClient";

/**
 * Categories et fiches masquees de la consultation, boutique par boutique
 * (migrations 014 et 015).
 *
 * Demande : « certaines categories n'ont pas de fiches ou ne sont pas finies, on
 * ne veut pas que les commerciaux puissent les voir ou les mettre dans des
 * books ». Reserve a l'administration (consultation:configure). Le masquage vaut
 * pour TOUS les comptes et pour tous les chemins — liste, zip, book : voir
 * src/lib/datasheetsStore.ts et la migration 014.
 */

export const dynamic = "force-dynamic";

export default async function MasquagePage({ searchParams }: { searchParams: Promise<{ boutique?: string }> }) {
  await requirePage("consultation:configure");

  const params = await searchParams;
  const shops = await listShops();
  const shop = shops.find((item) => item.slug === params.boutique) ?? (shops.length === 1 ? shops[0] : undefined);
  const [nodes, fiches] = shop
    ? await Promise.all([categoryTree(shop.slug), hiddenDatasheets(shop.slug)])
    : [[], []];

  return (
    <main className="mx-auto w-full max-w-4xl">
      <StudioHead title="Catégories et fiches masquées" />

      <p className="text-muted-foreground mb-6 max-w-prose text-sm">
        Une catégorie ou une fiche masquée disparaît de la consultation pour tous les comptes : elle ne
        s&apos;affiche plus, et ne peut plus entrer ni dans un téléchargement groupé ni dans un book. Masquer une
        catégorie masque aussi ses sous-catégories. Rien n&apos;est supprimé : réafficher rend les fiches telles
        quelles.
      </p>

      {/* Formulaire GET, comme les reglages du book : le Select Radix nomme rend
          un <select> natif cache, qui porte « boutique » dans l'URL. */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="categories-boutique">Boutique</Label>
          <Select name="boutique" defaultValue={shop?.slug} required>
            <SelectTrigger id="categories-boutique" className="min-w-48">
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
        <Button asChild variant="link">
          <a href={shop ? `/consultation?boutique=${encodeURIComponent(shop.slug)}` : "/consultation"}>
            Retour à la consultation
          </a>
        </Button>
      </form>

      {shop ? <SectionHead title="Catégories" /> : null}
      {shop ? (
        nodes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune catégorie connue pour {shop.name} : les catégories apparaissent ici avec les fiches que la
            boutique génère.
          </p>
        ) : (
          <CategoriesClient shop={shop.slug} nodes={nodes} />
        )
      ) : null}

      {shop ? (
        <>
          <SectionHead title="Fiches masquées" aside={fiches.length > 0 ? String(fiches.length) : undefined} />
          <FichesMasqueesClient shop={shop.slug} fiches={fiches} />
        </>
      ) : null}
    </main>
  );
}
