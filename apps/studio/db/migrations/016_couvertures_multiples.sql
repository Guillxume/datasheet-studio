-- Plusieurs premieres et quatriemes de couverture par boutique.
--
-- La migration 012 n'en permettait qu'une de chaque (index unique partiel) : un
-- book pour un salon et un book pour un grand compte portaient la meme
-- couverture. Desormais la boutique en garde autant qu'elle veut, chacune
-- nommee (`title`, facultatif pour une couverture) et rangee (`position`) ; on
-- CHOISIT la sienne en composant le book. La premiere de la liste est proposee
-- par defaut — c'est aussi celle que recoit une demande qui n'en designe aucune,
-- ce qui garde le comportement d'avant pour les couvertures existantes.
--
-- Additive : supprimer un index ne perd aucune donnee.

DROP INDEX IF EXISTS book_pages_couverture_unique;
