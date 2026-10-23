-- Composants reutilisables : des fragments de template (pied de page, bandeau
-- de coordonnees) places dans plusieurs templates par le bloc « Composant ».
--
-- DANS LA TABLE DES TEMPLATES, distingues par `kind`, et non dans une table a
-- part : un composant a exactement le cycle de vie d'un template — brouillon,
-- versions, publication, duplication, suppression, editeur. Une table a part
-- aurait duplique tout ce code ; la contrepartie est que CHAQUE requete qui sert
-- des templates aux boutiques doit filtrer `kind = 'template'` (resolution,
-- liste de l'API v1, compteurs). Elles sont enumerees dans la PR.
--
-- LE SLUG RESTE UNIQUE PAR PORTEE, TOUS TYPES CONFONDUS : les index partiels
-- de la migration 001 ne changent pas. Un composant ne peut donc pas porter le
-- slug d'un template de la meme portee — une confusion de moins.

ALTER TABLE templates ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'template';

ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_kind_check;
ALTER TABLE templates ADD CONSTRAINT templates_kind_check CHECK (kind IN ('template', 'component'));
