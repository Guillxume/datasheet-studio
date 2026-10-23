/**
 * Politique de mot de passe — MODULE PUR, sans `node:crypto`.
 *
 * SEPARE DE src/lib/password.ts POUR UNE RAISON PRECISE : le formulaire
 * d'activation, qui est un composant client, doit afficher la longueur minimale
 * AVANT la saisie. S'il importait la constante depuis password.ts, le paquet
 * navigateur embarquerait `node:crypto` — et le build echouerait, ou pire,
 * reussirait avec une doublure vide.
 *
 * La regle vaut au-dela de ce cas : ce qui est partage entre le serveur et
 * l'ecran doit vivre dans un module qui n'importe rien du serveur.
 *
 * LONGUEUR MINIMALE PLUTOT QUE CLASSES DE CARACTERES, conformement a ce que
 * recommande le NIST depuis 2017 : exiger une majuscule, un chiffre et un
 * symbole produit « Motdepasse1! » et rien de mieux. Douze caracteres, une
 * verification que ce n'est pas l'identifiant lui-meme, et c'est tout — le reste
 * est du theatre qui pousse a noter le mot de passe sur un carnet.
 */

export const MIN_PASSWORD_LENGTH = 12;

/** Rend `null` si le mot de passe convient, sinon le message a afficher. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) {
    return "Le mot de passe ne doit pas depasser 200 caracteres.";
  }
  if (password.trim().length === 0) {
    return "Le mot de passe ne peut pas etre fait uniquement d'espaces.";
  }
  if (email !== undefined) {
    const identifiant = email.toLowerCase().split("@")[0];
    if (identifiant.length >= 3 && password.toLowerCase().includes(identifiant)) {
      return "Le mot de passe ne doit pas contenir votre identifiant.";
    }
  }
  return null;
}
