import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "../src/lib/db";
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  currentSuperadmin,
  findUserById,
  isProtected,
  transferSuperadmin,
  consumeTokenAndSetPassword,
  countAdmins,
  createUser,
  deleteNeverUsedUser,
  findLoginCandidate,
  isLocked,
  issueToken,
  recentResetIssued,
  listUsers,
  purgeLoginAttempts,
  readLoginFailures,
  recordLoginAttempt,
  recordLoginFailure,
  updateUser,
} from "../src/lib/users";

/**
 * Comptes et sessions, sur une VRAIE base.
 *
 *     npm run test:integration
 *
 * Meme regle que multisite.integration.test.ts : ce fichier vit dans tests/ et
 * non dans src/lib/ parce qu'il exige un Postgres, et il TRONQUE ses tables.
 *
 * CE QU'IL EPROUVE, ET POURQUOI CA NE SE TESTE PAS AILLEURS. Tout ce qui suit
 * est porte par du SQL : l'unicite insensible a la casse (un index sur
 * `lower(email)`), la peremption des sessions (une comparaison de `timestamptz`
 * dans la clause WHERE), le fait que desactiver un compte emporte ses sessions.
 * Une doublure reproduirait ma lecture du SQL, pas le SQL — et c'est justement
 * la ou les erreurs se logent.
 *
 * Il ne touche PAS aux tables de multisite.integration.test.ts (shops,
 * templates) : les deux fichiers peuvent tourner en parallele.
 */

const MOT_DE_PASSE = "une phrase de passe correcte";

before(async () => {
  // audit_log d'abord : sa cle vers users est en SET NULL, la tronquer apres
  // laisserait des lignes orphelines qui fausseraient les comptages.
  for (const table of ["login_attempts", "audit_log", "sessions", "user_tokens", "users"]) {
    await sql.unsafe(`TRUNCATE ${table} CASCADE`);
  }
});

after(async () => {
  await sql.end({ timeout: 5 });
});

async function creer(email: string, role: "admin" | "editor" | "importer") {
  const cree = await createUser({ email, name: email.split("@")[0], role, createdBy: null });
  assert.ok(!("error" in cree), "error" in cree ? cree.error : "");
  return (cree as { user: { id: string; email: string } }).user;
}

/* --------------------------------------------------------------------- */
/* Unicite de l'adresse                                                   */
/* --------------------------------------------------------------------- */

test("l'adresse est unique SANS tenir compte de la casse", async () => {
  await creer("unique@exemple.fr", "editor");

  const doublon = await createUser({
    email: "UNIQUE@Exemple.fr",
    name: "Doublon",
    role: "admin",
    createdBy: null,
  });

  // Sans l'index sur lower(email), ces deux lignes coexisteraient : deux comptes
  // pour une personne, et l'invitation qui part sur le mauvais.
  assert.ok("error" in doublon);
});

test("l'adresse est normalisee a l'ecriture", async () => {
  const cree = await creer("  MixTe@Exemple.FR  ", "importer");
  assert.equal(cree.email, "mixte@exemple.fr");

  // Et elle se retrouve quelle que soit la casse tapee a la connexion.
  assert.ok(await findLoginCandidate("MIXTE@EXEMPLE.FR"));
});

test("une adresse manifestement invalide est refusee", async () => {
  const resultat = await createUser({
    email: "pas-une-adresse",
    name: "Personne",
    role: "editor",
    createdBy: null,
  });
  assert.ok("error" in resultat);
});

/* --------------------------------------------------------------------- */
/* Invitation : le jeton ne sert qu'une fois                              */
/* --------------------------------------------------------------------- */

test("un jeton d'invitation pose le mot de passe, puis devient inutilisable", async () => {
  const user = await creer("invite@exemple.fr", "editor");

  const { token } = await issueToken(user.id, "invitation");
  const premier = await consumeTokenAndSetPassword(token, MOT_DE_PASSE);
  assert.ok(!("error" in premier));

  const candidat = await findLoginCandidate("invite@exemple.fr");
  assert.equal(await verifyPassword(MOT_DE_PASSE, candidat!.password_hash), true);

  const second = await consumeTokenAndSetPassword(token, "un autre mot de passe long");
  assert.ok("error" in second);
});

test("deux requetes simultanees sur le meme jeton : une seule pose son mot de passe", async () => {
  // Audit du 16/10/2026 : les deux passaient la lecture, et la seconde
  // ecrasait le mot de passe que la premiere venait de poser.
  const user = await creer("course@exemple.fr", "editor");
  const { token } = await issueToken(user.id, "invitation");

  const [a, b] = await Promise.all([
    consumeTokenAndSetPassword(token, "premier mot de passe assez long"),
    consumeTokenAndSetPassword(token, "second mot de passe assez long"),
  ]);
  const reussites = [a, b].filter((r) => !("error" in r));
  assert.equal(reussites.length, 1);

  const gagnant = !("error" in a) ? "premier mot de passe assez long" : "second mot de passe assez long";
  const candidat = await findLoginCandidate("course@exemple.fr");
  assert.equal(await verifyPassword(gagnant, candidat!.password_hash), true);
});

test("un lien de reinitialisation par compte et par delai", async () => {
  const user = await creer("oubli-repete@exemple.fr", "editor");
  assert.equal(await recentResetIssued(user.id, 120), false);
  await issueToken(user.id, "reinitialisation");
  assert.equal(await recentResetIssued(user.id, 120), true);
  // Une invitation ne compte pas : seul « Mot de passe oublie » est plafonne.
  const autre = await creer("invite-recent@exemple.fr", "editor");
  await issueToken(autre.id, "invitation");
  assert.equal(await recentResetIssued(autre.id, 120), false);
});

test("emettre un nouveau jeton invalide le precedent", async () => {
  const user = await creer("reinvite@exemple.fr", "importer");

  const premier = await issueToken(user.id, "invitation");
  const second = await issueToken(user.id, "invitation");

  // Le premier lien a pu fuiter — il ne doit plus rien ouvrir.
  assert.ok("error" in (await consumeTokenAndSetPassword(premier.token, MOT_DE_PASSE)));
  assert.ok(!("error" in (await consumeTokenAndSetPassword(second.token, MOT_DE_PASSE))));
});

test("un jeton perime est refuse", async () => {
  const user = await creer("perime@exemple.fr", "editor");
  const { token } = await issueToken(user.id, "reinitialisation");

  await sql`UPDATE user_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = ${user.id}`;

  const resultat = await consumeTokenAndSetPassword(token, MOT_DE_PASSE);
  assert.ok("error" in resultat);
});

test("poser un mot de passe ferme les sessions ouvertes", async () => {
  const user = await creer("rotation@exemple.fr", "editor");
  await issueToken(user.id, "invitation").then(({ token }) =>
    consumeTokenAndSetPassword(token, MOT_DE_PASSE)
  );
  await ouvrirSession(user.id);

  assert.equal(await compterSessions(user.id), 1);

  const { token } = await issueToken(user.id, "reinitialisation");
  await consumeTokenAndSetPassword(token, "un tout autre mot de passe");

  // Sans cette coupure, une session volee survivrait au changement de mot de
  // passe — c'est-a-dire annulerait l'interet du changement.
  assert.equal(await compterSessions(user.id), 0);
});

/* --------------------------------------------------------------------- */
/* Sessions                                                               */
/* --------------------------------------------------------------------- */

/** Reproduit ce que fait startSession, sans passer par next/headers. */
async function ouvrirSession(userId: string, options?: { expiree?: boolean }) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  const echeance = options?.expiree ? "now() - interval '1 hour'" : "now() + interval '12 hours'";

  await sql.unsafe(
    `INSERT INTO sessions (user_id, token_hash, expires_at, absolute_expires_at)
     VALUES ($1, $2, ${echeance}, now() + interval '30 days')`,
    [userId, hash]
  );

  return hash;
}

async function compterSessions(userId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM sessions WHERE user_id = ${userId}
  `;
  return rows[0].n;
}

/** La requete exacte de readSession, sans le cookie. */
async function resoudreSession(hash: string) {
  const rows = await sql<{ id: string }[]>`
    SELECT u.id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash}
      AND s.expires_at > now()
      AND s.absolute_expires_at > now()
      AND u.active
      AND u.password_hash IS NOT NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

test("une session valide resout, une session perimee non", async () => {
  const user = await creer("session@exemple.fr", "editor");
  await sql`UPDATE users SET password_hash = ${await hashPassword(MOT_DE_PASSE)} WHERE id = ${user.id}`;

  const valide = await ouvrirSession(user.id);
  const perimee = await ouvrirSession(user.id, { expiree: true });

  assert.ok(await resoudreSession(valide));
  assert.equal(await resoudreSession(perimee), null);
});

test("le plafond absolu l'emporte sur l'inactivite", async () => {
  const user = await creer("absolu@exemple.fr", "editor");
  await sql`UPDATE users SET password_hash = ${await hashPassword(MOT_DE_PASSE)} WHERE id = ${user.id}`;

  const hash = await ouvrirSession(user.id);
  // Le cas de la session utilisee tous les jours : `expires_at` est repoussee
  // sans arret, `absolute_expires_at` ne l'est jamais.
  await sql`
    UPDATE sessions
    SET expires_at = now() + interval '12 hours',
        absolute_expires_at = now() - interval '1 second'
    WHERE token_hash = ${hash}
  `;

  assert.equal(await resoudreSession(hash), null);
});

test("desactiver un compte coupe ses sessions immediatement", async () => {
  const user = await creer("desactive@exemple.fr", "importer");
  await sql`UPDATE users SET password_hash = ${await hashPassword(MOT_DE_PASSE)} WHERE id = ${user.id}`;
  const hash = await ouvrirSession(user.id);

  assert.ok(await resoudreSession(hash));

  await updateUser(user.id, { active: false });

  // Deux protections, et le test tient aux deux : la ligne est supprimee, et
  // la requete filtre de toute facon sur `u.active`.
  assert.equal(await compterSessions(user.id), 0);
  assert.equal(await resoudreSession(hash), null);
});

test("un compte sans mot de passe ne resout aucune session", async () => {
  // Le cas d'un compte invite : la ligne existe, l'acces n'existe pas.
  const user = await creer("sans-mdp@exemple.fr", "editor");
  const hash = await ouvrirSession(user.id);

  assert.equal(await resoudreSession(hash), null);
});

/* --------------------------------------------------------------------- */
/* Verrouillage et suppression                                            */
/* --------------------------------------------------------------------- */

test("dix echecs verrouillent le compte, pas neuf", async () => {
  const user = await creer("brute@exemple.fr", "editor");

  for (let i = 0; i < 9; i += 1) {
    assert.equal(await recordLoginFailure(user.id), false, "verrou premature");
  }
  assert.equal(isLocked((await findLoginCandidate("brute@exemple.fr"))!), false);

  // Le dixieme echec rend `true` : c'est lui qui declenche, et lui seul qui doit
  // etre journalise.
  assert.equal(await recordLoginFailure(user.id), true);
  assert.equal(isLocked((await findLoginCandidate("brute@exemple.fr"))!), true);
});

test("les tentatives pendant le verrou ne le prolongent PAS", async () => {
  /*
   * Sans la clause `AND (locked_until IS NULL OR locked_until <= now())`, chaque
   * tentative pendant le verrou continuait d'incrementer le compteur. Une
   * personne revenant au bout des quinze minutes se retrouvait alors
   * reverrouillee au premier faux pas, indefiniment : le verrou devenait une
   * spirale au lieu d'une pause. Et un robot pouvait maintenir un compte
   * legitime verrouille en permanence.
   */
  const user = await creer("spirale@exemple.fr", "editor");
  for (let i = 0; i < 10; i += 1) await recordLoginFailure(user.id);

  const avant = await findLoginCandidate("spirale@exemple.fr");
  assert.equal(isLocked(avant!), true);

  // Un robot continue de marteler pendant le verrou.
  for (let i = 0; i < 50; i += 1) {
    assert.equal(await recordLoginFailure(user.id), false, "le verrou a ete repose");
  }

  const apres = await findLoginCandidate("spirale@exemple.fr");
  // `.getTime()` et non les valeurs brutes : postgres.js rend un objet Date pour
  // un timestamptz, et `assert.equal` compare par identite — deux Date de meme
  // instant echouent, en affichant deux valeurs identiques. Piege classique.
  assert.equal(
    new Date(apres!.locked_until!).getTime(),
    new Date(avant!.locked_until!).getTime(),
    "l'echeance a bouge"
  );
});

test("poser un mot de passe leve le verrou", async () => {
  // C'est la sortie de secours annoncee dans le message d'erreur : quelqu'un de
  // verrouille peut reprendre la main par « mot de passe oublie », sans attendre.
  const user = await creer("verrouille@exemple.fr", "editor");
  for (let i = 0; i < 10; i += 1) await recordLoginFailure(user.id);
  assert.equal(isLocked((await findLoginCandidate("verrouille@exemple.fr"))!), true);

  const { token } = await issueToken(user.id, "reinitialisation");
  await consumeTokenAndSetPassword(token, MOT_DE_PASSE);

  const apres = await findLoginCandidate("verrouille@exemple.fr");
  assert.equal(isLocked(apres!), false);
});

/* --------------------------------------------------------------------- */
/* Tentatives de connexion                                                */
/* --------------------------------------------------------------------- */

/**
 * Attend que les tentatives soient REELLEMENT ecrites.
 *
 * `recordLoginAttempt` est deliberement en « oublie-et-continue » : attendre son
 * ecriture ferait de sa duree un signal (voir src/lib/users.ts). Un test doit
 * donc attendre que la ligne apparaisse — et NON un delai fixe.
 *
 * LA PREMIERE VERSION ATTENDAIT 120 ms, ET ELLE A ECHOUE EN INTEGRATION
 * CONTINUE : « 2 !== 3 », une insertion sur trois n'avait pas atterri sur un
 * runner charge. C'est precisement le defaut que ce depot reproche a ses propres
 * tests ailleurs — un test qui depend d'une horloge echoue une fois sur trois et
 * apprend a relancer la CI au lieu de la lire.
 *
 * On scrute donc jusqu'a obtenir le compte attendu, avec une echeance. Le cas ou
 * l'ecriture ne vient jamais echoue toujours, simplement une seconde plus tard.
 */
async function attendreTentatives(attendu: number, echeanceMs = 3000): Promise<number> {
  const limite = Date.now() + echeanceMs;

  for (;;) {
    const rows = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM login_attempts`;
    if (rows[0].n >= attendu || Date.now() > limite) return rows[0].n;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("les tentatives echouees sont comptees, par IP et par identifiant", async () => {
  await sql`TRUNCATE login_attempts`;

  recordLoginAttempt("cible-a@exemple.fr", "203.0.113.1", "mot-de-passe");
  recordLoginAttempt("cible-a@exemple.fr", "203.0.113.1", "mot-de-passe");
  recordLoginAttempt("cible-b@exemple.fr", "203.0.113.2", "inconnu");
  assert.equal(await attendreTentatives(3), 3, "les trois ecritures n'ont pas atterri");

  const resume = await readLoginFailures(24);
  assert.equal(resume.total, 3);
  assert.equal(resume.ips, 2);
  assert.equal(resume.comptes, 2);
  assert.ok(resume.derniere !== null);
});

test("une adresse essayee est enregistree telle quelle, sans normalisation", async () => {
  await sql`TRUNCATE login_attempts`;

  // C'est ce qu'on veut lire pour comprendre ce que cherche un robot.
  recordLoginAttempt("Admin@EXEMPLE.fr", null, "inconnu");
  await attendreTentatives(1);

  const rows = await sql<{ email: string; ip: string | null }[]>`
    SELECT email, ip FROM login_attempts
  `;
  assert.equal(rows[0].email, "Admin@EXEMPLE.fr");
  assert.equal(rows[0].ip, null);
});

test("la fenetre de lecture exclut les tentatives anciennes", async () => {
  await sql`TRUNCATE login_attempts`;

  recordLoginAttempt("vieux@exemple.fr", "203.0.113.9", "mot-de-passe");
  await attendreTentatives(1);
  await sql`UPDATE login_attempts SET created_at = now() - interval '2 days'`;

  assert.equal((await readLoginFailures(24)).total, 0);
  assert.equal((await readLoginFailures(24 * 7)).total, 1);
});

test("la purge respecte la retention", async () => {
  await sql`TRUNCATE login_attempts`;
  /*
   * Demi-journees, pour qu'AUCUNE ligne ne tombe sur la borne exacte des 30
   * jours. Avec des jours entiers, la ligne a `now() - 30 days` est inseree
   * puis supprimee quelques millisecondes plus tard, quand `now()` a avance :
   * le compte attendu devient 30 ou 31 selon la vitesse de la machine. Un test
   * qui depend de cela echoue une fois sur trois en integration continue.
   */
  await sql`
    INSERT INTO login_attempts (email, ip, reason, created_at)
    SELECT 'robot@exemple.fr', '203.0.113.5', 'inconnu', now() - ((n - 0.5) || ' days')::interval
    FROM generate_series(1, 60) n
  `;

  process.env.LOGIN_ATTEMPT_RETENTION_DAYS = "30";
  let total = 0;
  for (;;) {
    const supprimees = await purgeLoginAttempts();
    if (supprimees === 0) break;
    total += supprimees;
  }

  assert.equal(total, 30, "les 30 lignes de plus de 30 jours doivent partir");
  const reste = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM login_attempts`;
  assert.equal(reste[0].n, 30);
});

test("un compte jamais active se supprime, un compte active non", async () => {
  const jamais = await creer("jamais@exemple.fr", "editor");
  assert.ok("ok" in (await deleteNeverUsedUser(jamais.id)));

  const active = await creer("deja@exemple.fr", "editor");
  const { token } = await issueToken(active.id, "invitation");
  await consumeTokenAndSetPassword(token, MOT_DE_PASSE);

  // Le critere est l'empreinte du mot de passe, et non `last_login_at` :
  // l'activation ouvre une session sans passer par le formulaire de connexion.
  const refus = await deleteNeverUsedUser(active.id);
  assert.ok("error" in refus);
});

/* --------------------------------------------------------------------- */
/* Comptage des administrateurs                                           */
/* --------------------------------------------------------------------- */

test("countAdmins ne compte que les administrateurs ACTIFS", async () => {
  await sql`TRUNCATE users CASCADE`;

  const premier = await creer("admin-1@exemple.fr", "admin");
  await creer("admin-2@exemple.fr", "admin");
  await creer("editeur@exemple.fr", "editor");

  assert.equal(await countAdmins(), 2);

  await updateUser(premier.id, { active: false });

  // C'est ce compte qui empeche de fermer l'administration : un administrateur
  // desactive ne doit pas donner le droit de retrograder le dernier actif.
  assert.equal(await countAdmins(), 1);
});

test("la liste des comptes ne rend jamais l'empreinte du mot de passe", async () => {
  const rows = await listUsers();
  assert.ok(rows.length > 0);

  for (const row of rows) {
    assert.equal("password_hash" in row, false, `${row.email} expose son empreinte`);
    assert.equal(typeof row.has_password, "boolean");
  }
});

/* --------------------------------------------------------------------- */
/* Super-administrateur                                                   */
/* --------------------------------------------------------------------- */

/** Cree un compte deja active : le transfert l'exige. */
async function creerActive(email: string, role: "admin" | "editor"): Promise<string> {
  const user = await creer(email, role);
  const { token } = await issueToken(user.id, "invitation");
  await consumeTokenAndSetPassword(token, MOT_DE_PASSE);
  return user.id;
}

test("LA BASE refuse un second super-administrateur", async () => {
  /*
   * L'unicite n'est pas tenue par du code mais par un index partiel (migration
   * 007). Une regle metier qui ne vit que dans une fonction finit par etre
   * contournee par un second chemin d'ecriture — ce test verifie la ceinture,
   * pas la bretelle.
   */
  await sql`TRUNCATE users CASCADE`;
  const a = await creerActive("super-a@exemple.fr", "admin");
  const b = await creerActive("super-b@exemple.fr", "admin");

  await sql`UPDATE users SET role = 'superadmin' WHERE id = ${a}`;
  await assert.rejects(
    () => sql`UPDATE users SET role = 'superadmin' WHERE id = ${b}`,
    /users_un_seul_superadmin/
  );
});

test("ZERO super-administrateur reste permis : le transfert y passe", async () => {
  // L'index interdit deux lignes, pas zero. C'est indispensable — le transfert
  // retrograde avant de promouvoir, et traverse donc cet etat.
  await sql`UPDATE users SET role = 'admin' WHERE role = 'superadmin'`;
  assert.equal(await currentSuperadmin(), null);
});

test("le transfert deplace le role, et retrograde le sortant en administrateur", async () => {
  await sql`TRUNCATE users CASCADE`;
  const a = await creerActive("sortant@exemple.fr", "admin");
  const b = await creerActive("entrant@exemple.fr", "editor");
  await sql`UPDATE users SET role = 'superadmin' WHERE id = ${a}`;

  const resultat = await transferSuperadmin(a, b);
  assert.ok(!("error" in resultat));

  assert.equal((await currentSuperadmin())?.email, "entrant@exemple.fr");
  // Le sortant devient ADMINISTRATEUR, pas ce qu'il etait avant : lui rendre son
  // ancien role le ferait redevenir « editeur » et perdre l'acces a
  // l'administration dans le meme geste, sans personne pour l'aider si le
  // transfert etait une erreur.
  assert.equal((await findUserById(a))?.role, "admin");
});

test("le transfert echoue vers un compte JAMAIS ACTIVE", async () => {
  await sql`TRUNCATE users CASCADE`;
  const a = await creerActive("titulaire@exemple.fr", "admin");
  await sql`UPDATE users SET role = 'superadmin' WHERE id = ${a}`;
  const invite = await creer("jamais-venu@exemple.fr", "admin");

  const resultat = await transferSuperadmin(a, invite.id);
  assert.ok("error" in resultat);
  assert.match((resultat as { error: string }).error, /jamais ete active/);

  // Et le titulaire garde son role : un transfert refuse ne doit rien deplacer.
  assert.equal((await currentSuperadmin())?.email, "titulaire@exemple.fr");
});

test("le transfert echoue vers un compte desactive, et vers soi-meme", async () => {
  const titulaire = (await currentSuperadmin())!;
  const eteint = await creerActive("eteint@exemple.fr", "admin");
  await updateUser(eteint, { active: false });

  assert.ok("error" in (await transferSuperadmin(titulaire.id, eteint)));
  assert.ok("error" in (await transferSuperadmin(titulaire.id, titulaire.id)));
  assert.equal((await currentSuperadmin())?.id, titulaire.id);
});

test("seul le super-administrateur transmet : un administrateur ne s'octroie rien", async () => {
  /*
   * Audit du 16/10/2026. La route ne gardait que la CIBLE, et transferSuperadmin
   * ne verifiait pas le role du sortant : sur une instance SANS titulaire, un
   * administrateur designait qui il voulait ; AVEC un titulaire, l'index unique
   * levait une erreur non rattrapee (500).
   */
  await sql`TRUNCATE users CASCADE`;
  const admin = await creerActive("admin-ambitieux@exemple.fr", "admin");
  const complice = await creerActive("complice@exemple.fr", "editor");

  // Aucun titulaire : le cas qui reussissait.
  const sansTitulaire = await transferSuperadmin(admin, complice);
  assert.ok("error" in sansTitulaire);
  assert.equal(await currentSuperadmin(), null);
  assert.equal((await findUserById(complice))?.role, "editor");

  // Un titulaire : refus explicite, pas une exception.
  const titulaire = await creerActive("titulaire-unique@exemple.fr", "admin");
  await sql`UPDATE users SET role = 'superadmin' WHERE id = ${titulaire}`;
  const avecTitulaire = await transferSuperadmin(admin, complice);
  assert.ok("error" in avecTitulaire);
  assert.equal((await currentSuperadmin())?.id, titulaire);
  assert.equal((await findUserById(admin))?.role, "admin");
});

test("le role de super-administrateur ne se RETIRE pas, il se transmet", async () => {
  /*
   * Le defaut que ce test ferme, trouve par un essai de bout en bout et non par
   * relecture : la garde de la route ne couvrait que « supprimer » et « actif ».
   * Le titulaire pouvait donc SE RETIRER SON PROPRE ROLE par le selecteur —
   * reponse « ok », zero super-administrateur, et plus que `npm run superadmin`
   * en SSH pour s'en sortir. La garantie etait ecrite dans les commentaires sans
   * etre implementee.
   *
   * `isProtected` est le predicat que la route consulte pour les trois actions.
   */
  assert.equal(isProtected({ role: "superadmin" }), true);
});

test("le super-administrateur est protege, les autres non", async () => {
  assert.equal(isProtected({ role: "superadmin" }), true);
  for (const role of ["admin", "editor", "importer"] as const) {
    assert.equal(isProtected({ role }), false, role);
  }
});

test("countAdmins ne compte pas le super-administrateur", async () => {
  /*
   * Consequence a connaitre : le garde-fou « c'est le dernier administrateur
   * actif » ne voit pas le super-administrateur. C'est voulu — il ne peut de
   * toute facon pas etre retrograde ni desactive, donc il ne peut pas
   * disparaitre par ce chemin.
   */
  await sql`TRUNCATE users CASCADE`;
  const a = await creerActive("seul-super@exemple.fr", "admin");
  await sql`UPDATE users SET role = 'superadmin' WHERE id = ${a}`;

  assert.equal(await countAdmins(), 0);
  assert.ok(await currentSuperadmin());
});
