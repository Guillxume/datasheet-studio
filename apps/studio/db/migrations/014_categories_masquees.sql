-- Categories masquees de la consultation.
--
-- LE BESOIN : « exclure des categories de la partie consultation. Certaines
-- categories n'ont pas de fiches ou ne sont pas finies, on ne veut pas que les
-- commerciaux puissent les voir ou les mettre dans des books. » Reglage reserve a
-- l'administration (capacite consultation:configure), par boutique.
--
-- UNE ENTREE EST UN FIL DE CATEGORIES, PAS UN NOM. Masquer {Vestiaires} masque
-- aussi {Vestiaires, Casiers} : la comparaison porte sur le debut du fil de
-- chaque fiche (category_path, migration 010). Un nom seul serait ambigu — deux
-- branches ont souvent une sous-categorie « Accessoires ».
--
-- Le filtre s'applique a la LECTURE de l'index (src/lib/datasheetsStore.ts) :
-- liste, zip, book. Rien n'est supprime de datasheets — reafficher une categorie
-- rend ses fiches telles qu'elles etaient.

CREATE TABLE IF NOT EXISTS hidden_categories (
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  path        text[] NOT NULL CHECK (cardinality(path) > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (shop_id, path)
);
