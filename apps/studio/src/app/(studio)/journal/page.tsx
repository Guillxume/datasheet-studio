import {
  JOURNAL_WINDOWS,
  purgeRenderLogsSiNecessaire,
  retentionDays,
  readByDay,
  readByTemplate,
  readFailures,
  readSummary,
  readUnmatchedCategories,
  readWarnings,
  resolveWindowHours,
} from "@/lib/journal";
import { requirePage } from "@/lib/guard";
import { renderLimiter } from "@/lib/renderQueue";
import { Badge } from "@guillxume/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { cn } from "@guillxume/ui/lib/utils";
import StudioHead from "@/components/StudioHead";
import SectionHead from "@/components/SectionHead";
import Metric from "./Metric";
import WindowSwitcher from "./WindowSwitcher";

/**
 * Journal des rendus de production.
 *
 * render_logs etait alimentee depuis le premier jour et personne ne la lisait.
 * Cette page repond aux quatre questions qu'on se pose vraiment sur un parc qui
 * genere en masse : est-ce que ca passe, qu'est-ce qui echoue, qu'est-ce qui rale,
 * et est-ce que le moteur suit.
 *
 * AUCUN GRAPHIQUE, et c'est un choix : des nombres de tete et des tableaux. Les
 * donnees sont soit une poignee de valeurs saillantes — donc des tuiles — soit des
 * listes a plus de sept entrees qui portent toutes du sens, donc des tableaux. Un
 * graphique n'y ajouterait rien de lisible.
 */

export const dynamic = "force-dynamic";

const nombre = new Intl.NumberFormat("fr-FR");
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

const secondes = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function duree(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${secondes.format(ms / 1000)} s` : `${nombre.format(ms)} ms`;
}

function poids(bytes: number | null): string {
  return bytes === null ? "—" : `${nombre.format(Math.round(bytes / 1024))} Ko`;
}

const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function taux(part: number, total: number): string {
  if (total === 0) return "—";
  if (part === 0) return "0 %";

  const value = (part / total) * 100;
  // Deux erreurs sur dix mille ne sont pas « 0,0 % » : arrondir a zero une valeur
  // non nulle donne exactement l'impression inverse de ce qu'on veut montrer.
  return value < 0.1 ? "< 0,1 %" : `${pourcent.format(value)} %`;
}

/** Instant, en heure locale du serveur. Les rendus sont dates en timestamptz. */
function instant(value: string): string {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

/*
 * Chiffres tabulaires DANS LES COLONNES seulement : c'est la qu'ils doivent
 * s'aligner verticalement.
 */
const NUM = "text-right tabular-nums";
const BAD = "text-destructive font-medium";
const WARN = "font-medium text-amber-700 dark:text-amber-400";
/*
 * Un message d'erreur de Chromium ou un chemin d'asset peut etre tres long : il
 * ne doit pas etirer la table hors de l'ecran.
 */
const EXAMPLE = "text-muted-foreground max-w-[28rem] whitespace-normal wrap-anywhere";
const CODE = "font-mono text-xs";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  await requirePage("journal:read");

  // Purge opportuniste des lignes perimees : voir src/lib/journal.ts. Elle ne
  // bloque pas l'affichage et n'echoue jamais vers cette page.
  purgeRenderLogsSiNecessaire();

  const hours = resolveWindowHours((await searchParams).h);

  const [summary, byTemplate, warnings, failures, byDay, sansRegle] = await Promise.all([
    readSummary(hours),
    readByTemplate(hours),
    readWarnings(hours),
    readFailures(hours),
    readByDay(hours),
    readUnmatchedCategories(hours),
  ]);

  const limiter = renderLimiter.stats;
  const failed = summary.errors + summary.saturated;

  return (
    <main className="mx-auto w-full max-w-[86rem]">
      <StudioHead title="Journal des rendus" />

      <WindowSwitcher
        value={hours}
        options={JOURNAL_WINDOWS.map((entry) => ({
          value: entry.hours,
          label: entry.label,
          href: `/journal?h=${entry.hours}`,
        }))}
      />

      {summary.total === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun rendu sur cette période. Le journal ne recense que les rendus de production
          (<code className={CODE}>POST /api/v1/render</code>) : les aperçus de l&apos;éditeur n&apos;y figurent pas.
        </p>
      ) : (
        <>
          {/* La figure principale : le volume. C'est le nombre qui situe tout le
              reste — un taux d'erreur de 2 % ne veut pas dire la meme chose sur
              40 rendus et sur 9 000. */}
          <section>
            <Metric
              size="hero"
              label="Fiches rendues"
              value={compact.format(summary.total)}
              note={
                <>
                  {nombre.format(summary.total)} rendus, dont {nombre.format(summary.with_warnings)} avec
                  avertissement
                </>
              }
            />
          </section>

          <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
            {/* Le seuil distingue l'incident isolé de la panne : deux erreurs sur
                dix mille rendus ne demandent pas la meme reaction que deux cents. */}
            <Metric
              label="Erreurs"
              value={nombre.format(summary.errors)}
              note={taux(summary.errors, summary.total)}
              state={
                summary.errors === 0
                  ? "good"
                  : summary.errors / summary.total >= 0.01
                    ? "critical"
                    : "warning"
              }
              stateLabel={
                summary.errors === 0
                  ? "aucune"
                  : summary.errors / summary.total >= 0.01
                    ? "à corriger"
                    : "à regarder"
              }
            />
            <Metric
              label="Refusés faute de place"
              value={nombre.format(summary.saturated)}
              note={taux(summary.saturated, summary.total)}
              state={summary.saturated === 0 ? "good" : "warning"}
              stateLabel={summary.saturated === 0 ? "aucun" : "plafond à revoir"}
            />
            <Metric label="Durée médiane" value={duree(summary.p50_ms)} note="p50" />
            <Metric label="Durée au p95" value={duree(summary.p95_ms)} note="19 rendus sur 20 en deçà" />
            <Metric
              label="Attente en file au p95"
              value={duree(summary.p95_queued_ms)}
              note={`maximum ${duree(summary.max_queued_ms)}`}
              state={
                summary.p95_queued_ms !== null && summary.p95_queued_ms > 2000 ? "warning" : undefined
              }
              stateLabel="attente sensible"
            />
            <Metric label="Poids moyen" value={poids(summary.avg_bytes)} note="par fiche" />
          </section>

          <p className="text-muted-foreground mb-8 border px-3.5 py-2 text-sm">
            Plafond de rendus simultanés : <strong className="text-foreground">{limiter.maxConcurrent}</strong>, file de{" "}
            <strong className="text-foreground">{limiter.maxQueued}</strong>. À cet instant : {limiter.active} en cours,{" "}
            {limiter.waiting} en attente.{" "}
            {summary.saturated > 0 ? (
              <>
                Des requêtes ont été refusées : soit relever <code className={CODE}>MAX_CONCURRENT_RENDERS</code>, soit
                réduire la concurrence de la génération en masse côté boutique.
              </>
            ) : null}
          </p>

          {/*
            LES CATEGORIES SANS REGLE — une alarme, pas une statistique.
            Les regles de template comparent des LIBELLES : une categorie
            renommee en back-office ne leve rien, les fiches retombent sur le
            defaut et sortent. Cette table est le seul endroit ou ca se voit.
            Elle n'apparait que s'il y a quelque chose a montrer.
          */}
          {sansRegle.length > 0 ? (
            <>
              <SectionHead as="h2" no="01" title="Catégories sans règle de template" />
              <p className="text-muted-foreground mb-4 text-sm">
                Ces fiches ont été rendues avec le <strong>template par défaut</strong>{" "}de leur
                boutique, aucune règle n&apos;ayant correspondu. Deux causes, et elles ne se
                corrigent pas au même endroit : la catégorie est nouvelle, ou elle a été{" "}
                <strong>renommée</strong>{" "}— auquel cas la règle existe mais ne s&apos;applique plus,
                sans que rien ne l&apos;ait signalé.{" "}
                <a href="/regles" className="text-primary underline underline-offset-4">
                  Écrire les règles
                </a>
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fil d&apos;Ariane</TableHead>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Rendu avec</TableHead>
                    <TableHead className={NUM}>Fiches</TableHead>
                    <TableHead>Dernière</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sansRegle.map((row, index) => (
                    <TableRow key={`${row.category_path}-${row.shop}-${index}`}>
                      <TableCell className="whitespace-normal">
                        {row.category_path ?? <Badge variant="outline">sans catégorie</Badge>}
                      </TableCell>
                      <TableCell>{row.shop ?? <Badge variant="outline">inconnue</Badge>}</TableCell>
                      <TableCell>
                        {row.template ? <code className={CODE}>{row.template}</code> : <Badge variant="outline">aucun</Badge>}
                      </TableCell>
                      <TableCell className={NUM}>{nombre.format(row.total)}</TableCell>
                      <TableCell className="tabular-nums">{instant(row.derniere)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}

          <SectionHead as="h2" no="02" title="Par template et boutique" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className={NUM}>Rendus</TableHead>
                <TableHead className={NUM}>Erreurs</TableHead>
                <TableHead className={NUM}>Avertis.</TableHead>
                <TableHead className={NUM}>p95</TableHead>
                <TableHead className={NUM}>Poids moyen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTemplate.map((row) => (
                <TableRow key={`${row.template}-${row.shop}`}>
                  <TableCell>{row.template ?? <Badge variant="outline">supprimé</Badge>}</TableCell>
                  <TableCell>{row.shop ?? <Badge variant="outline">inconnue</Badge>}</TableCell>
                  <TableCell className="tabular-nums">{row.version === null ? "—" : `v${row.version}`}</TableCell>
                  <TableCell className={NUM}>{nombre.format(row.total)}</TableCell>
                  <TableCell className={cn(NUM, row.errors > 0 && BAD)}>
                    {row.errors === 0 ? "—" : nombre.format(row.errors)}
                  </TableCell>
                  <TableCell className={NUM}>{row.with_warnings === 0 ? "—" : nombre.format(row.with_warnings)}</TableCell>
                  <TableCell className={NUM}>{duree(row.p95_ms)}</TableCell>
                  <TableCell className={NUM}>{poids(row.avg_bytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {warnings.length > 0 ? (
            <>
              <SectionHead as="h2" no="03" title="Avertissements, par nature" />
              <p className="text-muted-foreground mb-4 text-sm">
                Un avertissement ne fait pas échouer un rendu : la référence manquante est vidée et le
                bloc concerné s&apos;efface. Sur un parc, c&apos;est ici que se voit un asset absent de
                tout un catalogue.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nature</TableHead>
                    <TableHead className={NUM}>Occurrences</TableHead>
                    <TableHead>Exemple</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warnings.map((row) => (
                    <TableRow key={row.kind}>
                      <TableCell>{row.kind}</TableCell>
                      <TableCell className={NUM}>{nombre.format(row.total)}</TableCell>
                      <TableCell className={EXAMPLE}>
                        <code className={CODE}>{row.example}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}

          {failed > 0 ? (
            <>
              <SectionHead as="h2" no="04" title="Derniers échecs" />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quand</TableHead>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className={NUM}>Durée</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failures.map((row, index) => (
                    <TableRow key={`${row.created_at}-${index}`}>
                      <TableCell className="tabular-nums">{instant(row.created_at)}</TableCell>
                      <TableCell>{row.shop ?? "—"}</TableCell>
                      <TableCell>{row.template ?? "—"}</TableCell>
                      <TableCell>{row.product_ref ? <code className={CODE}>{row.product_ref}</code> : "—"}</TableCell>
                      <TableCell className={row.status === "error" ? BAD : WARN}>{row.status}</TableCell>
                      <TableCell className={NUM}>{duree(row.duration_ms)}</TableCell>
                      <TableCell className={EXAMPLE}>{row.error ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}

          <SectionHead as="h2" no="05" title="Par jour" />
          <div className="max-w-[34rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jour</TableHead>
                  <TableHead className={NUM}>Rendus</TableHead>
                  <TableHead className={NUM}>Erreurs</TableHead>
                  <TableHead className={NUM}>Refusés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDay.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell className="tabular-nums">{row.day}</TableCell>
                    <TableCell className={NUM}>{nombre.format(row.total)}</TableCell>
                    <TableCell className={cn(NUM, row.errors > 0 && BAD)}>
                      {row.errors === 0 ? "—" : nombre.format(row.errors)}
                    </TableCell>
                    <TableCell className={cn(NUM, row.saturated > 0 && WARN)}>
                      {row.saturated === 0 ? "—" : nombre.format(row.saturated)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/*
        La retention est ANNONCEE, pas silencieuse. Quelqu'un qui cherche un
        rendu d'il y a six mois doit comprendre pourquoi il ne le trouve pas,
        plutot que de conclure que le journal ment.
      */}
      <p className="text-muted-foreground mt-8 text-sm">
        {retentionDays() === 0
          ? "Aucune purge : les lignes de rendu sont conservées indéfiniment (RENDER_LOG_RETENTION_DAYS=0)."
          : `Les lignes de plus de ${retentionDays()} jours sont supprimées automatiquement. Durée réglable par RENDER_LOG_RETENTION_DAYS.`}
      </p>
    </main>
  );
}
