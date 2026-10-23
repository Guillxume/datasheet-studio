import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StudioError, type StudioClient, type TemplateInfo } from "./client";
import { assemblePayload, freshnessKey, PayloadError } from "./payload";
import type { Journal } from "./journal";
import type { TemplateResolver } from "./templateRules";
import type { CollectedAsset, CollectedProduct, ShopInput, Source } from "./types";
import type { CommonOptions } from "./cli";

/**
 * Le lot : ce qui transforme une source en fiches PDF, de facon reprenable.
 *
 * Le modele est celui du §5 de docs/integrer-un-connecteur.md — des lots bornes
 * par un BUDGET DE TEMPS, chacun demandant « les N prochaines fiches absentes ou
 * perimees ». La reprise est alors gratuite : fermer le terminal, subir une
 * coupure, relancer le lendemain ne coute rien, puisque l'etat vit dans le
 * journal et non dans la boucle.
 *
 * Trois choses s'y jouent, et aucune n'est propre a une source :
 *   - ne pas refaire ce qui est deja bon (fraicheur + version de template) ;
 *   - ne pas laisser une reference cassee bloquer les milliers d'autres ;
 *   - ne pas noyer le moteur, qui n'accepte que MAX_CONCURRENT_RENDERS rendus.
 */

export type RunInput = {
  source: Source;
  client: StudioClient;
  journal: Journal;
  resolver: TemplateResolver;
  options: CommonOptions;
  shop?: ShopInput;
  /** Pieces jointes ajoutees a toutes les fiches (le logo de la boutique). */
  fixedAssets?: readonly CollectedAsset[];
};

export type RunReport = {
  source: string;
  started_at: string;
  elapsed_ms: number;
  stopped_by: "source-epuisee" | "budget" | "limite" | "interruption" | "erreur-bloquante";
  seen: number;
  rendered: number;
  a_jour: number;
  en_quarantaine: number;
  sans_template: number;
  echecs: number;
  bytes: number;
  warnings: Array<{ ref: string; message: string }>;
  failures: Array<{ ref: string; error: string }>;
  /** Versions publiees au moment du lot, pour relire un compte rendu plus tard. */
  templates: Record<string, number>;
};

export async function run(input: RunInput): Promise<RunReport> {
  const { source, client, journal, resolver, options } = input;
  const started = Date.now();

  const report: RunReport = {
    source: source.name,
    started_at: new Date(started).toISOString(),
    elapsed_ms: 0,
    stopped_by: "source-epuisee",
    seen: 0,
    rendered: 0,
    a_jour: 0,
    en_quarantaine: 0,
    sans_template: 0,
    echecs: 0,
    bytes: 0,
    warnings: [],
    failures: [],
    templates: {},
  };

  const published = await publishedVersions(client, resolver, options, report);
  await mkdir(options.outDir, { recursive: true });

  let interrupted = false;
  const onSigint = () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.error("\ninterruption demandee — les rendus en cours se terminent, le journal est a jour");
  };
  process.on("SIGINT", onSigint);

  // Un 401 ne se corrige pas en insistant : toutes les requetes suivantes
  // echoueraient a l'identique. Mieux vaut un arret net avec le vrai motif que
  // quatre mille lignes d'echec.
  //
  // Porte par un objet et non par une variable : TypeScript ne suit pas
  // l'affectation faite dans une closure et retiendrait le type `null`.
  const blocking: { error: StudioError | null } = { error: null };
  const hinted = { shop: false };

  // Rendus ENGAGES, et non rendus termines. Compter les seconds ferait deborder
  // --limit du nombre de rendus en vol : deux workers passent le controle avant
  // qu'aucun n'ait fini. Mesure sur un vrai catalogue : --limit 3 rendait 4.
  const engaged = { count: 0 };

  const stop = (): RunReport["stopped_by"] | null => {
    if (blocking.error) return "erreur-bloquante";
    if (interrupted) return "interruption";
    if (options.budgetMs !== null && Date.now() - started >= options.budgetMs) return "budget";
    if (options.limit !== null && engaged.count >= options.limit) return "limite";
    return null;
  };

  const iterator = source.list()[Symbol.asyncIterator]();
  let gate: Promise<unknown> = Promise.resolve();
  /** Serialise les appels a next() : un iterateur asynchrone n'est pas reentrant. */
  const pull = (): Promise<IteratorResult<CollectedProduct>> => {
    const result = gate.then(() => iterator.next());
    gate = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      const reason = stop();
      if (reason) {
        report.stopped_by = reason;
        return;
      }

      let next: IteratorResult<CollectedProduct>;
      try {
        next = await pull();
      } catch (cause) {
        // Une source qui casse en cours de pagination : on garde ce qui a ete
        // rendu, et on le dit. Le journal permet de reprendre apres correction.
        report.failures.push({ ref: "(source)", error: cause instanceof Error ? cause.message : String(cause) });
        report.stopped_by = "erreur-bloquante";
        return;
      }
      if (next.done) return;

      try {
        await handle(next.value);
      } catch (cause) {
        if (cause instanceof StudioError && cause.status === 401) {
          blocking.error = cause;
          report.stopped_by = "erreur-bloquante";
          return;
        }
        throw cause;
      }
    }
  };

  const handle = async (product: CollectedProduct): Promise<void> => {
    report.seen += 1;
    for (const warning of product.warnings ?? []) {
      report.warnings.push({ ref: product.ref, message: warning });
      if (!options.quiet) console.log(`  ! ${product.ref} — ${warning}`);
    }

    const template = resolver.resolve(product);
    if (!template) {
      report.sans_template += 1;
      report.warnings.push({ ref: product.ref, message: "aucun template ne correspond" });
      if (!options.quiet) console.log(`  - ${product.ref} : aucun template (ni regle ni --template)`);
      return;
    }

    const assets = [...(input.fixedAssets ?? []), ...(product.assets ?? [])];

    let payload;
    try {
      payload = assemblePayload({
        product,
        template,
        locale: options.locale,
        shop: input.shop,
        version: options.pinVersion,
      });
    } catch (cause) {
      const message = cause instanceof PayloadError ? cause.describe() : String(cause);
      // La boutique manquante ferait echouer TOUTES les fiches a l'identique :
      // le motif se dit une fois, pas quatre mille.
      if (!hinted.shop && !input.shop?.name && message.includes("shop.name")) {
        hinted.shop = true;
        console.error(
          "  aucune boutique : passer --shop <fichier.json> (modele : collectors/shop.exemple.json)\n" +
            "  ou porter une colonne shop.name dans la source"
        );
      }
      await journal.fail(product.ref, 422, message);
      report.echecs += 1;
      report.failures.push({ ref: product.ref, error: message });
      console.error(`  x ${product.ref} — ${message}`);
      return;
    }

    // Les deux empreintes, et non l'une OU l'autre. Celle du payload rate ce
    // qu'elle ne voit pas : une image derriere une URL inchangee dont le
    // contenu a change laisserait la fiche « a jour ». L'`updated_at` de la
    // source, lui, le sait. Combiner regenere parfois pour rien, ce qui est le
    // sens dans lequel on veut se tromper.
    const fingerprint = product.fingerprint
      ? `${product.fingerprint}|${freshnessKey(payload, assets)}`
      : freshnessKey(payload, assets);

    if (!options.force) {
      const freshness = journal.freshness(
        product.ref,
        fingerprint,
        published.get(template) ?? null,
        options.maxAttempts
      );
      if (freshness.state === "a-jour") {
        report.a_jour += 1;
        return;
      }
      if (freshness.state === "en-quarantaine") {
        report.en_quarantaine += 1;
        if (!options.quiet) {
          console.log(
            `  ~ ${product.ref} : en quarantaine apres ${freshness.failure.attempts} echecs (--retry-failed pour reessayer)`
          );
        }
        return;
      }
    }

    // Reservation avant l'appel, pas apres : c'est ce qui rend --limit exact.
    if (options.limit !== null && engaged.count >= options.limit) return;
    engaged.count += 1;

    if (options.dryRun) {
      report.rendered += 1;
      if (!options.quiet) console.log(`  = ${product.ref} -> ${template} (payload valide, rien envoye)`);
      return;
    }

    try {
      const result = await client.render(payload, assets);
      const output = join(options.outDir, outputName(product.ref, payload.locale));
      await writeFile(output, result.pdf);
      await journal.succeed({
        ref: product.ref,
        fingerprint,
        template,
        version: result.templateVersion,
        locale: payload.locale,
        output,
        bytes: result.bytes,
        rendered_at: new Date().toISOString(),
        ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
      });

      report.rendered += 1;
      report.bytes += result.bytes;
      for (const warning of result.warnings) {
        report.warnings.push({ ref: product.ref, message: warning });
      }
      if (!options.quiet) {
        const suffix = result.warnings.length > 0 ? ` (${result.warnings.length} avertissement(s))` : "";
        console.log(
          `  + ${product.ref} -> ${output} — ${Math.round(result.bytes / 1024)} Ko, v${result.templateVersion}, ${result.durationMs} ms${suffix}`
        );
      }
    } catch (cause) {
      if (!(cause instanceof StudioError)) throw cause;
      await journal.fail(product.ref, cause.status, cause.describe());
      report.echecs += 1;
      report.failures.push({ ref: product.ref, error: cause.describe() });
      console.error(`  x ${product.ref} — ${cause.describe()}`);
      if (cause.status === 401) throw cause;
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, () => worker()));
  } finally {
    process.off("SIGINT", onSigint);
    await source.close?.();
    await journal.compact();
  }

  if (blocking.error) {
    report.failures.push({ ref: "(studio)", error: blocking.error.describe() });
  }
  report.elapsed_ms = Date.now() - started;
  return report;
}

/**
 * Les versions publiees, lues UNE FOIS par lot.
 *
 * Deux usages, et le second est le plus important : verifier d'entree que les
 * slugs vises existent et sont publies — une faute de frappe dans les regles se
 * paie sinon en 404 sur chaque produit — et fournir la version de reference qui
 * revele une republication.
 */
async function publishedVersions(
  client: StudioClient,
  resolver: TemplateResolver,
  options: CommonOptions,
  report: RunReport
): Promise<Map<string, number>> {
  const versions = new Map<string, number>();
  if (options.dryRun && options.studioKey === "") {
    // Sans cle, --dry-run reste utile : il valide le mapping et les payloads.
    return versions;
  }

  let templates: TemplateInfo[];
  try {
    templates = await client.templates();
  } catch (cause) {
    const message = cause instanceof StudioError ? cause.describe() : String(cause);
    throw new Error(`GET /api/v1/templates a echoue — ${message}`);
  }

  for (const template of templates) {
    if (template.published_version !== null) versions.set(template.slug, template.published_version);
  }

  const missing = resolver.targets().filter((slug) => !versions.has(slug));
  if (missing.length > 0) {
    const known = templates
      .map((t) => `${t.slug}${t.published_version === null ? " (non publie)" : ""}`)
      .join(", ");
    throw new Error(
      `template(s) inconnu(s) ou sans version publiee : ${missing.join(", ")}\n` +
        `disponibles pour cette boutique : ${known || "aucun"}`
    );
  }

  for (const slug of resolver.targets()) {
    report.templates[slug] = versions.get(slug) as number;
  }
  return versions;
}

/**
 * Nom de fichier derive de la reference. Le suffixe de hachage n'apparait que
 * si l'assainissement a change quelque chose : deux references "TPM/2500" et
 * "TPM-2500" tomberaient sinon sur le meme fichier, et la seconde ecraserait la
 * premiere sans un mot.
 */
export function outputName(ref: string, locale: string): string {
  const safe = ref.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80) || "fiche";
  const suffix = safe === ref ? "" : `-${createHash("sha1").update(ref).digest("hex").slice(0, 6)}`;
  return `${safe}${suffix}-${locale}.pdf`;
}

/** Le resume, affiche a la fin de chaque lot. */
export function summarize(report: RunReport): string {
  const seconds = (report.elapsed_ms / 1000).toFixed(1);
  const lines = [
    "",
    `source ${report.source} — ${seconds} s`,
    `  ${report.rendered} rendue(s), ${report.a_jour} deja a jour, ${report.echecs} en echec, ` +
      `${report.en_quarantaine} en quarantaine, ${report.sans_template} sans template`,
  ];
  if (report.bytes > 0) {
    lines.push(`  ${(report.bytes / 1024 / 1024).toFixed(1)} Mo de PDF ecrits`);
  }
  if (report.stopped_by !== "source-epuisee") {
    lines.push(
      `  arret : ${report.stopped_by} — relancer la meme commande reprend ou le lot s'est arrete`
    );
  }
  if (report.warnings.length > 0) {
    lines.push(`  ${report.warnings.length} avertissement(s) — voir --report pour le detail`);
  }
  return lines.join("\n");
}
