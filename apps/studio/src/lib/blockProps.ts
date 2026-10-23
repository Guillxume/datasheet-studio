/**
 * Preparation des props d'un bloc, AVANT appel de son `render`.
 *
 * UN SEUL module, DEUX consommateurs, et c'est tout l'interet :
 *   - src/lib/render.tsx      chemin PDF, cote serveur
 *   - src/blocks/previewConfig.tsx  canvas de l'editeur, cote client
 *
 * Le registry garantissait deja que le meme composant React produit l'apercu et
 * le PDF. Il ne garantissait rien sur les PROPS qu'on lui passe, et c'est la que
 * les deux chemins divergeaient : le chemin PDF fusionnait les valeurs par
 * defaut et resolvait les tokens, le canvas de l'editeur ne faisait ni l'un ni
 * l'autre. Un meme bloc recevait donc "{{features}}" dans l'editeur et le
 * tableau reel dans le PDF — d'ou un bloc invisible a l'ecran et pleine page a
 * l'impression.
 */

import { resolveValue } from "./bind";

/**
 * Fusionne les valeurs par defaut sous les props enregistrees.
 *
 * Fait ici et non laisse a Puck, qui n'applique `defaultProps` qu'a l'INSERTION
 * d'un bloc : un template enregistre avant l'ajout d'un champ n'en porte aucune
 * valeur, et doit heriter du defaut a l'affichage comme au rendu.
 *
 * La fusion precede la resolution des tokens, car un `defaultProps` peut
 * lui-meme contenir "{{product.name}}".
 */
export function mergeBlockProps(
  stored: Record<string, unknown> | undefined,
  defaults: Record<string, unknown> | undefined
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...defaults, ...stored };
  repairEmptySources(merged, defaults);
  return merged;
}

/**
 * REPARATION DE DONNEES.
 *
 * Une version de ce registry declarait les sources de donnees (features, images,
 * badges) avec `[]` comme valeur par defaut, pour satisfaire un typage trop
 * strict. Les blocs ajoutes dans l'editeur a cette periode ont donc enregistre
 * `source: []`, qui ecrase le token et fait rendre un bloc VIDE, sans aucun
 * signal.
 *
 * Un tableau vide la ou la valeur par defaut est une chaine ne peut venir que de
 * ce defaut : une source s'ecrit toujours "{{...}}". On retombe donc sur la
 * valeur par defaut, ce qui repare les templates deja publies sans avoir a les
 * rouvrir. Les vrais champs tableau (mapping, items) ont un defaut tableau et ne
 * sont pas concernes.
 */
function repairEmptySources(
  props: Record<string, unknown>,
  defaults: Record<string, unknown> | undefined
): void {
  if (!defaults) return;

  for (const [name, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length === 0 && typeof defaults[name] === "string") {
      props[name] = defaults[name];
    }
  }
}

/**
 * Resout les tokens des props contre le jeu de donnees.
 *
 * `puck` est ecarte : c'est le contexte de l'editeur (isEditing, metadata), pas
 * de la donnee de template, et le traverser n'aurait aucun sens.
 */
export function resolveBlockProps(
  props: Record<string, unknown>,
  data: unknown
): Record<string, unknown> {
  const { puck, ...rest } = props;
  const resolved = resolveValue(rest, data) as Record<string, unknown>;
  return puck === undefined ? resolved : { ...resolved, puck };
}
