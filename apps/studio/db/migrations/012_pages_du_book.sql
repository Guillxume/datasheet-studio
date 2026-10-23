-- Les pages fixes du book, par boutique : premiere et quatrieme de couverture,
-- et intercalaires de categorie.
--
-- Le book ne compose plus ces pages : elles sont DESSINEES une fois (un PDF de
-- maquette, decoupe en images) et posees telles quelles. Un intercalaire est une
-- image pleine page, un titre, et les categories de niveau 1 qu'il ouvre ; il
-- n'existe pas sans son image (NOT NULL).
--
-- Gerees par le seul super-administrateur (capacite book:configure).
--
-- `categories` : les noms des categories de niveau 1 rangees sous cet
-- intercalaire. Plusieurs categories peuvent partager un intercalaire
-- (« Mobilier d'entrepot et d'atelier » + « Mobilier d' Atelier ») ; une
-- categorie n'en a qu'un — tenu par l'API, qui la retire de l'ancien.
--
-- `position` : l'ordre des intercalaires dans le book, celui de la maquette.

CREATE TABLE IF NOT EXISTS book_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('couverture', 'quatrieme', 'intercalaire')),
  title       text,
  categories  text[] NOT NULL DEFAULT '{}',
  position    integer NOT NULL DEFAULT 0,
  mime        text NOT NULL,
  bytes       integer NOT NULL,
  image       bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT book_pages_intercalaire_titre CHECK (kind <> 'intercalaire' OR coalesce(btrim(title), '') <> '')
);

-- Une seule premiere et une seule quatrieme de couverture par boutique.
CREATE UNIQUE INDEX IF NOT EXISTS book_pages_couverture_unique
  ON book_pages (shop_id, kind) WHERE kind IN ('couverture', 'quatrieme');

CREATE INDEX IF NOT EXISTS book_pages_shop ON book_pages (shop_id, kind, position);
