/**
 * Roles et permissions.
 *
 * MODULE PUR, sans acces base ni import Next : c'est ce qui permet de le tester
 * exhaustivement (src/lib/roles.test.ts) et de l'importer aussi bien depuis un
 * composant serveur que depuis un composant client — l'interface a besoin de la
 * meme matrice pour masquer un bouton que le serveur pour refuser l'action.
 *
 * LA REGLE, ET ELLE N'A QU'UNE EXCEPTION : masquer un bouton ne protege rien.
 * Chaque route qui mute quelque chose revalide la permission cote serveur
 * (src/lib/guard.ts). L'affichage n'est qu'une politesse.
 *
 * CINQ ROLES et pas un de plus, chacun correspondant a un poste reel :
 *
 *   superadmin  repond de l'instance. UNIQUE, et transmissible. Seul a pouvoir
 *               accorder ou retirer le role d'administrateur, et supprimer un
 *               compte d'administrateur. L'unicite est tenue par la base (index
 *               partiel, migration 007) et non par du code : une regle metier
 *               qui ne vit que dans une fonction finit par etre contournee par
 *               un second chemin d'ecriture.
 *   admin     tient le parc : les comptes, les boutiques, les cles API.
 *   editor    compose les fiches : cree, modifie, publie, supprime les templates.
 *   importer  alimente : passe des catalogues, et doit pouvoir REGARDER le
 *             template sur lequel il travaille sans pouvoir le modifier.
 *   commercial  vend : consulte les fiches des boutiques et en compose des
 *             books pour ses clients, et peut envoyer un retour. Rien
 *             d'autre — pas meme la liste des templates.
 *
 * Ce n'est PAS une hierarchie, meme si elle en a l'air ici. Un editeur n'est pas
 * un administrateur diminue : il n'a aucune raison de voir les cles API. La
 * matrice est donc ecrite en toutes lettres, role par role, plutot que derivee
 * d'un niveau numerique — un niveau force a inventer un ordre entre des besoins
 * qui n'en ont pas.
 */

export const ROLES = ["superadmin", "admin", "editor", "importer", "commercial"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  /** Voir la liste des templates et en demander un apercu sur donnees d'exemple. */
  "templates:read",
  /** Creer, dupliquer, enregistrer un brouillon, supprimer. */
  "templates:write",
  /** Publier un brouillon, c'est-a-dire le rendre actif pour les boutiques. */
  "templates:publish",
  /** Lire la bibliotheque d'images. */
  "assets:read",
  /** Televerser et supprimer des images. */
  "assets:write",
  /** Lancer un import de catalogue depuis /import. */
  "import:run",
  /** Consulter le journal des rendus. */
  "journal:read",
  /**
   * Consulter les fiches techniques d'une boutique et les telecharger en lot,
   * depuis /consultation. Lecture seule : ce sont les fiches que la boutique
   * publie deja.
   */
  "datasheets:read",
  /**
   * Choisir l'icone d'une categorie, montree par les intercalaires de
   * /consultation et du book. Un reglage d'affichage partage par tous les
   * comptes : il revient a qui compose les fiches, pas a qui les consulte.
   */
  "datasheets:write",
  /**
   * Creer, modifier, supprimer les pages fixes du book — premiere et quatrieme
   * de couverture, intercalaires et leurs images. RESERVE AU SUPER-ADMINISTRATEUR,
   * a la demande expresse du responsable de la charte : ces pages engagent
   * l'image de la marque, une seule personne en decide.
   */
  "book:configure",
  /**
   * Masquer des categories de la consultation, boutique par boutique : une
   * categorie sans fiches, ou dont les fiches ne sont pas finies, ne doit ni se
   * voir ni entrer dans un book (migration 014). Reglage d'administration :
   * l'administrateur et le super-administrateur l'ont, personne d'autre.
   */
  "consultation:configure",
  /**
   * Envoyer un retour au super-administrateur, quand la page /retours est
   * activee. Accordee a tous les roles de production : un retour n'est pas une
   * action sur le parc, c'est une personne qui ecrit a celui qui repond de
   * l'instance. Accordee AUSSI au commercial, a la demande (14/10/2026) : il
   * consulte les fiches et compose des books pour ses clients, et c'est souvent
   * lui qui entend le premier qu'une fiche manque, deborde ou se lit mal.
   */
  "feedback:send",
  /**
   * Lire la documentation du Studio (/documentation). Accordee a tous les roles
   * de production — ceux qui composent les templates, televersent les pictos,
   * importent — sauf le commercial, dont l'acces se borne a la consultation et
   * au book : la documentation decrit des ecrans qu'il ne voit pas.
   */
  "docs:read",
  /** Creer des comptes, changer un role, desactiver, reinviter. */
  "admin:users",
  /** Creer une boutique, la configurer, faire tourner sa cle API. */
  "admin:shops",
  /**
   * Ce que le seul super-administrateur peut faire : accorder ou retirer le role
   * d'administrateur, supprimer ou desactiver un administrateur, et transmettre
   * son propre role.
   *
   * POURQUOI CETTE SEPARATION CHANGE QUELQUE CHOSE. Avant, deux administrateurs
   * pouvaient se desactiver mutuellement — seuls « pas le dernier actif » et
   * « pas soi-meme » l'empechaient d'aller au bout. Le desaccord entre deux
   * personnes de meme rang se reglait a celui qui cliquait le premier.
   * Desormais, gerer un administrateur remonte a une seule personne, qui repond
   * de l'instance.
   */
  "admin:superuser",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<Role, readonly Capability[]> = {
  /*
   * TOUT, litteralement — c'est la demande : « le seul qui peut absolument tout
   * faire ». Ecrit `CAPABILITIES` et non une liste, pour qu'une capacite ajoutee
   * plus tard lui revienne d'office : un super-administrateur a qui il manque un
   * droit n'est plus un super-administrateur, c'est un bug qu'on decouvre au
   * mauvais moment.
   */
  superadmin: CAPABILITIES,

  /*
   * TOUT SAUF admin:superuser. C'est la difference qui porte le sens du role :
   * un administrateur tient le parc, il ne decide pas qui tient le parc.
   *
   * Et sauf book:configure, retire expressement : les pages fixes du book sont
   * l'affaire du seul super-administrateur (voir la capacite).
   */
  admin: CAPABILITIES.filter((capability) => capability !== "admin:superuser" && capability !== "book:configure"),

  editor: [
    "templates:read",
    "templates:write",
    "templates:publish",
    "assets:read",
    "assets:write",
    /*
     * L'import est donne a l'editeur, et ce n'est pas un elargissement par
     * confort : regler un template se termine toujours par un lot d'essai sur de
     * vraies donnees. Le lui refuser obligerait a demander a quelqu'un d'autre
     * de lancer chaque essai.
     */
    "import:run",
    "journal:read",
    "datasheets:read",
    "datasheets:write",
    "feedback:send",
    "docs:read",
  ],

  importer: [
    /*
     * LECTURE SEULE sur les templates, apercu compris. C'est la demande
     * exactement : « importe juste des catalogues, mais a besoin de previsualiser
     * le template sur lequel il travaille ». Sans templates:read, la page
     * d'import n'aurait meme pas de liste dans laquelle choisir.
     */
    "templates:read",
    "assets:read",
    "import:run",
    /*
     * Le journal, oui : un import qui echoue en masse se diagnostique la, et
     * renvoyer la personne vers un administrateur pour lire un message d'erreur
     * ne protege rien — les lignes ne portent aucun secret.
     */
    "journal:read",
    /*
     * Les fiches aussi : verifier ce qu'un lot a produit cote boutique fait
     * partie du meme travail, et ce sont des documents deja publics.
     */
    "datasheets:read",
    "feedback:send",
    "docs:read",
  ],

  /*
   * LA CONSULTATION ET LE BOOK — c'est la demande mot pour mot. datasheets:read
   * suffit aux deux : le book assemble des fiches que la boutique publie deja,
   * et ses pages fixes se posent avec book:configure, qui reste au
   * super-administrateur. L'accueil, qui exige templates:read, le renvoie sur
   * /consultation (src/app/(studio)/page.tsx).
   *
   * Plus les retours, ajoutes ensuite : voir feedback:send. La page reste
   * soumise au meme interrupteur d'instance que pour les autres roles.
   */
  commercial: ["datasheets:read", "feedback:send"],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

export function capabilitiesOf(role: Role): readonly Capability[] {
  return MATRIX[role];
}

/**
 * LES ROLES QU'UN ACTEUR PEUT ACCORDER A QUELQU'UN D'AUTRE.
 *
 * « superadmin » n'y est jamais : il ne s'accorde pas, il se TRANSMET, et son
 * unicite est tenue par un index unique partiel (migration 007). « admin » n'y
 * est que pour le super-administrateur.
 *
 * ELLE VIT ICI PARCE QU'ELLE SERT DEUX FOIS : la liste d'options du selecteur
 * de /admin/comptes, et — sous une autre forme, plus large — le refus 403 de
 * l'API. Ecrite a deux endroits, elle avait deja produit un defaut : le
 * selecteur retirait « admin » de ses options tout en recevant
 * `value="admin"`, et le navigateur affichait alors la premiere option. Un
 * administrateur s'affichait « Editeur ».
 */
export function assignableRoles(actor: Role): readonly Role[] {
  return ROLES.filter(
    (role) => role !== "superadmin" && (can(actor, "admin:superuser") || role !== "admin")
  );
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super-administrateur",
  admin: "Administrateur",
  editor: "Editeur",
  importer: "Importateur",
  commercial: "Commercial",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  superadmin:
    "Tout, y compris accorder le role d'administrateur et supprimer un administrateur. Unique, et transmissible.",
  admin: "Comptes, boutiques et cles API, plus tout ce que fait un editeur.",
  editor: "Cree, modifie, publie et supprime les templates. Lance des imports.",
  importer: "Importe des catalogues et previsualise les templates, sans les modifier.",
  commercial: "Consulte les fiches techniques des boutiques, compose des books et peut envoyer un retour. Rien d'autre.",
};
