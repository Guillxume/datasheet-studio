import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import ConnexionForm from "./ConnexionForm";
import StudioHead from "@/components/StudioHead";
import { safeSuite } from "@/lib/suite";

export const dynamic = "force-dynamic";

// `suite` : le chemin d'ou l'on venait, repose par le portail. Valide par
// safeSuite, voir src/lib/suite.ts.

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const user = await currentUser();
  const { suite } = await searchParams;

  // Deja connecte : la page de connexion n'a plus de sens, et la laisser
  // accessible produit des sessions doubles quand on revient dessus par
  // l'historique.
  if (user) {
    redirect(safeSuite(suite));
  }

  // Le layout (auth) pose deja le <main> et la colonne centree.
  return (
    <>
      <StudioHead title="Connexion" />

      <ConnexionForm suite={safeSuite(suite)} />

      <p className="text-muted-foreground mt-4 text-sm">
        Les accès sont ouverts par un administrateur du Studio, qui envoie un lien d&apos;activation
        par courriel.
      </p>
    </>
  );
}
