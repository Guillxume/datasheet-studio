import { NextResponse, type NextRequest } from "next/server";
import { refusCrossOrigin } from "@/lib/origin";
import { SESSION_COOKIE } from "@/lib/sessionCookie";

/**
 * Portail d'entree : redirige vers /connexion tout ce qui arrive sans cookie de
 * session.
 *
 * `proxy.ts` ET NON `middleware.ts` : Next 16 a renomme la convention, et
 * l'ancien nom est deprecie — le build le signale. Le fichier renomme s'execute
 * en outre sur le runtime NODE et non plus sur Edge, ce qui lui donnerait acces
 * a Postgres. Il ne s'en sert pas, et c'est un choix.
 *
 * CE QU'IL N'EST PAS. Ce n'est pas le controle d'acces. Il voit qu'un cookie
 * existe, jamais s'il vaut quelque chose ni ce qu'il autorise — et il ne peut
 * pas le savoir : la permission exigee depend de la page visee, pas du chemin.
 * La decision est prise dans src/lib/guard.ts, contre la base, et CHAQUE page et
 * route la reprend a son compte. Deplacer la verification ici ferait une requete
 * de plus par requete HTTP sans retirer aucune de celles d'en dessous.
 *
 * A QUOI IL SERT ALORS. A eviter de rendre une page entiere, avec ses requetes,
 * pour finir sur une redirection ; et a donner aux composants serveur le chemin
 * courant (en-tete `x-studio-pathname`), qu'ils n'ont aucun autre moyen de
 * connaitre — c'est lui qui permet de revenir la ou on allait apres connexion.
 *
 * TROIS FAMILLES SORTENT DU PERIMETRE :
 *
 *   /api/v1/*     contrat public des boutiques. Authentifie par cle API dans
 *                 l'en-tete Authorization, jamais par cookie. Les faire passer
 *                 ici casserait tous les modules du parc.
 *   /api/auth/*   connexion, deconnexion, activation, mot de passe oublie. Par
 *                 construction appelees sans session.
 *   /api/health   sonde de deploiement et de supervision. Elle ne rend qu'un
 *                 booleen et doit repondre a une machine qui n'a pas de compte.
 */

const PUBLIC_PAGES = ["/connexion", "/activation", "/mot-de-passe-oublie", "/acces-refuse"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * CE QU'IL FAIT TOUT DE MEME, ET POUR TOUT LE MONDE : refuser une ecriture
   * venue d'une autre origine — y compris une boutique du meme domaine, que
   * SameSite laisse passer. Voir src/lib/origin.ts. Ici et non route par route :
   * c'est une propriete de la requete, pas de la permission visee, et une route
   * ajoutee demain en profite sans y penser. /api/v1 n'est pas concerne : il
   * sort du matcher, et s'authentifie par cle, jamais par cookie.
   */
  const refus = refusCrossOrigin(request.method, request.headers);
  if (refus !== null) {
    return NextResponse.json(
      { ok: false, error: `Requete refusee : elle ne vient pas d'une page du Studio (${refus}).` },
      { status: 403 }
    );
  }

  const bypass =
    pathname === "/api/health" ||
    pathname.startsWith("/api/v1/") ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  // Le chemin est pose meme sur les routes ouvertes : c'est ce que lit
  // requirePage, et une page ouverte peut en appeler une qui ne l'est pas.
  const headers = new Headers(request.headers);
  headers.set("x-studio-pathname", pathname + request.nextUrl.search);

  if (bypass || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next({ request: { headers } });
  }

  // Une route d'API repond en JSON : la rediriger renverrait du HTML a un
  // `fetch`, qui echouerait sur un `response.json()` avec un message sans
  // rapport avec la cause reelle.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Session absente ou expiree. Se reconnecter." },
      { status: 401 }
    );
  }

  const login = new URL("/connexion", request.url);
  login.searchParams.set("suite", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  /*
   * Tout sauf les fichiers servis par Next lui-meme. `_next/static` et
   * `_next/image` sont exclus par performance ; les extensions de fichiers le
   * sont pour que le favicon et les polices restent joignables depuis la page de
   * connexion, qui les charge avant qu'aucune session n'existe.
   *
   * /api/v1/ EST EXCLU DU MATCHER, et pas seulement laisse passer par `bypass` :
   * toute requete qui traverse ce portail voit son corps lu et TRONQUE a la
   * limite du portail (10 Mo par defaut dans Next 16). Un rendu multipart de
   * 12 Mo — une fiche Acme aux images lourdes — arrivait a la route coupe, et
   * repondait 400 « Corps de requete illisible ». Reproduit le 08/10/2026. Le
   * contrat des boutiques n'a rien a faire ici : il s'authentifie par cle API.
   * `bypass` garde la regle pour le cas ou le matcher changerait.
   */
  matcher: ["/((?!api/v1/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|woff2?|css|js|map)$).*)"],
};
