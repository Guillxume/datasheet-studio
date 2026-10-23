import { Card, CardContent, CardHeader, CardTitle } from "@guillxume/ui/components/card";
import ActivationForm from "./ActivationForm";
import StudioHead from "@/components/StudioHead";

export const dynamic = "force-dynamic";

/**
 * Une seule page pour l'invitation et la reinitialisation.
 *
 * Le jeton porte deja son type en base (table user_tokens) et c'est le serveur
 * qui le lit : la page n'a pas a le savoir. Le parametre `origine` ne sert donc
 * qu'au LIBELLE — « choisir votre mot de passe » a l'arrivee, « nouveau mot de
 * passe » a la reinitialisation. Le faire porter par l'URL plutot que par une
 * requete evite d'exposer une route qui dirait, jeton en main, si le compte
 * existe.
 *
 * LE JETON NE FAIT AUCUN ALLER-RETOUR AVANT LA SOUMISSION : il n'est verifie
 * qu'au moment ou le mot de passe est pose. Une page qui validerait le jeton a
 * l'affichage le consommerait a chaque prechargement de lien fait par un client
 * de messagerie — panne classique et difficile a reproduire.
 */
export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string; origine?: string }>;
}) {
  const { jeton, origine } = await searchParams;

  return (
    <>
      <StudioHead title="Activation du compte" />

      {jeton ? (
        <ActivationForm token={jeton} invitation={origine !== "oubli"} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              Lien incomplet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Ce lien ne porte pas de jeton. Reprendre celui reçu par courriel, en entier, ou en
              demander un nouveau depuis{" "}
              <a className="text-primary underline underline-offset-4" href="/mot-de-passe-oublie">
                Mot de passe oublié
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
