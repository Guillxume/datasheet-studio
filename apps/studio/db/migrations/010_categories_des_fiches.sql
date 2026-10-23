-- Les categories dans l'index des fiches, et une icone par categorie.
--
-- /consultation trie et regroupe les fiches par categorie de NIVEAU 1 — la
-- premiere du fil d'Ariane, « Bureaux d'entreprise » pour « Bureaux
-- d'entreprise > Bureaux d'angle » — et ouvre chaque groupe par un intercalaire
-- portant son nom et une icone.
--
-- LE FIL ENTIER EST GARDE, et non le seul niveau 1 : il arrive deja dans chaque
-- rendu (product.category_path, du plus general au plus precis, racine exclue),
-- et un regroupement plus fin ne demandera alors aucune migration.

ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS category_path text[] NOT NULL DEFAULT '{}';

-- RATTRAPAGE DES FICHES DEJA INDEXEES, depuis le journal des rendus : il porte le
-- fil de chaque rendu depuis la migration 006 (« A > B > C »), et
-- render_logs.product_ref vaut la reference, a defaut l'identifiant — la meme
-- regle que la cle de l'index. Sans ce rattrapage, toutes les fiches existantes
-- tomberaient dans « Sans categorie » jusqu'a leur prochain rendu.
--
-- Seules les lignes encore vides sont touchees : rejouee, l'instruction ne
-- defait rien de ce qu'un rendu aurait ecrit entre-temps.
UPDATE datasheets d
SET category_path = string_to_array(l.category_path, ' > ')
FROM (
  SELECT DISTINCT ON (shop_id, product_ref) shop_id, product_ref, category_path
  FROM render_logs
  WHERE category_path IS NOT NULL AND category_path <> '' AND product_ref IS NOT NULL
  ORDER BY shop_id, product_ref, created_at DESC
) l
WHERE l.shop_id = d.shop_id
  AND l.product_ref = coalesce(d.product_ref, d.product_key)
  AND d.category_path = '{}';

-- Une icone par categorie de niveau 1 et par boutique : deux sites ne rangent pas
-- leurs produits sous les memes noms.
--
-- `icon` est une reference : « lucide:<nom> » pour le jeu integre, ou l'adresse
-- d'une image de la bibliotheque (« /assets/<portee>/<cle> »). Le nom de la
-- categorie sert de cle, comme le libelle sert aux regles de template : une
-- categorie renommee perd son icone, et retombe sur l'icone par defaut.
CREATE TABLE IF NOT EXISTS category_icons (
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category    text NOT NULL,
  icon        text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, category)
);
