import { notFound } from "next/navigation";
import { requirePage } from "@/lib/guard";
import { can } from "@/lib/roles";
import { getTemplateBySlug } from "@/lib/repository";
import { applicationTargets } from "@/lib/componentStore";
import StudioHead from "@/components/StudioHead";
import ApplyForm from "./ApplyForm";

/**
 * Appliquer un composant a l'en-tete ou au pied de plusieurs templates.
 *
 * Retour utilisateur : « on a cree des en-tetes et pieds sans composant, on
 * aimerait pouvoir tout remplacer facilement ». Les cibles et l'etat de leurs
 * zones sont lus ICI, cote serveur : la page s'affiche deja peuplee, sans route
 * de lecture a part. La logique : src/lib/componentApply.ts, componentStore.ts.
 */

export const dynamic = "force-dynamic";

export default async function ApplyComponentPage({ params }: { params: Promise<{ scope: string; slug: string }> }) {
  const user = await requirePage("templates:write");

  const { scope, slug } = await params;
  const component = await getTemplateBySlug(decodeURIComponent(slug), scope === "shared" ? null : decodeURIComponent(scope));
  if (!component || component.kind !== "component") notFound();

  const targets = await applicationTargets(component.id);

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title={`Appliquer « ${component.name} »`} />
      <p className="text-muted-foreground mb-5 max-w-prose text-sm">
        La zone choisie de chaque template coché est <strong className="text-foreground">remplacée</strong> par ce
        seul composant. Le changement est enregistré en brouillon ; le contenu actuel de la zone reste dans les
        versions précédentes du template.
        {component.shop_slug === null
          ? " Composant de bibliothèque : tous les templates peuvent le citer."
          : ` Composant de la boutique « ${component.shop_slug} » : seuls ses templates peuvent le citer.`}
      </p>
      <ApplyForm
        scope={scope}
        slug={component.slug}
        componentPublished={component.published_version}
        canPublish={can(user.role, "templates:publish")}
        targets={targets}
      />
    </main>
  );
}
