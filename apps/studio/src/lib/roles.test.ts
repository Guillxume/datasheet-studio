import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignableRoles,
  CAPABILITIES,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  can,
  capabilitiesOf,
  isRole,
} from "./roles";

/**
 * La matrice de permissions se lit en trois lignes et se relit rarement : ces
 * tests sont la pour qu'un elargissement discret — une capacite ajoutee au
 * mauvais role pendant une correction — echoue tout de suite.
 *
 * Ils sont ecrits comme des AFFIRMATIONS SUR LE METIER et non comme une copie de
 * la matrice. Reproduire la table ici ne testerait rien : le test passerait
 * quelle que soit l'erreur, du moment qu'elle est faite deux fois.
 */

test("le super-administrateur a TOUTES les capacites, sans exception", () => {
  // Ecrit ainsi et non contre une liste : une capacite ajoutee plus tard doit lui
  // revenir d'office. Un super-administrateur a qui il manque un droit n'est
  // plus un super-administrateur, c'est un defaut qu'on decouvre au mauvais
  // moment.
  for (const capability of CAPABILITIES) {
    assert.equal(can("superadmin", capability), true, `superadmin devrait avoir ${capability}`);
  }
});

test("l'administrateur a tout SAUF admin:superuser et book:configure", () => {
  /*
   * Ce test remplace « l'administrateur a toutes les capacites », qui etait vrai
   * avant l'arrivee du super-administrateur. Il a echoue au moment du
   * changement de modele — c'est exactement ce qu'on lui demande.
   *
   * La difference porte tout le sens du role : un administrateur tient le parc,
   * il ne decide pas qui tient le parc.
   */
  for (const capability of CAPABILITIES) {
    assert.equal(
      can("admin", capability),
      capability !== "admin:superuser" && capability !== "book:configure",
      `admin et ${capability}`
    );
  }
});

test("seul le super-administrateur configure les pages fixes du book", () => {
  // Demande expresse : couvertures et intercalaires engagent la charte, une
  // seule personne en decide — pas meme un administrateur.
  for (const role of ROLES) {
    assert.equal(can(role, "book:configure"), role === "superadmin", role);
  }
});

test("un seul role peut gerer les administrateurs", () => {
  for (const role of ROLES) {
    assert.equal(can(role, "admin:superuser"), role === "superadmin", role);
  }
});

test("comptes et boutiques restent reserves aux deux roles d'administration", () => {
  for (const role of ROLES) {
    const attendu = role === "admin" || role === "superadmin";
    assert.equal(can(role, "admin:users"), attendu, role);
    assert.equal(can(role, "admin:shops"), attendu, role);
  }
});

test("l'importateur lit les templates mais n'en modifie aucun", () => {
  assert.equal(can("importer", "templates:read"), true);
  assert.equal(can("importer", "templates:write"), false);
  assert.equal(can("importer", "templates:publish"), false);
});

test("l'importateur importe et voit les images, sans pouvoir les remplacer", () => {
  assert.equal(can("importer", "import:run"), true);
  assert.equal(can("importer", "assets:read"), true);
  assert.equal(can("importer", "assets:write"), false);
});

test("l'editeur compose et publie", () => {
  assert.equal(can("editor", "templates:write"), true);
  assert.equal(can("editor", "templates:publish"), true);
  assert.equal(can("editor", "assets:write"), true);
});

test("tout role de production peut ouvrir l'accueil et la page d'import", () => {
  // Ces deux capacites gouvernent les pages sur lesquelles chacun arrive en se
  // connectant. Un role qui les perdrait tomberait sur /acces-refuse des la
  // connexion, sans rien pour s'en sortir. Le commercial n'en a aucune :
  // l'accueil le renvoie sur /consultation (test ci-dessous).
  for (const role of ROLES) {
    if (role === "commercial") continue;
    assert.equal(can(role, "templates:read"), true, role);
    assert.equal(can(role, "import:run"), true, role);
  }
});

test("le commercial consulte les fiches, compose des books, envoie un retour — et c'est tout", () => {
  // La demande d'origine : « uniquement aller sur consultation et creer des
  // books ». Le book ne demande que datasheets:read ; ses pages fixes restent
  // au super-administrateur. Les retours ont ete ouverts ensuite (feedback:send).
  assert.deepEqual(capabilitiesOf("commercial"), ["datasheets:read", "feedback:send"]);
});

test("l'accueil renvoie ailleurs le role qui ne lit pas les templates", () => {
  // Sans cette redirection, le commercial qui se connecte arrive sur « / » —
  // la suite par defaut — et tombe sur /acces-refuse. Verifie sur le source,
  // la page s'executant dans un contexte Next.
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "(studio)", "page.tsx"), "utf8");
  assert.match(page, /sectionsFor\(user\.role\)/);
});

test("tout role peut envoyer un retour, le commercial compris", () => {
  // Un retour n'est pas une action sur le parc : voir le commentaire de
  // feedback:send dans roles.ts. Ce que le reglage d'instance decide, ce n'est
  // pas cette capacite (src/lib/feedbackSettings.ts, hors de ce module pur).
  for (const role of ROLES) {
    assert.equal(can(role, "feedback:send"), true, role);
  }
});

test("la documentation est lue par tous les roles sauf le commercial", () => {
  // Elle decrit les templates, les images, l'import : des ecrans que le
  // commercial ne voit pas. Voir docs:read dans roles.ts.
  for (const role of ROLES) {
    assert.equal(can(role, "docs:read"), role !== "commercial", role);
  }
});

test("masquer des categories de la consultation est un reglage d'administration", () => {
  for (const role of ROLES) {
    assert.equal(can(role, "consultation:configure"), role === "admin" || role === "superadmin", role);
  }
});

test("aucune capacite n'est declaree deux fois pour un role", () => {
  for (const role of ROLES) {
    const list = capabilitiesOf(role);
    assert.equal(new Set(list).size, list.length, `doublon dans les capacites de ${role}`);
  }
});

test("chaque role porte un libelle et une description", () => {
  for (const role of ROLES) {
    assert.ok(ROLE_LABELS[role].length > 0);
    assert.ok(ROLE_DESCRIPTIONS[role].length > 10);
  }
});

test("isRole rejette ce qui n'est pas un role", () => {
  assert.equal(isRole("admin"), true);
  // « superadmin » EST desormais un role : cette ligne affirmait le contraire et
  // a echoue au bon moment.
  assert.equal(isRole("superadmin"), true);
  assert.equal(isRole("ADMIN"), false);
  assert.equal(isRole("root"), false);
  assert.equal(isRole(undefined), false);
  assert.equal(isRole(null), false);
  assert.equal(isRole(1), false);
});

test("le super-administrateur est le premier role declare", () => {
  // L'ordre de ROLES gouverne l'affichage des listes deroulantes : le role le
  // plus puissant ne doit pas se trouver au milieu, ou on le choisit par
  // inadvertance.
  assert.equal(ROLES[0], "superadmin");
});

/* ------------------------------------------------------------------------ */
/* Quels roles peut-on accorder                                              */
/* ------------------------------------------------------------------------ */

test("« superadmin » ne s'accorde a personne, par personne", () => {
  // Il se TRANSMET (transferSuperadmin), et son unicite est tenue par un index
  // unique partiel. Le proposer quelque part ne peut produire que deux choses :
  // un second super-administrateur, ou une erreur de base incomprehensible.
  for (const acteur of ROLES) {
    assert.ok(
      !assignableRoles(acteur).includes("superadmin"),
      `${acteur} peut accorder « superadmin »`,
    );
  }
});

test("seul le super-administrateur peut accorder « admin »", () => {
  // Ecrit comme une affirmation sur le metier : quel que soit le role, le droit
  // d'accorder « admin » va exactement avec la capacite admin:superuser.
  for (const acteur of ROLES) {
    assert.equal(
      assignableRoles(acteur).includes("admin"),
      can(acteur, "admin:superuser"),
      `${acteur} : accorder « admin » et admin:superuser ne vont pas ensemble`,
    );
  }
});

test("un administrateur ordinaire n'accorde que les roles sans pouvoir", () => {
  assert.deepEqual(assignableRoles("admin"), ["editor", "importer", "commercial"]);
  assert.deepEqual(assignableRoles("superadmin"), ["admin", "editor", "importer", "commercial"]);
});

/**
 * LE CHEMIN D'INVITATION CONSULTE LA REGLE — verifie sur le source, faute de
 * mieux.
 *
 * Ce test ne remplace pas une recette : il PINGLE une regression precise, et
 * elle a ete livree. Le garde qui refuse de toucher a un administrateur ne
 * s'applique qu'aux actions designant un compte EXISTANT ; une invitation n'a
 * pas de cible, elle passait donc sans aucun controle de role. Un administrateur
 * ordinaire pouvait ainsi CREER l'administrateur qu'il n'avait pas le droit de
 * promouvoir — et meme un super-administrateur, dont le titulaire du lien
 * d'invitation heritait. Constate de bout en bout en HTTP avant correction.
 *
 * La route s'execute dans un contexte Next (cookies, `next/headers`) : elle ne
 * s'appelle pas depuis `node --test`. A defaut de l'eprouver, on tient au moins
 * que la regle y est consultee.
 */
test("l'invitation controle le role demande", () => {
  const route = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "app", "api", "admin", "users", "route.ts"),
    "utf8",
  );
  const debut = route.indexOf('if (body.action === "inviter")');
  assert.ok(debut > 0, "la branche d'invitation a change de forme");
  const branche = route.slice(debut, route.indexOf("await createUser", debut));
  assert.match(
    branche,
    /assignableRoles\(actor\.role\)/,
    "l'invitation ne consulte plus assignableRoles : le role demande n'est plus controle.",
  );
});
