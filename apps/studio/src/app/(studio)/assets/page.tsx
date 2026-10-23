import { requirePage } from "@/lib/guard";
import { listShops } from "@/lib/repository";
import { can } from "@/lib/roles";
import AssetManager from "./AssetManager";
import StudioHead from "@/components/StudioHead";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  // assets:read et non assets:write : un importateur doit pouvoir verifier
  // qu'un picto attendu par un template existe bien, sans pouvoir l'ecraser.
  const user = await requirePage("assets:read");
  const shops = await listShops();

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Bibliothèque d'images" />
      <p className="text-muted-foreground mb-4">
        Pictos de badges, logos et icônes utilisés par les blocs, et les polices déclarées dans la
        feuille de style des templates (woff2 de préférence). Remplace les fichiers qui étaient
        dupliqués dans <code className="bg-muted px-1 font-mono text-xs">assets/img/icons/{"{01..05}"}/</code>
        {" "}de l&apos;ancien module.
      </p>

      <AssetManager shops={shops} canWrite={can(user.role, "assets:write")} />
    </main>
  );
}
