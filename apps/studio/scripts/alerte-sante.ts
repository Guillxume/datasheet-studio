import { loadEnv } from "./_env";

/**
 * Sonde /api/health et alerte par courriel en cas de panne — ou relaie
 * directement un message d'echec transmis par un autre script (voir
 * scripts/sauvegarder-base.sh).
 *
 *     pnpm alerte
 *     pnpm alerte --message "sauvegarde en echec : disque plein"
 *
 * A PLANIFIER EN CRON, sur le meme modele que scripts/purge-journal.ts :
 *
 *     0,30 * * * *  cd /chemin/du/depot && docker compose run --rm setup \
 *                     tsx scripts/alerte-sante.ts
 *
 * POURQUOI UN COURRIEL ET NON UN TABLEAU DE BORD. Aucun projet du parc n'a de
 * supervision aujourd'hui (verifie : aucun conteneur de supervision, aucune
 * tache cron existante) — une panne s'y decouvre en regardant les journaux,
 * apres coup. Un courriel a chaque probleme est le plus petit mecanisme qui
 * change cela pour ce Studio, en reutilisant le relais SMTP deja configure
 * (src/lib/mailer.ts) : rien de nouveau a heberger ni a maintenir.
 *
 * SILENCIEUX QUAND TOUT VA BIEN. Un cron qui ecrit a chaque execution reussie
 * finit ignore au bout d'une semaine ; il ne doit parler que lorsqu'il y a
 * quelque chose a dire.
 *
 * LA SONDE INTERROGE STUDIO_PUBLIC_URL, PAS LE SERVICE INTERNE. C'est plus
 * lent qu'un appel direct a http://app:3000/api/health, et c'est voulu : en
 * passant par le nom public, elle traverse aussi Traefik, le certificat TLS et
 * la resolution DNS — exactement ce que rencontre une personne qui ouvre le
 * Studio. Un souci de certificat expire ne se verrait jamais avec un appel
 * interne.
 */

async function main(): Promise<void> {
  loadEnv();

  const diagnostic = messageForce() ?? (await sondeDeSante());

  if (diagnostic === null) {
    console.log("sonde de sante : ok");
    return;
  }

  console.error(`alerte : ${diagnostic}`);
  // Meme quand le courriel part correctement : un probleme a ete trouve, et un
  // operateur qui ne lit que les codes de sortie du cron doit aussi le voir.
  process.exitCode = 1;

  const destinataire = process.env.ALERT_EMAIL_TO;
  if (!destinataire) {
    console.error("ALERT_EMAIL_TO absent : aucun courriel envoye.");
    return;
  }

  // Import differe : src/lib/mailer.ts n'a pas besoin de DATABASE_URL, mais on
  // garde la meme discipline que purge-journal.ts — charger l'environnement
  // avant d'importer quoi que ce soit qui pourrait en dependre demain.
  const { sendMail } = await import("../src/lib/mailer");

  const result = await sendMail({
    to: destinataire,
    subject: "Datasheet Studio — alerte",
    text: `${diagnostic}\n\nSource : ${base()}`,
    html: `<p>${escapeHtml(diagnostic)}</p><p>Source : ${escapeHtml(base())}</p>`,
  });

  if (!result.delivered) {
    console.error(`L'envoi de l'alerte elle-meme a echoue : ${result.error ?? "voir les journaux du conteneur"}`);
    process.exitCode = 1;
  }
}

/** null = tout va bien. Sinon, la phrase a mettre dans le courriel. */
async function sondeDeSante(): Promise<string | null> {
  const url = `${base()}/api/health`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return response.ok ? null : `/api/health a repondu ${response.status} (${url}).`;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return `/api/health injoignable : ${detail} (${url}).`;
  }
}

function base(): string {
  return (process.env.STUDIO_PUBLIC_URL ?? process.env.STUDIO_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** --message "…" : utilise par scripts/sauvegarder-base.sh pour relayer un echec sans dupliquer l'envoi de courriel. */
function messageForce(): string | null {
  const index = process.argv.indexOf("--message");
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
