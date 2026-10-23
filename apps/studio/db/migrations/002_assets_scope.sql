-- Unicite des cles d'asset, en tenant compte de la portee bibliotheque.
--
-- L'index de 001 etait UNIQUE (shop_id, key). En SQL, NULL n'est jamais egal a
-- NULL : deux assets de bibliotheque portant la meme cle passaient donc a travers
-- la contrainte. Meme correction que pour templates : deux index partiels.

DROP INDEX IF EXISTS assets_key_per_shop;

CREATE UNIQUE INDEX assets_key_per_shop
  ON assets (shop_id, key) WHERE shop_id IS NOT NULL;

CREATE UNIQUE INDEX assets_key_shared
  ON assets (key) WHERE shop_id IS NULL;

-- Le nom d'origine du fichier televerse, utile pour reproposer un
-- telechargement lisible depuis l'editeur.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS original_name text;
