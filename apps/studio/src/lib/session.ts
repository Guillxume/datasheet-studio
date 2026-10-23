import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./sessionCookie";
import { sql } from "./db";
import type { Role } from "./roles";

/**
 * Sessions de l'interface, portees par un cookie et adossees a la base.
 *
 * DEUX ECHEANCES, ET C'EST DELIBERE :
 *
 *   expires_at           inactivite. Repoussee a chaque requete authentifiee.
 *                        C'est celle qui deconnecte le poste laisse ouvert.
 *   absolute_expires_at  plafond. JAMAIS repoussee. C'est celle qui garantit
 *                        qu'une session finit toujours par mourir, meme utilisee
 *                        tous les jours — et donc qu'un cookie copie n'est pas
 *                        un acces a vie.
 *
 * Le cookie, lui, porte une duree de vie longue : il n'est pas l'autorite. La
 * base l'est. Un cookie qui survit a sa session ne donne rien — la ligne
 * n'existe plus, la requete repart vers /login.
 *
 * LE COOKIE NE CONTIENT QUE LE SECRET, pas d'identifiant : la base retrouve la
 * ligne par l'empreinte sha256 du secret, qui est indexee et unique. Rien de ce
 * qui est stocke ne permet de reconstruire le cookie.
 */

/*
 * PAS de paquet `server-only` ici, et ce n'est pas un oubli : `next/headers`
 * produit deja l'erreur de build attendue si ce module est importe depuis un
 * composant client (« You're importing a component that needs next/headers »).
 * Une dependance de plus pour la meme garantie n'en serait pas une.
 */

// Reexporte pour que les appelants n'aient qu'un module a connaitre. Le nom vit
// dans sessionCookie.ts, que le portail importe seul — voir le commentaire la-bas.
export { SESSION_COOKIE };

/** Inactivite toleree avant de redemander le mot de passe. */
const IDLE_MS = 12 * 60 * 60 * 1000;
/** Duree de vie maximale d'une session, quelle que soit l'activite. */
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

function hash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * `secure` suit NODE_ENV, sauf mention contraire explicite.
 *
 * COOKIE_SECURE=false existe pour un seul cas : un environnement de test servi en
 * clair derriere un tunnel. Sans cette echappatoire, la connexion y echoue en
 * silence — le navigateur accepte le Set-Cookie, ne le renvoie jamais, et
 * l'utilisateur boucle sur /login sans message.
 */
function secureCookie(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Ouvre une session et pose le cookie.
 *
 * A n'appeler que depuis un gestionnaire de route ou une action serveur : Next
 * interdit d'ecrire un cookie pendant le rendu d'un composant serveur.
 */
export async function startSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null }
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();

  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at, absolute_expires_at, user_agent, ip)
    VALUES (${userId}, ${hash(token)}, ${new Date(now + IDLE_MS)}, ${new Date(now + ABSOLUTE_MS)},
            ${meta.userAgent ?? null}, ${meta.ip ?? null})
  `;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });
}

/**
 * Lit la session courante, ou `null`.
 *
 * La requete joint `users` et filtre sur `active` : desactiver un compte prend
 * effet a la requete suivante, sans avoir a retrouver ses sessions — meme si
 * `updateUser` les supprime aussi, par ceinture et bretelles.
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await sql<
    {
      session_id: string;
      expires_at: string;
      id: string;
      email: string;
      name: string;
      role: Role;
    }[]
  >`
    SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.name, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash(token)}
      AND s.expires_at > now()
      AND s.absolute_expires_at > now()
      AND u.active
      AND u.password_hash IS NOT NULL
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  purgerSiNecessaire();

  /*
   * Peremption glissante, mais pas a chaque requete : une page du Studio en
   * declenche une dizaine (page, routes, images), et repousser l'echeance dix
   * fois par navigation ferait dix ecritures pour rien. On n'ecrit que si plus
   * du quart de la fenetre a ete consomme.
   */
  const remaining = new Date(row.expires_at).getTime() - Date.now();
  if (remaining < IDLE_MS * 0.75) {
    await sql`
      UPDATE sessions
      SET expires_at = ${new Date(Date.now() + IDLE_MS)}, last_seen_at = now()
      WHERE id = ${row.session_id}
    `;
  }

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/** Ferme la session courante et efface le cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await sql`DELETE FROM sessions WHERE token_hash = ${hash(token)}`;
  }

  store.delete(SESSION_COOKIE);
}

/**
 * Efface les sessions perimees.
 *
 * Appelee a la connexion plutot que par une tache planifiee : c'est le seul
 * moment ou l'on sait qu'une personne attend deja une ecriture, et le volume est
 * borne par le nombre de comptes. Une table de sessions d'outil interne ne
 * justifie pas un cron.
 */
export async function purgeExpiredSessions(): Promise<void> {
  await sql`DELETE FROM sessions WHERE expires_at < now() OR absolute_expires_at < now()`;
}

/**
 * Purge opportuniste, au plus une fois par heure et par processus.
 *
 * `purgeExpiredSessions` n'etait appelee QU'A LA CONNEXION. Sur une instance peu
 * frequentee — celle ou tout le monde garde son onglet ouvert, justement — le
 * nettoyage ne se declenchait donc jamais, et la table accumulait des lignes
 * mortes que plus rien ne supprimait.
 *
 * Accrochee ici plutot qu'a la connexion seule : `readSession` est traversee par
 * chaque requete authentifiee, donc par toute instance vivante. La garde d'une
 * heure ramene le cout a une suppression horaire, et l'appel n'est pas attendu —
 * une purge qui echoue ne doit pas empecher quelqu'un d'ouvrir une page.
 */
let dernierePurge = 0;

function purgerSiNecessaire(): void {
  const maintenant = Date.now();
  if (maintenant - dernierePurge < 60 * 60 * 1000) return;
  dernierePurge = maintenant;

  void purgeExpiredSessions().catch((cause) => {
    console.error("purge des sessions impossible :", cause instanceof Error ? cause.message : cause);
  });
}
