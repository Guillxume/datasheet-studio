-- Reglage d'instance : activer ou desactiver la page de retours (feedback).
--
-- POURQUOI UNE TABLE ET NON UNE VARIABLE D'ENVIRONNEMENT. Le super-administrateur
-- doit pouvoir basculer ce reglage depuis l'ecran, sans redeploiement — un etat
-- qui change a l'usage n'a rien a faire dans une variable posee au demarrage.
--
-- LIGNE UNIQUE, TENUE PAR LA BASE. Une cle primaire booleenne avec CHECK (id)
-- n'accepte que la valeur `true` : il ne peut donc jamais y avoir plus d'une
-- ligne. Meme motif que l'unicite du super-administrateur (migration 007), sous
-- sa forme la plus simple puisqu'il n'y a ici qu'un seul reglage a proteger.
CREATE TABLE feedback_settings (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),
  active      boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO feedback_settings (id) VALUES (true);
