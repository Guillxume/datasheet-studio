import { requirePage } from "@/lib/guard";
import { listAllTemplates } from "@/lib/repository";
import { listShopsForAdmin } from "@/lib/shopsAdmin";
import StudioHead from "@/components/StudioHead";
import ImportWizard from "./ImportWizard";

/**
 * Import d'un catalogue depuis le Studio.
 *
 * La page ne fait que servir les deux listes qui viennent de la base — les
 * boutiques et les templates ; tout le reste se passe dans le navigateur, ou le
 * fichier est lu, mappe, valide, puis rendu fiche par fiche. Voir
 * ImportWizard.tsx.
 *
 * LES BOUTIQUES ARRIVENT AVEC LEURS REGLAGES, pas seulement leur nom. C'est ce
 * qui prealimente l'identite de la fiche — URL, couleurs, coordonnees — au lieu
 * de la faire resaisir a chaque import. Ces valeurs sont posees une fois par un
 * administrateur (/admin/boutiques) ; elles vivaient jusqu'ici dans un
 * collectors/shop.json a recopier sur chaque poste.
 *
 * LA PAGE EST PLUS LARGE QUE LES AUTRES (78rem, la mesure « mapping ») : la
 * table de correspondance a quatre colonnes dont deux selects ne tient pas dans
 * la mesure commune de 72rem. C'est la seule entorse, et elle est locale.
 */

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requirePage("import:run");

  const [allTemplates, shops] = await Promise.all([listAllTemplates(), listShopsForAdmin()]);
  // Les composants ne sont pas des modeles de fiche : ni une regle ni un import
  // ne peuvent en designer un.
  const templates = allTemplates.filter((row) => row.kind === "template");

  return (
    <main className="mx-auto w-full max-w-[78rem]">
      <StudioHead title="Importer un catalogue" />

      <p className="text-muted-foreground">
        Un fichier CSV ou JSON, une correspondance réglée à l&apos;écran, un template — et un ZIP de
        fiches en sortie.
      </p>

      <ImportWizard
        shops={shops
          .filter((shop) => shop.active)
          .map((shop) => ({ slug: shop.slug, name: shop.name, settings: shop.settings }))}
        templates={templates.map((row) => ({
          slug: row.slug,
          scope: row.shop_slug ?? "shared",
          name: row.name,
          published: row.published_version,
          draft: row.draft_version,
        }))}
      />
    </main>
  );
}
