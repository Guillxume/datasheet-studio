/**
 * Annuler / retablir au clavier, quelle que soit la disposition du clavier.
 *
 * LE DEFAUT. Puck reconnait ses raccourcis par la POSITION PHYSIQUE de la touche
 * (`KeyboardEvent.code`), pas par la lettre tapee (`key`). `code` nomme la touche
 * d'apres un clavier QWERTY : sur un clavier AZERTY, la touche Z est a la place du
 * W, et Ctrl+Z envoie `code: "KeyW"`. Resultat, constate dans un navigateur :
 *
 *   - Ctrl+Z et Cmd+Z n'annulent rien ;
 *   - Ctrl+W, lui, annule — c'est la touche qui occupe la place du Z QWERTY ;
 *   - en QWERTZ (allemand, suisse), Z et Y sont permutes : Ctrl+Z RETABLIT.
 *
 * LA REGLE. On decide d'apres la lettre tapee, comme le fait deja Cmd/Ctrl+S
 * dans EditorClient.tsx. Quand la position physique dit la meme chose que la
 * lettre (clavier QWERTY), on laisse Puck faire — il le fait deja. Sinon, on fait
 * nous-memes et on l'empeche d'agir sur une touche qu'il lit de travers.
 *
 * Fonction pure, testee sans navigateur ; le branchement est dans
 * src/app/editor/[scope]/[slug]/EditorHotkeys.tsx.
 */

export type UndoKey = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/**
 * - « back » / « forward » : a nous d'annuler ou de retablir ;
 * - « block » : Puck lirait cette touche comme un Z ou un Y qu'elle n'est pas ;
 *   il faut l'empecher d'agir ;
 * - null : rien a faire (pas un raccourci, ou Puck s'en charge correctement).
 */
export type UndoDecision = "back" | "forward" | "block" | null;

/** Ce que veut dire une lettre, avec ou sans Maj : les raccourcis de Puck. */
function meaning(letter: string | null, shift: boolean): "back" | "forward" | null {
  if (letter === "z") return shift ? "forward" : "back";
  if (letter === "y" && !shift) return "forward";
  return null;
}

export function undoDecision(event: UndoKey): UndoDecision {
  // Alt : AltGr sur les claviers europeens, qui produit des caracteres, pas des
  // raccourcis. Puck l'exclut aussi.
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;

  const typed = event.key.length === 1 ? event.key.toLowerCase() : null;
  const physical = event.code === "KeyZ" ? "z" : event.code === "KeyY" ? "y" : null;

  const wanted = meaning(typed, event.shiftKey);
  const puckWill = meaning(physical, event.shiftKey);

  if (wanted === puckWill) return null;
  if (wanted !== null) return wanted;
  return "block";
}
