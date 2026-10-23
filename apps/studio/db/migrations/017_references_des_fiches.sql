-- Les references de declinaison et fournisseur dans l'index des fiches.
--
-- LE BESOIN : « on recupere les references fournisseurs des produits et de leurs
-- declinaisons, pour rechercher les produits avec dans Consultation ». La
-- reference qu'un commercial a sous les yeux — celle d'un devis, d'un bon
-- fournisseur, d'une ligne de l'ERP — est rarement celle du produit parent
-- (product_ref) : c'est celle d'une declinaison, ou celle du fournisseur.
--
-- DEUX LISTES ET NON UNE : « trouve par sa reference fournisseur » et « trouve
-- par sa declinaison » ne se lisent pas pareil a l'ecran, et l'import d'un book
-- par references devra dire laquelle a repondu.
--
-- Pas d'index : la recherche porte sur les fiches d'UNE boutique (quelques
-- milliers de lignes), deja parcourues pour le nom.
--
-- Les fiches existantes partent avec des listes vides : elles se remplissent a
-- leur prochain rendu, le seul moment ou le Studio apprend quelque chose d'un
-- produit (voir la migration 009).

ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS variant_skus text[] NOT NULL DEFAULT '{}';
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS supplier_skus text[] NOT NULL DEFAULT '{}';
