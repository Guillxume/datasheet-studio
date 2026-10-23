-- Un super-administrateur, unique et transmissible.
--
-- LE BESOIN : « le seul qui peut absolument tout faire, y compris supprimer les
-- admins ». Aujourd'hui les administrateurs sont interchangeables et peuvent se
-- desactiver les uns les autres — deux garde-fous seulement les en empechent
-- (« pas le dernier actif », « pas soi-meme »). Rien ne distingue celui qui
-- repond de l'instance.
--
-- QUATRIEME ROLE ET NON DRAPEAU BOOLEEN. La matrice de src/lib/roles.ts est le
-- mecanisme d'autorisation du projet ; un booleen a cote creerait une seconde
-- source de verite sur « qui peut quoi », et c'est ainsi qu'on finit avec deux
-- reponses differentes a la meme question.

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'admin', 'editor', 'importer'));

/*
 * L'UNICITE, TENUE PAR LA BASE.
 *
 * Index partiel sur une expression CONSTANTE : toutes les lignes
 * `role = 'superadmin'` partagent la meme cle, donc il ne peut y en avoir
 * qu'une. Zero reste autorise, et c'est indispensable — le transfert passe par
 * un etat sans super-administrateur.
 *
 * VERIFIE, et l'ordre du transfert en decoule : un index unique ordinaire est
 * controle LIGNE PAR LIGNE, pas en fin d'instruction. Meme un seul UPDATE qui
 * echangerait les deux roles echoue (« Key (role)=(superadmin) already
 * exists »). Le transfert doit donc RETROGRADER D'ABORD, puis promouvoir, dans
 * une transaction. Voir transferSuperadmin dans src/lib/users.ts.
 *
 * Une contrainte DEFERRABLE permettrait l'echange en une fois, mais Postgres ne
 * la propose pas sur un index partiel.
 */
CREATE UNIQUE INDEX users_un_seul_superadmin ON users ((role)) WHERE role = 'superadmin';

/*
 * PROMOTION DU PLUS ANCIEN ADMINISTRATEUR AYANT REELLEMENT ACTIVE SON COMPTE.
 *
 * Deterministe, et le critere n'est pas anodin : `password_hash IS NOT NULL`
 * ecarte les comptes seulement invites. Donner le role le plus puissant du
 * Studio a quelqu'un qui n'a jamais suivi son lien d'activation reviendrait a le
 * confier a une adresse de courriel, pas a une personne.
 *
 * Si aucun administrateur n'est active, PERSONNE n'est promu : l'instance reste
 * sans super-administrateur, /admin le signale, et `npm run superadmin` le
 * designe. Promouvoir au hasard serait pire que ne rien faire.
 */
UPDATE users
SET role = 'superadmin', updated_at = now()
WHERE id = (
  SELECT id FROM users
  WHERE role = 'admin' AND active AND password_hash IS NOT NULL
  ORDER BY created_at
  LIMIT 1
);
