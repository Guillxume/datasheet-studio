/**
 * Ferme la session puis renvoie a la connexion, appelee depuis le menu
 * utilisateur. La redirection a lieu meme si l'appel echoue : un cookie
 * reste valide est moins grave qu'un bouton « Sortir » qui ne sort pas, et la
 * page de connexion le remplacera.
 */
export async function seDeconnecter(): Promise<void> {
  await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "deconnexion" }),
  }).catch(() => {});
  window.location.assign("/connexion");
}
