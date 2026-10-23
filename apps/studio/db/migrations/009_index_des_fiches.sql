-- L'index des fiches techniques, tenu par le Studio.
--
-- POURQUOI LE STUDIO TIENT SA PROPRE LISTE. Il ne connaissait aucun produit : il
-- genere une fiche quand une boutique la lui demande, la renvoie, et n'en garde
-- qu'une ligne de journal (render_logs.product_ref, sans nom ni adresse). La page
-- /consultation a besoin, par boutique, de l'identifiant, du nom et de l'adresse
-- publique de chaque fiche. Interroger la boutique a chaque affichage aurait
-- demande son adresse, un secret dans l'autre sens, et rendu la page dependante
-- de sa disponibilite. Chaque rendu reussi de POST /api/v1/render met donc a jour
-- une ligne ici.
--
-- CE QU'ON ACCEPTE : seuls les produits deja generes au moins une fois y figurent.
-- La generation en masse du module les couvre tous.
--
-- UNE LIGNE PAR PRODUIT ET PAR LANGUE : une fiche espagnole n'est pas a la meme
-- adresse que la fiche francaise du meme produit.
--
-- `product_key` est l'identifiant envoye par la boutique, ou a defaut sa
-- reference : `product.id` est facultatif dans le contrat, et une ligne sans cle
-- ne pourrait etre ni mise a jour ni selectionnee.
--
-- `datasheet_url` est NULLABLE : le champ est facultatif dans le contrat, et un
-- module qui ne l'envoie pas encore doit quand meme voir ses produits listes —
-- sans lien ni case a cocher.

CREATE TABLE IF NOT EXISTS datasheets (
  shop_id           uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_key       text NOT NULL,
  locale            text NOT NULL,
  product_id        text,
  product_ref       text,
  product_name      text NOT NULL,
  datasheet_url     text,
  template_slug     text,
  template_version  integer,
  rendered_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, product_key, locale)
);

-- La page liste une boutique triee par nom : sans cet index, une boutique de
-- plusieurs milliers de produits se trierait a chaque affichage.
CREATE INDEX IF NOT EXISTS datasheets_shop_name ON datasheets (shop_id, product_name);
