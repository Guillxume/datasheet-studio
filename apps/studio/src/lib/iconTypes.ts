/**
 * Ce que le serveur sait dessiner d'une icone : un SVG en ligne (jeu integre),
 * ou l'adresse d'une image de la bibliotheque.
 *
 * Module a part, sans import : les composants clients en ont besoin, et ils ne
 * doivent pas importer src/lib/icons.ts, qui embarque les dessins du jeu entier.
 */
export type IconMarkup = { ref: string; svg: string | null; src: string | null };
