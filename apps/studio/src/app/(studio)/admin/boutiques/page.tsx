import { requirePage } from "@/lib/guard";
import { listShopsForAdmin } from "@/lib/shopsAdmin";
import StudioHead from "@/components/StudioHead";
import BoutiquesClient from "./BoutiquesClient";

export const dynamic = "force-dynamic";

export default async function BoutiquesPage() {
  await requirePage("admin:shops");
  const shops = await listShopsForAdmin();

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Boutiques" />

      <p className="text-muted-foreground mb-4">
        Une boutique est un site du parc : une clé API, des templates qui lui sont propres, et une
        identité visuelle qui arrive en donnée au rendu.{" "}
        <a href="/admin" className="text-primary underline underline-offset-4">
          Journal des actions
        </a>
      </p>

      <BoutiquesClient initial={shops} />
    </main>
  );
}
