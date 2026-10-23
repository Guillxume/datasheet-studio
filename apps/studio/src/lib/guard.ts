import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Capability } from "./roles";
import { readSession, type SessionUser } from "./session";

/**
 * Le point de controle unique.
 *
 * DEUX FONCTIONS ET PAS UNE DE PLUS, parce qu'il n'y a que deux appelants :
 * une page (qui redirige) et une route d'API (qui renvoie un statut). Tout le
 * reste — le masquage d'un bouton, la liste des onglets — se decide avec `can`
 * de src/lib/roles.ts, et ne protege rien.
 *
 * POURQUOI ICI ET PAS DANS LE MIDDLEWARE. Le middleware s'execute sur le runtime
 * Edge et n'a donc pas acces a Postgres : il ne peut verifier que la PRESENCE du
 * cookie, pas ce qu'il vaut ni ce qu'il autorise. Il sert de portail — il evite
 * de rendre une page entiere pour finir sur une redirection — mais la decision
 * est prise ici, cote Node, contre la base. Les deux ne sont pas redondants :
 * l'un est un raccourci, l'autre est la regle.
 */

export type { SessionUser };

export async function currentUser(): Promise<SessionUser | null> {
  return readSession();
}

/**
 * Garde de PAGE. Ne rend jamais : elle redirige, ou elle donne l'utilisateur.
 *
 * `redirect` leve une exception que Next intercepte — d'ou le type de retour
 * qui ne mentionne pas le cas d'echec.
 */
export async function requirePage(capability?: Capability): Promise<SessionUser> {
  const user = await readSession();

  if (!user) {
    // Le chemin demande est repose dans l'URL de connexion pour y revenir apres.
    // Il vient de l'en-tete pose par le middleware : un composant serveur n'a
    // aucun autre moyen de connaitre l'URL courante.
    const store = await headers();
    const path = store.get("x-studio-pathname");
    redirect(path ? `/connexion?suite=${encodeURIComponent(path)}` : "/connexion");
  }

  if (capability !== undefined && !can(user.role, capability)) {
    redirect("/acces-refuse");
  }

  return user;
}

/**
 * Garde de ROUTE. Rend l'utilisateur, ou la reponse a renvoyer telle quelle.
 *
 *     const auth = await requireApi("templates:write");
 *     if (auth instanceof Response) return auth;
 *
 * Le motif `instanceof Response` plutot qu'une exception : une route qui oublie
 * la garde est visible en lecture, alors qu'un `throw` attrape plus haut se
 * fond dans le decor.
 */
export async function requireApi(capability: Capability): Promise<SessionUser | Response> {
  const user = await readSession();

  if (!user) {
    return Response.json(
      { ok: false, error: "Session absente ou expiree. Se reconnecter." },
      { status: 401 }
    );
  }

  if (!can(user.role, capability)) {
    return Response.json(
      { ok: false, error: "Votre role ne permet pas cette action." },
      { status: 403 }
    );
  }

  return user;
}

/**
 * Origine publique du Studio, pour les liens envoyes par courriel.
 *
 * STUDIO_PUBLIC_URL d'abord : derriere Traefik, l'application voit `http` et un
 * nom d'hote interne. Les en-tetes `x-forwarded-*` corrigent le cas courant,
 * mais ils viennent du reverse proxy et un lien d'activation ne doit pas
 * dependre de sa configuration. La variable tranche, les en-tetes depannent.
 */
export function originOf(request: Request): string {
  const configured = process.env.STUDIO_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";

  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** Adresse de l'appelant, pour la trace de session. Jamais utilisee pour decider. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}
