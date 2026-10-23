import { Badge } from "@guillxume/ui/components/badge";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/guard";
import { listAllTemplates, listShops, type TemplateRow } from "@/lib/repository";
import { can } from "@/lib/roles";
import { sectionsFor } from "@/lib/sections";
import SectionHead from "@/components/SectionHead";
import StudioHead from "@/components/StudioHead";
import TemplateActions from "@/components/TemplateActions";
import TemplateRowActions from "@/components/TemplateRowActions";

export const dynamic = "force-dynamic";

export default async function Home() {
  // templates:read et non templates:write : l'accueil est aussi la porte
  // d'entree de l'importateur, qui y choisit ce qu'il va previsualiser.
  //
  // Un role qui ne lit pas les templates (le commercial) arrive ici apres la
  // connexion — c'est la suite par defaut. On l'envoie sur sa premiere section
  // plutot que sur /acces-refuse, qui le renverrait... ici.
  const user = await requirePage();
  if (!can(user.role, "templates:read")) redirect(sectionsFor(user.role)[0]?.href ?? "/acces-refuse");
  const [rows, shops] = await Promise.all([listAllTemplates(), listShops()]);

  const canWrite = can(user.role, "templates:write");
  const scopeOf = (row: { shop_slug: string | null }) => row.shop_slug ?? "shared";

  // Deux listes, une table : un composant a le cycle de vie d'un template, mais
  // ce n'est pas un modele de fiche — le melanger a la liste des templates
  // laisserait croire qu'on peut l'attribuer a une boutique.
  const templates = rows.filter((row) => row.kind === "template");
  const components = rows.filter((row) => row.kind === "component");

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Bibliothèque de templates" />

      <div className="grid gap-4">
        {/* Le decompte des templates et des boutiques est grave sur la plaque
            d'identite : le repeter ici en gris n'ajoutait rien. Ne reste que ce
            qu'une plaque ne peut pas dire — quoi faire quand il n'y a rien. */}
        {templates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {canWrite
              ? "Aucun template. Lancer pnpm seed pour amorcer la base, ou en créer un ci-dessous."
              : "Aucun template pour l'instant."}
          </p>
        ) : null}

        <TemplateActions
          canWrite={canWrite}
          shops={shops}
          templates={templates.map((row) => ({ slug: row.slug, scope: scopeOf(row), name: row.name }))}
        />

        {templates.length > 0 ? <TemplateTable rows={templates} canWrite={canWrite} /> : null}
      </div>

      <SectionHead title="Composants" />
      <div className="grid gap-4">
        <p className="text-muted-foreground max-w-prose text-sm">
          Un composant — un pied de page, un bandeau de coordonnées — se compose une fois et se place dans
          plusieurs templates avec le bloc « Composant ». Le publier met à jour toutes les fiches des templates
          qui l&apos;utilisent. Un composant de boutique remplace, pour cette boutique, le composant de
          bibliothèque de même slug.
        </p>

        <TemplateActions
          canWrite={canWrite}
          shops={shops}
          kind="component"
          templates={components.map((row) => ({ slug: row.slug, scope: scopeOf(row), name: row.name }))}
        />

        {components.length > 0 ? <TemplateTable rows={components} canWrite={canWrite} /> : null}
      </div>
    </main>
  );
}

function TemplateTable({ rows, canWrite }: { rows: TemplateRow[]; canWrite: boolean }) {
  const scopeOf = (row: { shop_slug: string | null }) => row.shop_slug ?? "shared";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {/* Une seule colonne pour le nom et le slug : ils disent la meme chose
              a deux publics, et les separer poussait les actions au bord de l'ecran. */}
          <TableHead>Nom / slug</TableHead>
          <TableHead>Portée</TableHead>
          <TableHead>Publié</TableHead>
          <TableHead>Brouillon</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const scope = scopeOf(row);
          return (
            <TableRow key={`${scope}-${row.slug}`}>
              <TableCell>
                <span className="flex flex-col gap-0.5">
                  {row.name}
                  {/* Selectionnable d'un geste : c'est le slug qu'on vient copier. */}
                  <code className="text-muted-foreground font-mono text-xs select-all">{row.slug}</code>
                </span>
              </TableCell>
              <TableCell>
                {row.shop_slug ? (
                  <span className="font-mono text-xs">{row.shop_slug}</span>
                ) : (
                  <Badge variant="outline">bibliothèque</Badge>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {row.published_version === null ? <Badge variant="outline">aucune</Badge> : `v${row.published_version}`}
              </TableCell>
              <TableCell>
                {/* Distinguer les deux cas importe : un brouillon non publie
                    n'est servi a aucune boutique. */}
                {row.draft_version === 0 ? (
                  <Badge variant="outline">vide</Badge>
                ) : row.is_draft_published ? (
                  <BadgeStatus status="green">à jour</BadgeStatus>
                ) : (
                  <BadgeStatus status="amber">v{row.draft_version} non publiée</BadgeStatus>
                )}
              </TableCell>
              <TableCell>
                <TemplateRowActions
                  scope={scope}
                  slug={row.slug}
                  name={row.name}
                  canWrite={canWrite}
                  published={row.published_version}
                  kind={row.kind}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
