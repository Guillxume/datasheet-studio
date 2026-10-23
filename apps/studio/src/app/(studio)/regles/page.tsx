import { requirePage } from "@/lib/guard";
import { listAllTemplates } from "@/lib/repository";
import { listShops } from "@/lib/repository";
import StudioHead from "@/components/StudioHead";
import SectionHead from "@/components/SectionHead";
import ReglesClient from "./ReglesClient";

export const dynamic = "force-dynamic";

/**
 * Quel template pour quel produit.
 *
 * templates:write et non un droit d'administration : decider quel modele sert
 * quel produit est le meme geste que composer le modele. Un editeur le fait, un
 * importateur non.
 */
/** Code en ligne : un chemin, un en-tete, un extrait de payload. */
const CODE = "bg-muted px-1 font-mono text-xs";

export default async function ReglesPage() {
  await requirePage("templates:write");

  const [allTemplates, shops] = await Promise.all([listAllTemplates(), listShops()]);
  // Les composants ne sont pas des modeles de fiche : ni une regle ni un import
  // ne peuvent en designer un.
  const templates = allTemplates.filter((row) => row.kind === "template");

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Templates par catégorie" />

      <p className="text-muted-foreground mb-4">
        Un rayonnage complexe et un repose-pieds n&apos;ont pas les mêmes besoins de mise en page.
        Ces règles laissent une boutique servir plusieurs modèles selon la catégorie du produit, au
        lieu du plus petit dénominateur commun de son catalogue.
      </p>

      {shops.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune boutique active. Les règles sont propres à une boutique : en créer une depuis{" "}
          <code className={CODE}>/admin/boutiques</code>.
        </p>
      ) : (
        <ReglesClient
          shops={shops}
          templates={templates.map((row) => ({
            slug: row.slug,
            scope: row.shop_slug ?? "shared",
            name: row.name,
            published: row.published_version,
          }))}
        />
      )}

      <SectionHead title="Comment une boutique les utilise" />
      <p className="text-muted-foreground text-sm">
        Le module ou le connecteur envoie <code className={CODE}>&quot;template&quot;: &quot;auto&quot;</code>
        {" "}au lieu d&apos;un slug, et le Studio choisit. Un slug explicite continue de passer outre :
        c&apos;est ce qui permet de forcer un modèle pour une fiche précise. La réponse porte{" "}
        <code className={CODE}>X-Template-Slug</code>, à mettre dans la clé de cache côté boutique —
        sans quoi une règle modifiée ici ne se verrait nulle part.
      </p>
    </main>
  );
}
