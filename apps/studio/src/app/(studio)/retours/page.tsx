import { Card, CardContent } from "@guillxume/ui/components/card";
import { isFeedbackActive } from "@/lib/feedbackSettings";
import { requirePage } from "@/lib/guard";
import StudioHead from "@/components/StudioHead";
import RetoursForm from "./RetoursForm";

export const dynamic = "force-dynamic";

/**
 * Un retour part au super-administrateur par courriel, avec un lien pour en
 * faire un ticket Linear s'il y a lieu (voir buildFeedbackMail dans
 * src/lib/mailer.ts).
 *
 * LA BASCULE SE REVERIFIE ICI. SectionBar retire deja le lien de la barre de
 * sections quand le reglage est eteint (voir sections.ts), mais cela ne
 * protege rien — une personne qui a l'URL peut arriver directement.
 */
export default async function RetoursPage() {
  await requirePage("feedback:send");
  const active = await isFeedbackActive();

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Retours" />

      {active ? (
        <RetoursForm />
      ) : (
        <Card className="max-w-xl">
          <CardContent>
            <p>Les retours ne sont pas activés sur cette instance pour le moment.</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
