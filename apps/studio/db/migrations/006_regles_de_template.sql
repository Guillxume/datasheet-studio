-- Un template par categorie de produit, decide par le Studio.
--
-- LE BESOIN, dans les mots de la demande : « nous n'avons pas les memes besoins
-- de templating avec un rayonnage complexe qu'un simple pouf ». Jusqu'ici le
-- module choisissait UN template par boutique, ce qui forcait le plus petit
-- denominateur commun de tout le catalogue.
--
-- CE QUI EXISTAIT DEJA, ET OU. Le moteur de correspondance vit dans
-- collectors/core/templateRules.ts depuis les collecteurs — prefixe du fil
-- d'ariane, appartenance, reference, marque, avec un score de specificite. Il
-- fonctionne, il est teste, et il est PILOTE PAR UN FICHIER JSON sur le poste de
-- la personne qui lance un collecteur.
--
-- C'est ce qui ne pouvait pas durer : ce fichier ne couvre ni le module
-- PrestaShop, ni le bouton de back-office, ni la page d'import du Studio. Les
-- regles vivaient au seul endroit qui ne servait pas le cas principal. Le moteur
-- est remonte dans src/lib/templateRules.ts, partage ; ces tables portent ce
-- qu'il lui faut, par boutique.

CREATE TABLE template_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- PAR BOUTIQUE, sans portee « bibliotheque commune » contrairement aux
  -- templates. Deux sites du parc partagent des MODELES de fiche, pas des
  -- arborescences de categories : contoso-equipment et fabrikam ne rangent pas
  -- leurs produits pareil. Une regle commune n'attraperait presque rien, et
  -- masquerait le fait qu'il n'y en a pas.
  shop_id        uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- Les quatre criteres du moteur. Tous facultatifs, mais au moins un exige
  -- (contrainte ci-dessous) : une regle sans critere s'appliquerait a tout, ce
  -- qui est le role du template par defaut.
  --
  -- `category`     prefixe du fil d'ariane. {Manutention} attrape tous ses
  --                descendants.
  -- `category_any` appartenance sans ordre, pour les sources qui ne donnent pas
  --                un vrai fil d'ariane — un export PrestaShop liste toutes les
  --                categories associees dans un ordre non hierarchique.
  -- `ref_pattern`  expression reguliere sur la reference produit.
  -- `brand`        marque exacte.
  category       text[],
  category_any   text[],
  ref_pattern    text,
  brand          text,

  -- Le SLUG et non un identifiant de template : c'est ce que le contrat de
  -- rendu transporte, et cela laisse une regle designer un template de
  -- bibliotheque comme un template propre a la boutique — la resolution par
  -- slug appliquant deja la regle de masquage (voir resolveTemplate).
  template_slug  text NOT NULL,

  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT template_rules_au_moins_un_critere CHECK (
    category IS NOT NULL OR category_any IS NOT NULL
    OR ref_pattern IS NOT NULL OR brand IS NOT NULL
  )
);

CREATE INDEX template_rules_par_boutique ON template_rules (shop_id);

-- Le template servi quand aucune regle ne correspond. Sans lui, « template:
-- auto » n'aurait rien a rendre pour un produit hors de toute branche.
ALTER TABLE shops ADD COLUMN default_template_slug text;

-- ---------------------------------------------------------------------------
-- De quoi voir qu'une regle a cesse de fonctionner
-- ---------------------------------------------------------------------------
--
-- LE DEFAUT REDOUTE, et ce depot en porte deja la cicatrice : l'ancien module
-- appariait les caracteristiques par libelle traduit, et tout cassait
-- silencieusement des qu'une caracteristique etait renommee en back-office.
-- Les regles ci-dessus comparent des LIBELLES de categorie. Renommer
-- « Manutention » en « Manutention & levage » ne leve rien : toutes les fiches
-- concernees retombent sur le defaut, et sortent.
--
-- Ces deux colonnes sont l'alarme. `/journal` liste les chemins de categorie qui
-- n'ont correspondu a aucune regle : c'est la liste exacte des regles a
-- reecrire, et elle se lit sans connaitre le catalogue.
ALTER TABLE render_logs ADD COLUMN resolved_by   text;   -- 'explicite' | 'regle' | 'defaut'
ALTER TABLE render_logs ADD COLUMN category_path text;   -- le fil d'ariane, joint par ' > '

CREATE INDEX render_logs_sans_regle
  ON render_logs (created_at DESC)
  WHERE resolved_by = 'defaut';
