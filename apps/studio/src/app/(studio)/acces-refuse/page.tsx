import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent } from "@guillxume/ui/components/card";
import { currentUser } from "@/lib/guard";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import StudioHead from "@/components/StudioHead";

export const dynamic = "force-dynamic";

/**
 * Page de refus.
 *
 * ELLE DIT LE ROLE QU'ON A, et ce qu'il permet. Un « 403 » nu envoie la personne
 * demander a un administrateur ce qui lui manque ; ici, elle lit d'un coup
 * d'oeil qu'elle est importatrice et que la modification des templates ne lui
 * revient pas — l'echange qui suit porte alors sur le besoin, pas sur le
 * diagnostic.
 */
export default async function AccesRefusePage() {
  const user = await currentUser();

  return (
    <main className="mx-auto w-full max-w-md">
      <StudioHead title="Accès refusé" />

      <Card>
        <CardContent className="grid gap-4">
          {user ? (
            <>
              <p>
                Votre rôle est <strong>{ROLE_LABELS[user.role]}</strong>.
              </p>
              <p className="text-muted-foreground text-sm">{ROLE_DESCRIPTIONS[user.role]}</p>
              <p className="text-muted-foreground text-sm">
                Cette page demande une permission que ce rôle n&apos;a pas. Un administrateur du Studio
                peut la changer depuis la gestion des comptes.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/">Retour à l&apos;accueil</a>
                </Button>
              </div>
            </>
          ) : (
            <p>
              Session absente ou expirée.{" "}
              <a className="text-primary underline underline-offset-4" href="/connexion">
                Se reconnecter
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
