-- Fiches masquees de la consultation, produit par produit.
--
-- LE BESOIN, a la suite de la migration 014 : « il faut aussi pouvoir masquer
-- fiche technique par fiche technique ». Meme regle que les categories — reserve
-- a l'administration (consultation:configure), par boutique, et applique a la
-- LECTURE de l'index : la fiche sort de la liste, du zip et du book pour tous les
-- comptes. Rien n'est supprime de datasheets.
--
-- UN PRODUIT, PAS UNE LANGUE : la cle est product_key, sans la langue. Une fiche
-- pas finie l'est pour toutes ses traductions, et une seule ligne a reafficher
-- vaut mieux qu'une par langue.

CREATE TABLE IF NOT EXISTS hidden_datasheets (
  shop_id      uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_key  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (shop_id, product_key)
);
