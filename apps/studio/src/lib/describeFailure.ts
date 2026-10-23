/**
 * Traduit un echec technique en message actionnable.
 *
 * POURQUOI. Les `catch` remontaient `error.message` tel quel. Or ce message a
 * deux provenances tres differentes : les routes de cette application, qui
 * ecrivent deja pour un humain (« Template introuvable. »), et la couche
 * reseau, qui ne le fait pas — un « HTTP 502 » ou un « Failed to fetch » ne dit
 * ni ce qui a echoue, ni quoi faire.
 *
 * Le tri se fait sur la FORME de l'echec et non sur le texte du message : un
 * message n'est pas un contrat, il change au premier remaniement, alors qu'un
 * `TypeError` de fetch ou un code HTTP restent stables.
 *
 * La reassurance sur les modifications n'est pas une politesse : elle est vraie
 * et verifiable — l'arbre du document vit dans `trees` cote client, un
 * enregistrement echoue ne lui fait rien perdre.
 */
export function describeFailure(error: unknown, online = true): string {
  if (!online) {
    return "Connexion perdue. Vos modifications sont intactes : réessayez une fois la connexion revenue.";
  }

  // fetch rejette avec un TypeError quand la requete n'a pas pu partir ou que
  // la reponse n'est jamais arrivee — donc avant tout code de statut.
  if (error instanceof TypeError) {
    return "Le serveur n'a pas répondu. Vos modifications sont intactes : réessayez dans un instant.";
  }

  const message = error instanceof Error ? error.message : String(error);
  const http = /^HTTP (\d{3})$/.exec(message);

  if (http) {
    const code = Number(http[1]);
    return code >= 500
      ? `Le service ne répond pas (code ${code}). Vos modifications sont intactes : réessayez dans un instant.`
      : `Demande refusée (code ${code}). Si cela se reproduit, transmettez ce code.`;
  }

  // Message ecrit par nos propres routes : il est deja destine a un humain.
  return message;
}
