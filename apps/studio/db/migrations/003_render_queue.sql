-- Temps passe en file d'attente avant qu'un rendu ne demarre.
--
-- Separer l'attente de la duree : sans cette colonne, `duration_ms` melange
-- « Chromium a mis 3 s » et « la requete a attendu 3 s qu'une place se libere ».
-- Les deux appellent des decisions opposees — alleger le template, ou relever
-- MAX_CONCURRENT_RENDERS — et c'est le journal qui doit permettre de trancher.
ALTER TABLE render_logs ADD COLUMN queued_ms integer;

-- Les requetes refusees faute de place sont journalisees avec status='saturated'
-- et sans template : leur nombre est le signal qui dit que le plafond est trop bas.
-- L'index partiel existant (status <> 'ok') les couvre deja.
