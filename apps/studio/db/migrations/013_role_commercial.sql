-- Un cinquieme role : le commercial.
--
-- LE BESOIN : « un role Commercial qui peut uniquement aller sur consultation et
-- creer des books ». Il consulte les fiches que les boutiques publient deja et en
-- compose des books pour ses clients ; il ne voit ni les templates, ni les
-- images, ni le journal. La matrice de src/lib/roles.ts lui donne la seule
-- capacite datasheets:read.
--
-- La base n'a qu'a accepter la valeur : comme pour le super-administrateur
-- (migration 007), le role est une colonne contrainte, pas un drapeau a cote.

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'admin', 'editor', 'importer', 'commercial'));
