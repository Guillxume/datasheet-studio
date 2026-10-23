import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "./db";
import { hashPassword } from "./password";
import type { Role } from "./roles";

/**
 * Comptes, jetons d'invitation et journal des actions.
 *
 * Meme discipline que src/lib/auth.ts pour les cles de boutique : rien de
 * reversible en base. Un mot de passe y est une empreinte scrypt, un jeton
 * d'invitation un sha256. Une copie de la base — un dump de recette, une
 * sauvegarde egaree — ne permet de prendre aucun compte.
 */

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  has_password: boolean;
  last_login_at: string | null;
  locked_until: string | null;
  created_at: string;
};

const USER_COLUMNS = sql`
  id, email, name, role, active,
  (password_hash IS NOT NULL) AS has_password,
  last_login_at, locked_until, created_at
`;

/**
 * Normalisation de l'adresse : minuscules et espaces retires.
 *
 * L'index unique de la migration porte sur `lower(email)`. Cette fonction est
 * l'autre moitie du contrat — sans elle, la base refuserait le doublon mais on
 * ne saurait pas retrouver la ligne au moment de la connexion.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  // Volontairement permissif : valider une adresse par expression reguliere est
  // un puits sans fond, et la seule preuve qui compte est qu'un courriel y
  // arrive. On ecarte les fautes de frappe grossieres, rien de plus.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function listUsers(): Promise<UserRow[]> {
  return sql<UserRow[]>`
    SELECT ${USER_COLUMNS} FROM users
    ORDER BY active DESC,
             -- Rang EXPLICITE et non l'ordre alphabetique du role : celui-ci
             -- classait « superadmin » en dernier, apres « importer ». Le compte
             -- qui repond de l'instance se lit en tete de liste.
             CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1
                       WHEN 'editor' THEN 2 WHEN 'importer' THEN 3 ELSE 4 END,
             lower(email)
  `;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`SELECT ${USER_COLUMNS} FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function countAdmins(): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active
  `;
  return rows[0]?.n ?? 0;
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  createdBy: string | null;
}): Promise<{ user: UserRow } | { error: string }> {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) {
    return { error: "Adresse de courriel invalide." };
  }
  const name = input.name.trim();
  if (name.length < 2) {
    return { error: "Le nom doit faire au moins 2 caracteres." };
  }

  try {
    const rows = await sql<UserRow[]>`
      INSERT INTO users (email, name, role, created_by)
      VALUES (${email}, ${name}, ${input.role}, ${input.createdBy})
      RETURNING ${USER_COLUMNS}
    `;
    return { user: rows[0] };
  } catch {
    // L'index unique sur lower(email) est la seule contrainte qui puisse casser
    // ici : le role est valide en amont par isRole, le nom est controle.
    return { error: "Un compte existe deja avec cette adresse." };
  }
}

export async function updateUser(
  id: string,
  patch: { name?: string; role?: Role; active?: boolean }
): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    UPDATE users SET
      name       = COALESCE(${patch.name ?? null}, name),
      role       = COALESCE(${patch.role ?? null}, role),
      active     = COALESCE(${patch.active ?? null}, active),
      updated_at = now()
    WHERE id = ${id}
    RETURNING ${USER_COLUMNS}
  `;

  // Desactiver un compte doit couper l'acces TOUT DE SUITE, pas a l'echeance de
  // sa session. C'est la raison d'etre de la table sessions (voir la migration).
  if (patch.active === false) {
    await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  }

  return rows[0] ?? null;
}

/**
 * Suppression definitive, reservee aux comptes JAMAIS ACTIVES.
 *
 * Un compte qui a servi laisse des traces dans audit_log ; le supprimer casserait
 * la lisibilite du journal (actor_id passe a NULL). Pour ceux-la, la reponse est
 * la desactivation. Ce chemin-ci n'existe que pour rattraper une invitation
 * partie sur une adresse mal tapee.
 *
 * LE CRITERE EST `password_hash IS NULL`, ET NON `last_login_at IS NULL`.
 * La premiere version testait la date de derniere connexion, et laissait passer
 * un cas reel : activer son compte ouvre une session directement (voir
 * /api/auth, action « activation ») sans passer par le formulaire de connexion,
 * donc sans renseigner `last_login_at`. Un compte activé et utilisé restait
 * supprimable. L'empreinte du mot de passe, elle, n'existe qu'apres le passage
 * de la personne : c'est le marqueur exact de « ce compte a servi ».
 *
 * Les deux conditions sont conservees — la seconde ne peut plus etre vraie sans
 * la premiere, mais elle coute une ligne et ferme la porte si un futur chemin
 * de connexion oubliait de poser une empreinte.
 */
export async function deleteNeverUsedUser(id: string): Promise<{ ok: true } | { error: string }> {
  const rows = await sql<{ last_login_at: string | null; has_password: boolean }[]>`
    SELECT last_login_at, (password_hash IS NOT NULL) AS has_password
    FROM users WHERE id = ${id}
  `;
  if (!rows[0]) return { error: "Compte introuvable." };
  if (rows[0].has_password || rows[0].last_login_at !== null) {
    return { error: "Ce compte a deja ete active : le desactiver plutot que le supprimer." };
  }

  await sql`DELETE FROM users WHERE id = ${id}`;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Jetons d'invitation et de reinitialisation
// ---------------------------------------------------------------------------

export type TokenKind = "invitation" | "reinitialisation";

/**
 * Sept jours pour une invitation, deux heures pour une reinitialisation.
 *
 * L'ecart est volontaire. Une invitation part souvent la veille d'une arrivee et
 * doit survivre a un week-end ; une reinitialisation est demandee par quelqu'un
 * qui est devant son ecran, et une fenetre longue y est une fenetre offerte a
 * qui lit la boite de reception.
 */
export const TOKEN_TTL_MS: Record<TokenKind, number> = {
  invitation: 7 * 24 * 60 * 60 * 1000,
  reinitialisation: 2 * 60 * 60 * 1000,
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Emet un jeton et REVOQUE les precedents du meme compte.
 *
 * Reinviter quelqu'un doit invalider le premier lien : sans cela, deux liens
 * valides circulent, et le plus ancien — celui qui a peut-etre fuite — reste
 * bon.
 */
/**
 * Un lien de reinitialisation a-t-il deja ete envoye a ce compte il y a moins
 * de `secondes` ? Sert a plafonner « Mot de passe oublie » PAR ADRESSE : le
 * plafond de Traefik est par adresse IP, et rien n'empechait d'inonder la
 * boite d'un collegue de liens, depuis plusieurs adresses (audit du 16/10/2026).
 */
export async function recentResetIssued(userId: string, secondes: number): Promise<boolean> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM user_tokens
    WHERE user_id = ${userId}
      AND kind = 'reinitialisation'
      AND created_at > now() - ${secondes} * interval '1 second'
  `;
  return (rows[0]?.n ?? 0) > 0;
}

export async function issueToken(
  userId: string,
  kind: TokenKind
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[kind]);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE user_tokens SET used_at = now()
      WHERE user_id = ${userId} AND used_at IS NULL
    `;
    await tx`
      INSERT INTO user_tokens (user_id, kind, token_hash, expires_at)
      VALUES (${userId}, ${kind}, ${hashToken(token)}, ${expiresAt})
    `;
  });

  return { token, expiresAt };
}

/**
 * Consomme un jeton et pose le mot de passe, en UNE transaction.
 *
 * Les quatre effets sont indissociables : marquer le jeton utilise, ecrire
 * l'empreinte, lever un eventuel verrou de connexion, et fermer les sessions
 * ouvertes. Separer le dernier laisserait une session volee survivre au
 * changement de mot de passe — c'est-a-dire annuler l'interet du changement.
 */
export async function consumeTokenAndSetPassword(
  token: string,
  password: string
): Promise<{ user: UserRow } | { error: string }> {
  const rows = await sql<{ id: string; user_id: string; kind: TokenKind; expires_at: string }[]>`
    SELECT id, user_id, kind, expires_at
    FROM user_tokens
    WHERE token_hash = ${hashToken(token)} AND used_at IS NULL
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return { error: "Ce lien est invalide ou a deja servi. En demander un nouveau." };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "Ce lien a expire. En demander un nouveau." };
  }

  const hash = await hashPassword(password);

  const updated = await sql.begin(async (tx) => {
    /*
     * `AND used_at IS NULL` : le jeton ne sert qu'UNE fois, meme a deux
     * requetes simultanees. La lecture ci-dessus ne le garantit pas — deux
     * requetes la passent ensemble, et la seconde ecrasait le mot de passe que
     * la premiere venait de poser (audit du 16/10/2026). Ici, une seule des deux
     * marque le jeton ; l'autre repart sans rien ecrire.
     */
    const marque = await tx`
      UPDATE user_tokens SET used_at = now()
      WHERE id = ${row.id} AND used_at IS NULL
      RETURNING id`;
    if (marque.length === 0) return "deja-servi" as const;
    // Colonnes ecrites en toutes lettres et non via le fragment USER_COLUMNS :
    // le fragment est construit par `sql`, la requete par `tx`. Melanger les
    // deux instances fonctionne, mais rend le code dependant d'un detail
    // d'implementation de postgres.js — ce n'est pas le genre de pari a prendre
    // sur le chemin qui pose un mot de passe.
    const users = await tx<UserRow[]>`
      UPDATE users
      SET password_hash = ${hash},
          failed_logins = 0,
          locked_until  = NULL,
          updated_at    = now()
      WHERE id = ${row.user_id} AND active
      RETURNING id, email, name, role, active,
                (password_hash IS NOT NULL) AS has_password,
                last_login_at, locked_until, created_at
    `;
    await tx`DELETE FROM sessions WHERE user_id = ${row.user_id}`;
    return users[0] ?? null;
  });

  if (updated === "deja-servi") {
    return { error: "Ce lien est invalide ou a deja servi. En demander un nouveau." };
  }
  if (!updated) {
    return { error: "Ce compte est desactive. Contacter un administrateur." };
  }

  return { user: updated };
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

/**
 * Dix tentatives, puis quinze minutes de verrou.
 *
 * Le seuil est haut expres : un outil interne ou l'on se trompe de mot de passe
 * trois fois de suite en cherchant lequel on avait choisi ne doit pas se
 * verrouiller.
 *
 * CE QUE CE VERROU FAIT, ET CE QU'IL NE FAIT PAS — la version precedente de ce
 * commentaire se trompait, et il faut le dire. Elle annoncait « ce qu'on arrete
 * ici, c'est une machine ». C'etait faux : la route de connexion verifiait le
 * mot de passe AVANT de regarder le verrou, et ne consultait celui-ci que sur le
 * chemin du succes. Un robot enchainait donc les tentatives a pleine vitesse,
 * chacune coutant une derivation scrypt de 44 ms et 32 Mo — soit une porte qu'on
 * peut marteler et, accessoirement, un levier de deni de service.
 *
 * Depuis le correctif, le verrou est consulte EN PREMIER (voir
 * src/app/api/auth/route.ts) : un compte verrouille ne declenche aucune
 * derivation. Ce qui plafonne le NOMBRE de tentatives, en revanche, n'est pas
 * ici : c'est le `rateLimit` de Traefik sur /api/auth. Les deux sont
 * necessaires — l'un protege un compte, l'autre protege le service.
 */
const MAX_FAILED_LOGINS = 10;
const LOCK_MS = 15 * 60 * 1000;

export type LoginCandidate = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  password_hash: string | null;
  locked_until: string | null;
};

export async function findLoginCandidate(email: string): Promise<LoginCandidate | null> {
  const rows = await sql<LoginCandidate[]>`
    SELECT id, email, name, role, active, password_hash, locked_until
    FROM users
    WHERE lower(email) = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Compte un echec, et pose le verrou au seuil.
 *
 * `WHERE ... AND (locked_until IS NULL OR locked_until <= now())` : on
 * n'incremente PAS un compte deja verrouille. Sans cette clause, chaque
 * tentative pendant le verrou prolongeait le compteur, et une personne
 * legitime revenant au bout des quinze minutes se retrouvait reverrouillee au
 * premier faux pas. Le verrou doit etre une pause, pas une spirale.
 *
 * Rend `true` si cet echec vient de declencher le verrou — de quoi le
 * journaliser une fois, et pas a chaque tentative suivante.
 */
export async function recordLoginFailure(userId: string): Promise<boolean> {
  const rows = await sql<{ verrouille: boolean }[]>`
    UPDATE users
    SET failed_logins = failed_logins + 1,
        locked_until = CASE
          WHEN failed_logins + 1 >= ${MAX_FAILED_LOGINS}
          THEN now() + ${`${LOCK_MS} milliseconds`}::interval
          ELSE locked_until
        END
    WHERE id = ${userId}
      AND (locked_until IS NULL OR locked_until <= now())
    RETURNING (locked_until IS NOT NULL) AS verrouille
  `;

  return rows[0]?.verrouille ?? false;
}

export async function recordLoginSuccess(userId: string): Promise<void> {
  await sql`
    UPDATE users
    SET failed_logins = 0, locked_until = NULL, last_login_at = now()
    WHERE id = ${userId}
  `;
}

export function isLocked(user: { locked_until: string | null }): boolean {
  return user.locked_until !== null && new Date(user.locked_until).getTime() > Date.now();
}

/**
 * Comparaison a temps constant de deux chaines, pour les jetons compares hors
 * base. Reprise de la meme precaution que src/lib/auth.ts.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------
// Journal des actions
// ---------------------------------------------------------------------------

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export async function audit(
  actor: { id: string; email: string } | null,
  action: string,
  target: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  await sql`
    INSERT INTO audit_log (actor_id, actor_email, action, target, detail)
    VALUES (${actor?.id ?? null}, ${actor?.email ?? null}, ${action}, ${target},
            ${detail === undefined ? null : sql.json(detail as never)})
  `;
}

export async function readAudit(limit = 100): Promise<AuditEntry[]> {
  return sql<AuditEntry[]>`
    SELECT id::text, actor_email, action, target, detail, created_at
    FROM audit_log
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// ---------------------------------------------------------------------------
// Tentatives de connexion echouees
// ---------------------------------------------------------------------------

export type LoginFailureReason = "inconnu" | "mot-de-passe" | "desactive" | "verrouille";

/**
 * Note un echec de connexion, SANS ATTENDRE.
 *
 * Volontairement en « oublie-et-continue » : la reponse a l'appelant ne doit pas
 * dependre d'une ecriture de telemetrie. Et surtout, ATTENDRE cette ecriture
 * ferait de sa duree un signal — une adresse connue ecrit une ligne, une adresse
 * inconnue aussi, mais tout ecart de duree entre les deux chemins se mesure.
 * C'est le meme raisonnement que le plancher de temps de reponse de la route.
 *
 * L'adresse est enregistree TELLE QU'ESSAYEE, sans normalisation ni
 * verification qu'elle corresponde a un compte : c'est precisement ce qu'on veut
 * lire pour comprendre ce que cherche un robot.
 */
export function recordLoginAttempt(
  email: string,
  ip: string | null,
  reason: LoginFailureReason
): void {
  void sql`
    INSERT INTO login_attempts (email, ip, reason)
    VALUES (${email.slice(0, 320)}, ${ip}, ${reason})
  `.catch(() => {});
}

export type LoginFailureSummary = {
  total: number;
  ips: number;
  comptes: number;
  derniere: string | null;
};

/** Echecs sur une fenetre, pour la page d'administration. */
export async function readLoginFailures(hours = 24): Promise<LoginFailureSummary> {
  const rows = await sql<LoginFailureSummary[]>`
    SELECT count(*)::int                          AS total,
           count(DISTINCT ip)::int                AS ips,
           count(DISTINCT lower(email))::int      AS comptes,
           max(created_at)                        AS derniere
    FROM login_attempts
    WHERE created_at > now() - ${hours} * interval '1 hour'
  `;

  return rows[0] ?? { total: 0, ips: 0, comptes: 0, derniere: null };
}

/**
 * Retention des tentatives : 30 jours.
 *
 * Plus court que les 90 jours du journal de rendus, et pour une raison : une
 * ligne de rendu sert a comparer un mois a l'autre, une tentative echouee ne
 * sert qu'a constater une attaque en cours ou recente. Passe un mois, elle ne
 * repond plus a aucune question.
 */
export async function purgeLoginAttempts(batch = 20_000): Promise<number> {
  const days = Number(process.env.LOGIN_ATTEMPT_RETENTION_DAYS ?? 30);
  const jours = Number.isFinite(days) && days >= 0 ? days : 30;
  if (jours === 0) return 0;

  const rows = await sql<{ id: string }[]>`
    DELETE FROM login_attempts
    WHERE id IN (
      SELECT id FROM login_attempts
      WHERE created_at < now() - ${jours} * interval '1 day'
      LIMIT ${batch}
    )
    RETURNING id
  `;

  return rows.length;
}

/**
 * Purge opportuniste des tentatives, au plus une fois par heure et par processus.
 *
 * Accrochee a la page d'administration, qui est la seule a lire cette table —
 * meme raisonnement que la purge du journal de rendus, accrochee a /journal.
 * `pnpm purge` va au bout en une fois.
 */
let dernierePurgeTentatives = 0;

export function purgeLoginAttemptsSiNecessaire(): void {
  const maintenant = Date.now();
  if (maintenant - dernierePurgeTentatives < 60 * 60 * 1000) return;
  dernierePurgeTentatives = maintenant;

  void purgeLoginAttempts().catch((cause) => {
    console.error(
      "purge des tentatives impossible :",
      cause instanceof Error ? cause.message : cause
    );
  });
}

// ---------------------------------------------------------------------------
// Super-administrateur
// ---------------------------------------------------------------------------

export async function currentSuperadmin(): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    SELECT ${USER_COLUMNS} FROM users WHERE role = 'superadmin' LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Transmet le role de super-administrateur.
 *
 * L'ORDRE DES DEUX MISES A JOUR N'EST PAS INTERCHANGEABLE, et ce n'est pas une
 * precaution theorique. L'unicite est tenue par un index partiel (migration
 * 007), et un index unique ordinaire est controle LIGNE PAR LIGNE, pas en fin
 * d'instruction. Verifie contre Postgres 17 :
 *
 *   retrograder puis promouvoir   -> accepte
 *   promouvoir puis retrograder   -> « Key (role)=(superadmin) already exists »
 *   un seul UPDATE qui echange    -> meme echec
 *
 * L'etat intermediaire — zero super-administrateur — est donc TRAVERSE, et
 * l'index l'autorise volontairement. La transaction le rend invisible.
 *
 * LE ROLE PRECEDENT N'EST PAS RESTITUE : le sortant devient administrateur, pas
 * ce qu'il etait avant. Rendre son ancien role demanderait de le memoriser, et
 * un super-administrateur qui redeviendrait « importateur » perdrait l'acces a
 * l'administration dans le meme geste — sans personne pour l'aider si le
 * transfert etait une erreur.
 */
export async function transferSuperadmin(
  fromId: string,
  toId: string
): Promise<{ ok: true } | { error: string }> {
  if (fromId === toId) {
    return { error: "Vous etes deja super-administrateur." };
  }

  const cible = await findUserById(toId);
  if (!cible) return { error: "Compte introuvable." };
  if (!cible.active) return { error: "Ce compte est desactive." };
  if (!cible.has_password) {
    // Sinon le role le plus puissant du Studio est confie a une adresse de
    // courriel, pas a une personne : le lien d'activation peut encore etre
    // detourne, et le sortant a deja perdu son droit.
    return { error: "Ce compte n'a jamais ete active : il ne peut pas recevoir ce role." };
  }

  /*
   * LE SORTANT DOIT ETRE LE SUPER-ADMINISTRATEUR, verifie DANS la transaction :
   * `AND role = 'superadmin'` ne retrograde que lui. Sans cette condition,
   * n'importe quel appelant « transmettait » un role qu'il n'avait pas — et
   * s'il en existait deja un, l'index unique levait une erreur que rien ne
   * rattrapait (500).
   */
  try {
    const transmis = await sql.begin(async (tx) => {
      const sortant = await tx`
        UPDATE users SET role = 'admin', updated_at = now()
        WHERE id = ${fromId} AND role = 'superadmin'
        RETURNING id`;
      if (sortant.length === 0) return false;
      await tx`UPDATE users SET role = 'superadmin', updated_at = now() WHERE id = ${toId}`;
      return true;
    });
    if (!transmis) return { error: "Seul le super-administrateur peut transmettre son role." };
  } catch (cause) {
    // 23505 : un autre super-administrateur existe (index unique, migration
    // 007). Une course entre deux transmissions, par exemple.
    if ((cause as { code?: string }).code === "23505") {
      return { error: "Un autre compte est deja super-administrateur." };
    }
    throw cause;
  }

  return { ok: true };
}

/**
 * Le compte est-il protege contre la suppression et la desactivation ?
 *
 * Le super-administrateur l'est, y compris contre lui-meme. Sans cette regle on
 * atteint zero super-administrateur, et plus personne ne peut en designer un
 * depuis l'interface : il faut un acces SSH et `pnpm superadmin`. Le seul
 * chemin de sortie est le TRANSFERT, qui garantit qu'il y en a toujours un.
 */
export function isProtected(user: { role: Role }): boolean {
  return user.role === "superadmin";
}
