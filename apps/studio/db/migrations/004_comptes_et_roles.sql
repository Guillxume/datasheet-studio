-- Comptes du Studio, roles, sessions et journal des actions d'administration.
--
-- CE QUI CHANGE, ET POURQUOI. Jusqu'ici l'interface entiere vivait derriere le
-- basicauth de Traefik (voir infra/docker-compose.yml) : un seul mot de passe
-- partage, aucune trace de qui avait fait quoi, et surtout aucun moyen de
-- confier l'import d'un catalogue a quelqu'un sans lui donner aussi le droit de
-- supprimer un template. C'est ce plafond-la que ces tables enlevent.
--
-- L'authentification par CLE API des boutiques (table shops) n'est pas touchee :
-- elle repond a un autre besoin — une machine, pas une personne — et les deux
-- continuent de cohabiter sans se connaitre.

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  name           text NOT NULL,
  role           text NOT NULL CHECK (role IN ('admin', 'editor', 'importer')),
  -- NULL tant que l'invitation n'a pas ete honoree. Un compte sans empreinte ne
  -- peut pas se connecter : c'est ce qui rend l'invitation sure sans etat
  -- supplementaire — le mot de passe n'existe qu'apres le passage de la personne.
  password_hash  text,
  active         boolean NOT NULL DEFAULT true,
  -- Verrou anti-force-brute, en base et non en memoire : un redemarrage du
  -- conteneur ne doit pas remettre le compteur a zero.
  failed_logins  integer NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Unicite INSENSIBLE A LA CASSE. Une contrainte UNIQUE(email) laisserait passer
-- « Jean@exemple.fr » a cote de « jean@exemple.fr » : deux comptes pour une
-- personne, et une invitation qui part sur le mauvais. Le code normalise en
-- minuscules a l'ecriture ; cet index garantit qu'aucun chemin ne l'oublie.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- ---------------------------------------------------------------------------
-- Jetons a usage unique : invitation et reinitialisation
-- ---------------------------------------------------------------------------
--
-- Une seule table pour les deux, parce que leur cycle de vie est identique :
-- emis, envoye par courriel, consomme une fois, perime au bout d'un delai. Seul
-- le libelle du courriel differe. Le jeton n'est stocke qu'en sha256, comme les
-- cles API : une fuite de la base ne permet pas de prendre un compte.

CREATE TABLE user_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('invitation', 'reinitialisation')),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Les jetons en attente d'un meme compte sont revoques quand un nouveau est
-- emis : cet index sert cette requete-la, la seule qui balaye par utilisateur.
CREATE INDEX user_tokens_pending ON user_tokens (user_id) WHERE used_at IS NULL;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
--
-- Sessions EN BASE et non jeton signe autoportant (JWT). La difference qui
-- compte pour un outil interne : desactiver un compte doit couper l'acces tout
-- de suite. Un jeton autoportant reste valable jusqu'a son echeance, et il
-- faudrait de toute facon une table pour tenir la liste des revoques — soit la
-- table qu'on cherchait a eviter.

CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  -- Peremption par INACTIVITE, repoussee a chaque requete authentifiee.
  expires_at    timestamptz NOT NULL,
  -- Plafond ABSOLU, jamais repousse : une session ouverte en permanence finit
  -- par demander de se reconnecter, meme si elle sert tous les jours.
  absolute_expires_at timestamptz NOT NULL,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  user_agent    text,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expiry ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Journal des actions d'administration
-- ---------------------------------------------------------------------------
--
-- render_logs dit ce que les MACHINES ont fait. Cette table dit ce que les
-- PERSONNES ont fait : qui a cree un compte, change un role, fait tourner une
-- cle API, supprime un template. Les quatre actions dont on cherche l'auteur
-- quand quelque chose a disparu.
--
-- actor_email est duplique volontairement : le compte peut etre supprime plus
-- tard, la trace doit rester lisible.

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email  text,
  action       text NOT NULL,
  target       text,
  detail       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_recent ON audit_log (created_at DESC);

-- ---------------------------------------------------------------------------
-- Configuration des boutiques depuis l'interface
-- ---------------------------------------------------------------------------
--
-- Ces valeurs vivaient dans collectors/shop.exemple.json, un fichier a recopier
-- sur le poste de chaque personne qui lance un import. Les mettre en base les
-- rend modifiables par un administrateur et communes a tous les chemins :
-- page d'import, collecteurs, et le bloc `shop` du payload de rendu.
ALTER TABLE shops ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Quand la cle a ete emise, et quand elle a servi pour la derniere fois. Sans
-- ces deux dates, impossible de repondre a « peut-on faire tourner cette cle
-- sans casser quelque chose ? » autrement qu'en essayant.
ALTER TABLE shops ADD COLUMN api_key_issued_at   timestamptz;
ALTER TABLE shops ADD COLUMN api_key_last_used_at timestamptz;

UPDATE shops SET api_key_issued_at = created_at WHERE api_key_issued_at IS NULL;
