import { requirePage } from "@/lib/guard";
import { listUsers } from "@/lib/users";
import StudioHead from "@/components/StudioHead";
import ComptesClient, { type UserView } from "./ComptesClient";

export const dynamic = "force-dynamic";

export default async function ComptesPage() {
  const moi = await requirePage("admin:users");
  const users = await listUsers();

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Comptes" />

      <p className="text-muted-foreground mb-4">
        {users.length}{" "}compte(s). Les accès s&apos;ouvrent par invitation : le mot de passe est
        choisi par la personne, jamais transmis.
      </p>

      <ComptesClient initial={users as UserView[]} moi={{ id: moi.id, role: moi.role }} />
    </main>
  );
}
