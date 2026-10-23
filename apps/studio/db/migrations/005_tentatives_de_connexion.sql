-- Tentatives de connexion echouees.
--
-- POURQUOI UNE TABLE A PART, ET NON audit_log. Les deux ressemblent a des
-- journaux et n'ont rien en commun :
--
--   audit_log       ce que des PERSONNES ont decide — un compte cree, un role
--                   change, une cle tournee. Quelques lignes par semaine, et
--                   elles doivent rester lisibles des ANNEES : c'est pour ca que
--                   actor_email y est duplique.
--   login_attempts  du bruit de fond de securite. Sur une URL publique, un
--                   robot en produit des milliers en une nuit, et rien de tout
--                   cela n'a d'interet passe quelques semaines.
--
-- Les melanger ferait l'un des deux mal : soit on purge audit_log et on perd
-- l'historique des decisions, soit on ne purge pas et la table de decisions se
-- noie sous les tentatives d'un robot.
--
-- CE QUE CETTE TABLE PERMET, ET QUI MANQUAIT : repondre a « est-ce qu'on nous
-- attaque ? ». Jusqu'ici, `recordLoginFailure` incrementait un compteur sur le
-- compte et ne laissait AUCUNE trace. Quatre cents tentatives dans la nuit sur
-- six comptes ne se voyaient nulle part.

CREATE TABLE login_attempts (
  id          bigserial PRIMARY KEY,
  -- L'adresse ESSAYEE, telle quelle : elle ne correspond pas forcement a un
  -- compte, et c'est justement ce qu'on veut savoir.
  email       text NOT NULL,
  ip          text,
  -- 'inconnu' | 'mot-de-passe' | 'desactive' | 'verrouille'
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Les deux seules lectures : la fenetre recente, et le regroupement par source.
CREATE INDEX login_attempts_recent ON login_attempts (created_at DESC);
CREATE INDEX login_attempts_ip ON login_attempts (ip, created_at DESC);
