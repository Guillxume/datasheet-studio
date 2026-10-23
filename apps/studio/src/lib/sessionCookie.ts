/**
 * Le nom du cookie de session — MODULE PUR, sans aucune dependance.
 *
 * SEPARE DE src/lib/session.ts POUR LA MEME RAISON QUE passwordPolicy.ts l'est
 * de password.ts : le portail d'entree (src/proxy.ts) a besoin de cette seule
 * constante. S'il l'importait depuis session.ts, il embarquerait `node:crypto`
 * ET le pool Postgres dans son paquet — pour lire un nom de cookie.
 *
 * Ce n'est pas theorique : le build l'a signale, mot pour mot, avant ce
 * decoupage (« A Node.js module is loaded ('node:crypto') »).
 */
export const SESSION_COOKIE = "studio_session";
