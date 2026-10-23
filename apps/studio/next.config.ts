import type { NextConfig } from "next";

/**
 * EN-TETES DE SECURITE.
 *
 * PORTEE VOLONTAIREMENT ETROITE. On ne pose ici que ce qui ne peut RIEN casser :
 * les directives qui gouvernent le cadrage, les formulaires et le type MIME. Il
 * n'y a deliberement ni `script-src` ni `style-src` — l'editeur (Puck) et Next
 * lui-meme injectent des styles et des scripts en ligne, et une politique
 * stricte demanderait des nonces sur tout le graphe de rendu. Une CSP qui casse
 * l'editeur serait desactivee dans la semaine, ce qui ne protegerait plus rien.
 *
 * `frame-ancestors 'none'` FAIT DOUBLON avec X-Frame-Options, et c'est voulu :
 * le premier est la norme, le second reste compris par de vieux intermediaires.
 *
 * PAS DE Strict-Transport-Security ici. Il appartient au reverse proxy, qui sait
 * s'il termine le TLS ; pose par l'application, il condamnerait une instance
 * servie en clair (voir COOKIE_SECURE) sans moyen simple de revenir en arriere.
 */
const enTetesCommuns = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Requis par infra/config/app/Dockerfile : produit .next/standalone.
  output: "standalone",

  /*
   * `x-powered-by: Next.js` etait annonce a chaque reponse. Anecdotique — la
   * version n'y figure pas — mais gratuit a retirer, et le service est expose
   * sur une URL publiee dans les journaux de Certificate Transparency : autant
   * ne pas designer soi-meme la pile a scanner.
   */
  poweredByHeader: false,

  /*
   * L'OPTIMISEUR D'IMAGES EST COUPE : le Studio n'utilise pas next/image (les
   * apercus sont des <img>, les PDF ne passent pas par Next). L'optimiseur
   * restait pourtant joignable sans connexion sur /_next/image — le portail
   * l'exclut (src/proxy.ts) — et c'est lui que visaient deux failles de Next
   * corrigees en 16.4 : execution de code a distance par une image AVIF
   * (critique), SSRF (elevee). Audit du 16/10/2026. Un point d'entree qui ne
   * sert a rien n'a pas a rester ouvert.
   */
  images: { unoptimized: true },

  // Le rendu PDF appelle Gotenberg avec des payloads multipart lourds
  // (jusqu'a une dizaine d'images produit par fiche).
  experimental: {
    serverActions: { bodySizeLimit: "32mb" },
    // Les routes qui restent derriere le portail (src/proxy.ts) — apercus de
    // l'editeur, import — recoivent elles aussi des payloads a images. Sans ce
    // reglage, Next les coupe a 10 Mo au passage du portail, sans erreur pour
    // l'appelant : la route recoit un corps tronque. Meme plafond que le reste.
    proxyClientMaxBodySize: "32mb",
  },

  async headers() {
    return [
      { source: "/:path*", headers: enTetesCommuns },
      {
        /*
         * L'ACTIVATION PORTE UN JETON DANS SON URL, et une URL fuite plus
         * facilement qu'un corps de requete : historique du navigateur, en-tete
         * Referer, journaux d'acces du reverse proxy. `no-referrer` ferme le
         * seul de ces trois canaux que l'application controle.
         *
         * Les deux autres restent, et c'est une limite assumee du procede : le
         * jeton ne sert qu'une fois, il expire en sept jours (deux heures pour
         * une reinitialisation), et en emettre un nouveau invalide le precedent.
         * Le sortir de l'URL demanderait un formulaire intermediaire — une etape
         * de plus pour un gain qui ne couvre que le troisieme canal.
         */
        source: "/activation",
        headers: [...enTetesCommuns, { key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        /*
         * UN FICHIER DE LA BIBLIOTHEQUE NE S'EXECUTE JAMAIS. Un SVG est un
         * document : ouvert directement, il fait tourner ses <script> sur
         * l'origine du Studio, avec la session de qui l'ouvre. Il suffisait d'un
         * compte editeur pour televerser un picto piege, puis qu'un
         * administrateur clique sur son lien (reproduit le 08/10/2026, constat
         * H2 de la revue). `sandbox` et `default-src 'none'` en font une image
         * inerte ; les styles en ligne restent permis, beaucoup de SVG en portent.
         * Dans une balise <img> ou dans un PDF, un SVG ne lance deja aucun
         * script : l'affichage ne change pas.
         *
         * ICI ET NON DANS LA ROUTE : Next pose ces en-tetes APRES ceux de la
         * reponse, et la regle generale ci-dessus ecrasait une CSP posee par
         * src/app/assets/[scope]/[key]/route.ts. Pour une meme cle, la derniere
         * regle qui correspond l'emporte — d'ou sa place, en fin de liste.
         */
        source: "/assets/:scope/:key",
        headers: [
          ...enTetesCommuns,
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
