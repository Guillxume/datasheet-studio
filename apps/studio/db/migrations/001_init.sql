-- Socle du Studio de fiches techniques.
--
-- Un "shop" = un site du parc (contoso-equipment, fabrikam, northwind...).
-- Outil interne : pas de notion de compte ni de facturation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE shops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  -- Prefixe en clair (retrouve la ligne), cle complete en sha256 seulement.
  api_key_prefix  text NOT NULL UNIQUE,
  api_key_hash    text NOT NULL,
  -- Secret de signature des webhooks sortants vers le module PrestaShop.
  webhook_secret  text,
  webhook_url     text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE templates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = template de bibliotheque commune, visible par tous les sites.
  -- C'est ce qui evite de recreer la meme fiche sur chacun des sites du parc :
  -- l'identite visuelle (logo, couleurs, coordonnees) arrive en donnee au
  -- rendu, pas dans le template.
  shop_id               uuid REFERENCES shops(id) ON DELETE CASCADE,
  slug                  text NOT NULL,
  name                  text NOT NULL,
  published_version_id  uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Un slug est unique par site, et unique parmi les templates de bibliotheque.
-- Deux index partiels, parce qu'en SQL NULL n'est jamais egal a NULL et qu'une
-- contrainte UNIQUE(shop_id, slug) laisserait passer des doublons de bibliotheque.
CREATE UNIQUE INDEX templates_slug_per_shop
  ON templates (shop_id, slug) WHERE shop_id IS NOT NULL;
CREATE UNIQUE INDEX templates_slug_shared
  ON templates (slug) WHERE shop_id IS NULL;

CREATE TABLE template_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  number       integer NOT NULL,
  -- Arbres Puck. body est obligatoire, header/footer sont facultatifs
  -- (une fiche sans bandeau repete est legitime).
  body         jsonb NOT NULL,
  header       jsonb,
  footer       jsonb,
  css          text,
  -- Geometrie de page en millimetres : { width, height, margins, landscape }
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, number)
);

ALTER TABLE templates
  ADD CONSTRAINT templates_published_version_fk
  FOREIGN KEY (published_version_id) REFERENCES template_versions(id) ON DELETE SET NULL;

CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid REFERENCES shops(id) ON DELETE CASCADE,
  key         text NOT NULL,
  filename    text NOT NULL,
  mime        text NOT NULL,
  bytes       integer NOT NULL,
  sha256      text NOT NULL,
  data        bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assets_key_per_shop ON assets (shop_id, key);

-- Journal de rendu : sert au diagnostic (quel produit, quelle version de
-- template, combien de temps) et a reperer les fiches qui echouent en boucle.
CREATE TABLE render_logs (
  id           bigserial PRIMARY KEY,
  shop_id      uuid REFERENCES shops(id) ON DELETE SET NULL,
  template_id  uuid REFERENCES templates(id) ON DELETE SET NULL,
  version      integer,
  product_ref  text,
  locale       text,
  status       text NOT NULL,
  duration_ms  integer,
  bytes        integer,
  warnings     jsonb,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX render_logs_recent ON render_logs (created_at DESC);
CREATE INDEX render_logs_failures ON render_logs (shop_id, created_at DESC) WHERE status <> 'ok';
