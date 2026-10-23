"use client";

import { Fragment, isValidElement, useEffect, type ReactElement, type ReactNode } from "react";
import { usePuck, type Config } from "@puckeditor/core";
import { mergeBlockProps, resolveBlockProps } from "@/lib/blockProps";
import { PAGE_BLOCK } from "@/lib/pages";
import { datasheetConfig } from "./registry";

/**
 * Config de l'editeur derivee du registry, pour que le canvas montre ENFIN ce
 * que le PDF produira.
 *
 * LE PROBLEME. Le registry est partage entre l'editeur et le rendu PDF, ce qui
 * garantit que le meme composant React produit les deux. Mais les PROPS qu'on lui
 * passait n'etaient pas les memes. Le chemin PDF resout les tokens avant
 * d'appeler `render` ; l'editeur, non. Un `FeatureTable` recevait donc la chaine
 * "{{features}}" au lieu du tableau, et comme un bloc dont la source est vide
 * doit s'effacer, il rendait `<></>` : INVISIBLE dans le canvas, pleine page dans
 * le PDF. Idem pour la galerie, les pictos, les grilles ; et les images
 * s'affichaient en icone cassee, leur `src` valant litteralement "{{shop.logo}}".
 *
 * Autrement dit, les blocs qui prennent le plus de place a l'impression etaient
 * precisement ceux qui n'en prenaient aucune a l'ecran. Impossible de composer
 * une fiche dans ces conditions, et impossible de voir un debordement avant de
 * rendre le PDF.
 *
 * CE QUE CE MODULE AJOUTE, sans toucher au registry :
 *
 *  1. les tokens sont resolus contre un jeu de donnees d'exemple, avec le meme
 *     code que le chemin PDF (src/lib/blockProps.ts) ;
 *  2. tout bloc qui ne produirait rien est remplace par un PLACEHOLDER qui dit
 *     pourquoi — ce qui le rend selectionnable et supprimable, et repond a la
 *     question « pourquoi mon bloc est-il vide ? » sans passer par
 *     `?format=html` ;
 *  3. les blocs invisibles par nature (saut de page) recoivent une
 *     representation.
 *
 * Ces trois points s'appliquent en mode Apercu ET en mode Tokens, pour tout
 * bloc SANS champ contentEditable (donc pas Heading ni Text) : un bloc
 * "Produit" glisse pendant l'edition des textes n'a rien de sense a montrer a
 * partir d'un token brut, et redevenait invisible pour la meme raison que le
 * probleme decrit plus haut — juste deplace d'un mode a l'autre plutot
 * qu'elimine. Voir `hasEditableField` dans `buildEditorConfig`.
 *
 * GARANTIE STRUCTURELLE : ce module n'est JAMAIS importe par le chemin de rendu,
 * qui consomme `datasheetConfig` directement. Un placeholder ne peut donc pas
 * fuir dans un PDF, quelle que soit l'erreur commise ici.
 */

export type CanvasMode = "preview" | "tokens";

type AnyProps = Record<string, unknown>;

type ComponentEntry = {
  label?: string;
  render: (props: AnyProps) => ReactNode;
  defaultProps?: AnyProps;
  fields?: Record<string, { type?: string; contentEditable?: boolean }>;
};

/** Un src vide signifie « rien a afficher » : meme regle que le registry. */
const hasSrc = (value: unknown): boolean => typeof value === "string" && value.length > 0;

const hasText = (value: unknown): boolean =>
  (typeof value === "string" && value.trim().length > 0) || typeof value === "number";

/**
 * Pourquoi ce bloc ne produira rien.
 *
 * Le diagnostic est etabli AVANT le rendu, sur les props deja resolues : c'est ce
 * qui permet de couvrir aussi les blocs qui rendent bien un element mais de
 * hauteur nulle — un texte riche sans contenu rend un `<div>` vide, invisible et
 * donc inselectionnable, sans pour autant rendre `<></>`.
 *
 * Les messages nomment la cause reelle et, quand c'est possible, le reglage
 * fautif. « Aucune donnee » n'aiderait personne ; « le reglage "Ignorer les 1
 * premieres images" laisse 0 image sur 1 » se corrige tout de suite.
 */
function diagnose(type: string, props: AnyProps): string | null {
  const source = props.source;

  switch (type) {
    case "FeatureTable": {
      if (!Array.isArray(source)) {
        return "La source ne renvoie pas de liste : le token du champ « Données affichées » ne résout rien.";
      }
      return source.length === 0
        ? "Ce produit n'a aucune caractéristique dans le jeu de données choisi."
        : null;
    }

    case "ImageGallery": {
      if (!Array.isArray(source)) {
        return "La source ne renvoie pas de liste : le token du champ « Données affichées » ne résout rien.";
      }
      const usable = source.filter((item) => hasSrc((item as { src?: unknown })?.src)).length;
      if (usable === 0) {
        return "Ce produit n'a aucune image dans le jeu de données choisi.";
      }
      const skip = typeof props.skip === "number" ? props.skip : 0;
      if (skip >= usable) {
        return `Le réglage « Ignorer les ${skip} premières images » ne laisse rien à afficher : ce produit n'en a que ${usable}.`;
      }
      return null;
    }

    case "BadgeRow": {
      const badges = Array.isArray(source) ? (source as string[]) : [];
      const rules = Array.isArray(props.mapping) ? (props.mapping as { badge?: string; iconUrl?: string }[]) : [];
      if (rules.length === 0) {
        return "Aucune correspondance badge / picto n'est définie : le bloc ne peut rien afficher tant que la liste est vide.";
      }
      if (badges.length === 0) {
        return "Ce produit ne porte aucun badge dans le jeu de données choisi.";
      }
      const matched = rules.some(
        (rule) =>
          hasSrc(rule.iconUrl) &&
          badges.some((badge) => badge === rule.badge || badge.startsWith(`${rule.badge}:`))
      );
      return matched
        ? null
        : `Aucune règle ne correspond aux badges du produit (${badges.join(", ")}), ou le picto associé est vide.`;
    }

    case "KeyValueGrid":
      return Array.isArray(props.items) && props.items.length > 0
        ? null
        : "Aucune entrée dans la grille : les ajouter dans le panneau de droite.";

    case "SwatchGroups": {
      if (!Array.isArray(source)) {
        return "La source ne renvoie pas de liste : le token du champ « Données affichées » ne résout rien.";
      }
      if (source.length === 0) {
        return "Ce produit ne propose aucune finition dans le jeu de données choisi — essayer un profil de famille (Vestiaire, Siège, Bureau).";
      }
      const options = (source as { options?: unknown[] }[]).reduce(
        (total, group) => total + (Array.isArray(group?.options) ? group.options.length : 0),
        0
      );
      return options === 0 ? "Les groupes de finitions n'ont aucune valeur." : null;
    }

    case "HighlightRow": {
      // Meme diagnostic que BadgeRow, meme source : ce qui change est qu'ici un
      // picto vide n'empeche RIEN, le libelle suffisant a porter l'information.
      const badges = Array.isArray(source) ? (source as string[]) : [];
      const rules = Array.isArray(props.mapping)
        ? (props.mapping as { badge?: string }[])
        : [];
      if (rules.length === 0) {
        return "Aucune correspondance badge / libellé n'est définie : le bloc ne peut rien afficher tant que la liste est vide.";
      }
      if (badges.length === 0) {
        return "Ce produit ne porte aucun badge dans le jeu de données choisi.";
      }
      const matched = rules.some((rule) =>
        badges.some((badge) => badge === rule.badge || badge.startsWith(`${rule.badge}:`))
      );
      return matched
        ? null
        : `Aucune règle ne correspond aux badges du produit (${badges.join(", ")}).`;
    }

    case "CardGrid": {
      if (source === "") {
        const saisies = Array.isArray(props.items) ? props.items : [];

        return saisies.length > 0
          ? null
          : "Source réglée sur « saisie manuelle » et aucune fiche saisie : les ajouter dans le panneau de droite.";
      }
      if (!Array.isArray(source)) {
        return "La source ne renvoie pas de liste : le token du champ « Données affichées » ne résout rien.";
      }
      const named = (source as { name?: unknown }[]).filter(
        (card) => typeof card?.name === "string" && card.name !== ""
      ).length;
      if (source.length === 0) {
        return "Ce produit n'a aucun accessoire dans le jeu de données choisi — essayer un profil de famille (Vestiaire, Siège, Bureau).";
      }
      return named === 0 ? "Aucune fiche ne porte de nom : elles ne seraient pas identifiables." : null;
    }

    case "SchemaImage":
      return hasSrc(source) ? null : "Ce produit n'a pas de schéma coté dans le jeu de données choisi.";

    case "Image":
      return hasSrc(source) ? null : "Le champ « Image » ne résout aucune image.";

    case "QrCode":
      return hasSrc(props.source) || hasText(props.content)
        ? null
        : "Aucun contenu à encoder : le QR ne peut pas être généré.";

    case "RichText":
      return hasText(props.html)
        ? null
        : "Aucun contenu HTML : ce produit n'a pas de description longue dans le jeu de données choisi.";

    case "Heading":
      return hasText(props.text) ? null : "Titre vide.";

    case "Text":
      return hasText(props.content) ? null : "Paragraphe vide.";

    default:
      return null;
  }
}

/**
 * Un rendu qui n'occupe aucune place.
 *
 * Filet de securite pour les blocs que `diagnose` ne connait pas : la regle du
 * registry est qu'un bloc sans donnee retourne `<></>`, et tout bloc futur
 * heritera donc d'un placeholder sans qu'il y ait rien a declarer ici.
 */
function isEmptyRender(node: ReactNode): boolean {
  if (node === null || node === undefined || node === false || node === true || node === "") {
    return true;
  }
  if (Array.isArray(node)) {
    return node.every(isEmptyRender);
  }
  if (isValidElement(node)) {
    if (node.type !== Fragment) return false;
    const children = (node.props as { children?: ReactNode }).children;
    return children === undefined ? true : isEmptyRender(children);
  }
  return false;
}

/**
 * Placeholder d'un bloc qui n'apparaitra pas dans le PDF.
 *
 * Il occupe de la place a l'ecran alors que le bloc n'en occupera aucune a
 * l'impression : c'est un mensonge deliberé, sans lequel le bloc serait
 * inselectionnable. Il est donc marque « absent du PDF » et porte
 * `data-ds-void`, ce qui permet a la barre de mesure de le retirer du calcul de
 * pagination.
 */
function VoidBlock({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="ds-void" data-ds-void="1">
      <span className="ds-void-head">
        {label} <em>absent du PDF</em>
      </span>
      <span className="ds-void-reason">{reason}</span>
    </div>
  );
}

/**
 * Un bloc qui SORTIRA, mais pas comme son auteur l'attend.
 *
 * Different de `VoidBlock`, qui annonce une absence : ici le bloc s'imprime, et
 * c'est justement le probleme. Le contenu reel est donc conserve dessous — on
 * doit voir ce qui va sortir — surmonte de ce qui cloche et de la correction.
 *
 * Pas de `data-ds-void` : ce bloc occupe bel et bien sa place a l'impression, il
 * doit continuer de compter dans la mesure de pagination.
 */
function WarnBlock({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="ds-warn">
      <span className="ds-warn-head">{message}</span>
      {children}
    </div>
  );
}

/**
 * Une valeur destinee a du texte brut contient-elle du balisage ?
 *
 * Deux formes, deux causes distinctes, deux corrections differentes :
 *   - des balises REELLES (`<p>`, `<strong>`) dans un bloc de texte brut : le
 *     bloc les imprimera telles quelles, il faut le bloc « Texte riche (HTML) » ;
 *   - des balises DEJA ECHAPPEES (`&lt;p&gt;`) : aucun bloc ne les affichera en
 *     mise en forme, y compris « Texte riche » — la source a encode deux fois,
 *     et c'est la qu'il faut corriger.
 *
 * Le motif exige un nom de balise commencant par une lettre : « largeur < 5 mm »
 * ou « a < b » ne declenchent donc rien.
 */
const BALISE_REELLE = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/i;
const BALISE_ECHAPPEE = /&lt;\/?[a-z][a-z0-9]*(?:\s[^&]*)?&gt;/i;

function warnAbout(type: string, props: AnyProps): string | null {
  const texte = (valeur: unknown): string => (typeof valeur === "string" ? valeur : "");

  if (type === "Text" || type === "Heading") {
    const valeur = texte(type === "Text" ? props.content : props.text);
    if (BALISE_REELLE.test(valeur)) {
      return "Ce contenu est du HTML. Ce bloc imprime du texte brut : les balises sortiront telles quelles dans le PDF. Utilisez le bloc « Texte riche (HTML) ».";
    }
    if (BALISE_ECHAPPEE.test(valeur)) {
      return "Ce contenu est du HTML déjà échappé à la source (&lt;p&gt;). Il sortira avec ses balises visibles, quel que soit le bloc : c'est le champ envoyé par la boutique qu'il faut corriger.";
    }
    return null;
  }

  if (type === "RichText" && BALISE_ECHAPPEE.test(texte(props.html))) {
    return "Ce HTML est déjà échappé à la source (&lt;p&gt;) : il sortira avec ses balises visibles au lieu d'être mis en forme. C'est le champ envoyé par la boutique qu'il faut corriger.";
  }

  return null;
}

/**
 * Le saut de page ne rend qu'une regle CSS d'impression : invisible a l'ecran.
 *
 * Le marqueur montre AUSSI si la condition est remplie pour le profil affiche.
 * Sans cela, un saut conditionnel dont le champ est vide s'affichait comme un
 * saut actif et ne coupait rien dans le PDF — l'editeur aurait annonce une page
 * que le document n'aurait pas eue.
 */
function PageBreakMarker({ mode, onlyIf }: { mode?: string; onlyIf?: string }) {
  const inactif = mode === "ifFilled" && (onlyIf ?? "").trim() === "";

  return (
    <div className={inactif ? "ds-break ds-break-off" : "ds-break"} data-ds-void="1">
      <span>
        {inactif
          ? "saut conditionnel — le champ testé est vide pour ce profil, aucune coupe ici"
          : mode === "ifFilled"
            ? "saut conditionnel — le champ testé est rempli, la suite reprend page suivante"
            : "saut de page forcé — la suite reprend en haut de la page suivante"}
      </span>
    </div>
  );
}

/**
 * Representations propres a l'editeur, pour les blocs dont l'effet est reel mais
 * n'a aucune traduction visuelle a l'ecran.
 */
const EDITOR_RENDER: Record<string, (props: AnyProps) => ReactNode> = {
  PageBreak: (props) => <PageBreakMarker mode={props.mode as string} onlyIf={props.onlyIf as string} />,
};

/**
 * Retire `contentEditable` des champs.
 *
 * OBLIGATOIRE en mode apercu, et pas par choix : quand un champ est declare
 * `contentEditable`, Puck ne passe pas sa valeur au bloc, il passe un ELEMENT
 * React (son editeur en ligne) a la place. Impossible d'y resoudre un token, et
 * surtout : ce que l'utilisateur y taperait remplacerait le token par le texte
 * resolu, detruisant "{{product.name}}" au profit du nom du produit d'exemple.
 *
 * D'ou les deux modes du canvas. En mode « Tokens », les champs redeviennent
 * editables sur place et affichent les tokens ; en mode « Apercu », l'edition se
 * fait par le panneau de droite.
 */
function withoutContentEditable(
  fields: ComponentEntry["fields"]
): ComponentEntry["fields"] {
  if (!fields) return fields;

  let touched = false;
  const out: NonNullable<ComponentEntry["fields"]> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (field?.contentEditable) {
      out[name] = { ...field, contentEditable: false };
      touched = true;
      continue;
    }
    out[name] = field;
  }

  return touched ? out : fields;
}

type ContainerEventDetail = { id: string; slotFields?: string[] };

/**
 * Un conteneur (Colonnes, Panneau, Element positionne) a-t-il au moins un bloc
 * dans l'un des slots nommes — la question qui decide si la suppression doit
 * etre confirmee.
 *
 * Fonction pure, sans Puck ni DOM, testable sans monter `<Puck>` : c'est la
 * seule vraie logique metier de `ContainerActionsBridge`, le reste n'etant que
 * du branchement d'evenements et des appels directs a `dispatch`.
 */
export function containerHasContent(
  item: { props?: Record<string, unknown> } | null | undefined,
  slotFields: string[]
): boolean {
  if (!item) return false;
  const props = item.props;
  return slotFields.some((field) => Array.isArray(props?.[field]) && (props![field] as unknown[]).length > 0);
}

/**
 * Un bloc tombe a la RACINE du corps, hors de toute page : ou le ranger.
 *
 * La racine du corps ne doit porter que des Pages — le rendu, comme le canvas, ne
 * sait dessiner que des pages (src/lib/pages.ts). Or Puck n'offre aucun moyen de
 * restreindre la zone racine (pas d'`allow` sur elle), et elle recoit tout depot
 * fait ENTRE deux feuilles ou sous la derniere. Un Paragraphe lache la y restait,
 * orphelin ; au rechargement, normalizeBodyTree aurait alors range le corps
 * ENTIER, Pages comprises, dans une nouvelle page.
 *
 * Le bloc rejoint la FIN de la page qui le precede — c'est la que l'on visait en
 * lachant sous une feuille —, ou le DEBUT de la suivante s'il est tombe avant la
 * premiere. Sans aucune page, rien a faire : normalizeBodyTree s'en charge.
 *
 * Fonction pure, comme containerHasContent : le pont ne fait qu'appliquer ce
 * qu'elle rend.
 */
export function strayRootBlockMove(
  content: unknown[]
): { sourceIndex: number; destinationZone: string; destinationIndex: number } | null {
  const pageOf = (node: unknown) =>
    node !== null && typeof node === "object" && (node as { type?: unknown }).type === PAGE_BLOCK
      ? (node as { props?: { id?: unknown; content?: unknown } })
      : null;

  const stray = content.findIndex((node) => pageOf(node) === null);
  if (stray === -1) return null;

  for (let index = stray - 1; index >= 0; index--) {
    const page = pageOf(content[index]);
    if (page && typeof page.props?.id === "string") {
      const length = Array.isArray(page.props.content) ? page.props.content.length : 0;
      return { sourceIndex: stray, destinationZone: `${page.props.id}:content`, destinationIndex: length };
    }
  }
  for (let index = stray + 1; index < content.length; index++) {
    const page = pageOf(content[index]);
    if (page && typeof page.props?.id === "string") {
      return { sourceIndex: stray, destinationZone: `${page.props.id}:content`, destinationIndex: 0 };
    }
  }
  return null;
}

/**
 * Pont entre l'etiquette de conteneur (registry.tsx, sans hook) et l'API de
 * Puck (avec hooks, donc interdite dans le registry — voir son en-tete).
 *
 * POURQUOI UN EVENEMENT DOM PLUTOT QU'UNE PROP. `ContainerTag` (Colonnes,
 * Panneau, Element positionne) est rendu par le MEME registry que le chemin
 * PDF ; lui donner acces a `usePuck()` directement planterait le rendu serveur,
 * qui charge sa propre instance de React sans dispatcher de hooks valide. Le
 * clic emet donc un CustomEvent DOM ordinaire — aucun hook cote emetteur — que
 * ce pont, lui, ecoute avec `usePuck()`.
 *
 * POURQUOI CE COMPOSANT EST UN DESCENDANT SUR DE `<Puck>`. `overrides.preview`
 * est le point d'extension documente pour envelopper le rendu du canvas SANS
 * modifier le reste de la mise en page de l'editeur (barre d'outils, panneaux) :
 * le composant qu'on y place est necessairement monte a l'interieur de l'arbre
 * React de `<Puck>`, donc `usePuck()` y trouve son contexte.
 *
 * OU CET OBJET DOIT ARRIVER — la lecon d'un defaut vecu. `overrides` est une
 * PROP de `<Puck>`, pas un champ de `Config`. Une premiere version le rangeait
 * dans l'objet de configuration : Puck l'ignorait purement et simplement, ce
 * pont n'etait jamais monte, et TOUTES ses actions (selectionner, dupliquer,
 * supprimer un conteneur, ajouter une page) partaient dans le vide sans la
 * moindre erreur. C'est pour cela que `buildEditorConfig` rend desormais une
 * paire `{ config, overrides }` : on ne peut plus recuperer la configuration
 * sans voir passer les overrides, et le compilateur casse chez tout appelant
 * qui les oublierait.
 *
 * La confirmation avant suppression ne porte que sur les conteneurs NON VIDES :
 * un Panneau ou des Colonnes vides se suppriment sans detour, comme les autres
 * blocs.
 */
/**
 * Identifiant de la zone racine chez Puck : `<aire>:<zone>`, soit
 * « root:default-zone ». Verifie a l'execution, voir onAddPage.
 */
const ROOT_ZONE = "root:default-zone";

function ContainerActionsBridge({ children, zone }: { children: ReactNode; zone: string }) {
  const { dispatch, getSelectorForId, getItemById, appState } = usePuck();

  /**
   * Range dans une page tout bloc tombe a la racine du corps — voir
   * strayRootBlockMove. Corps seulement : en-tete et pied n'ont pas de pages.
   *
   * `recordHistory: false` : le rangement complete le depot, il n'est pas un
   * geste a part. Enregistre, « Annuler » ramenerait le bloc a la racine, que cet
   * effet rangerait aussitot — l'utilisateur ne pourrait plus remonter plus loin.
   * Un bloc deplace a la fois : l'effet repasse apres chaque changement d'etat.
   */
  useEffect(() => {
    if (zone !== "body") return;
    const move = strayRootBlockMove(appState.data.content as unknown[]);
    if (move) {
      dispatch({ type: "move", sourceZone: ROOT_ZONE, ...move, recordHistory: false });
    }
  }, [zone, appState.data.content, dispatch]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const { id } = (event as CustomEvent<ContainerEventDetail>).detail ?? {};
      const selector = id ? getSelectorForId(id) : undefined;
      if (selector) dispatch({ type: "setUi", ui: { itemSelector: selector } });
    };

    const onDuplicate = (event: Event) => {
      const { id } = (event as CustomEvent<ContainerEventDetail>).detail ?? {};
      const selector = id ? getSelectorForId(id) : undefined;
      if (selector) dispatch({ type: "duplicate", sourceIndex: selector.index, sourceZone: selector.zone });
    };

    const onRemove = (event: Event) => {
      const { id, slotFields } = (event as CustomEvent<ContainerEventDetail>).detail ?? {};
      if (!id) return;
      const selector = getSelectorForId(id);
      if (!selector) return;

      if (containerHasContent(getItemById(id), slotFields ?? [])) {
        // window.confirm : le seul mecanisme de confirmation deja disponible
        // sans introduire de composant de dialogue dedie pour ce seul cas.
        const proceed = window.confirm(
          "Ce conteneur contient des blocs. Les supprimer avec lui ?"
        );
        if (!proceed) return;
      }

      dispatch({ type: "remove", index: selector.index, zone: selector.zone });
    };

    /**
     * « Ajouter une page » : insere une PAGE vide a la fin du corps.
     *
     * A la fin et non apres la page selectionnee : le geste veut dire « et
     * ensuite, une nouvelle page ». Elle est creee en mode `always` ; c'est a
     * l'auteur de la conditionner ensuite s'il veut qu'elle disparaisse pour
     * les produits sans le contenu correspondant.
     *
     * ROOT_ZONE est l'identifiant COMPOSE de la zone racine. Une premiere
     * version passait "default-zone" : l'action partait sans erreur et
     * n'inserait rien. Constate sur un Puck reel — `getSelectorForId()` d'un
     * bloc racine renvoie `{ zone: "root:default-zone", index: 0 }`, et
     * l'insertion n'aboutit qu'avec cette forme. A reverifier a chaque montee
     * de version de @puckeditor/core.
     */
    const onAddPage = () => {
      dispatch({
        type: "insert",
        componentType: PAGE_BLOCK,
        // En fin de zone : la longueur du contenu EST l'index de la fin.
        destinationIndex: appState.data.content.length,
        destinationZone: ROOT_ZONE,
      });
    };

    window.addEventListener("ds:add-page", onAddPage);
    window.addEventListener("ds:select-container", onSelect);
    window.addEventListener("ds:duplicate-container", onDuplicate);
    window.addEventListener("ds:remove-container", onRemove);

    return () => {
      window.removeEventListener("ds:add-page", onAddPage);
      window.removeEventListener("ds:select-container", onSelect);
      window.removeEventListener("ds:duplicate-container", onDuplicate);
      window.removeEventListener("ds:remove-container", onRemove);
    };
  }, [dispatch, getSelectorForId, getItemById, appState]);

  return <>{children}</>;
}

/**
 * Rend l'arbre d'une zone repetee pour l'AFFICHER dans le canvas du corps.
 *
 * POURQUOI CETTE FONCTION EXISTE. Une page du studio doit montrer l'en-tete et
 * le pied reels, puisque c'est ce que la feuille imprimee portera. Or ces
 * bandeaux vivent dans des arbres separes, que le registry ne peut pas lire : il
 * est partage avec le chemin PDF, ou ces zones sont dessinees par Chromium en
 * dehors du document. L'editeur les rend donc lui-meme et les passe par
 * `<Puck metadata>`.
 *
 * Le rendu passe par le MEME pipeline que les blocs du corps — fusion des props
 * par defaut puis resolution des tokens contre le profil d'exemple — sinon un
 * en-tete affichant « {{shop.name}} » montrerait le token au lieu du nom.
 *
 * Les blocs sont rendus SANS contexte Puck : ils prennent donc leur branche
 * « chemin PDF », c'est-a-dire sans etiquette, sans repere et sans placeholder.
 * C'est voulu — on regarde ici un resultat, on ne l'edite pas.
 */
export function renderZonePreview(tree: unknown, data: unknown): ReactNode {
  const content = (tree as { content?: unknown[] } | undefined)?.content;
  if (!Array.isArray(content) || content.length === 0) return undefined;
  return <>{content.map((node, index) => renderZoneNode(node, data, index))}</>;
}

function renderZoneNode(node: unknown, data: unknown, key: number): ReactNode {
  if (node === null || typeof node !== "object") return null;

  const { type, props } = node as { type?: string; props?: AnyProps };
  if (!type) return null;

  const entry = (datasheetConfig.components as unknown as Record<string, ComponentEntry>)[type];
  if (!entry) return null;

  const prepared = resolveBlockProps(
    mergeBlockProps(props ?? {}, entry.defaultProps),
    data
  ) as AnyProps;

  // Un slot arrive en TABLEAU de noeuds et se consomme en COMPOSANT : c'est le
  // contrat que Puck etablit dans l'editeur, et que le chemin PDF reproduit.
  for (const [name, field] of Object.entries(entry.fields ?? {})) {
    if (field?.type !== "slot") continue;
    const enfants = Array.isArray(prepared[name]) ? (prepared[name] as unknown[]) : [];
    prepared[name] = () => <>{enfants.map((enfant, index) => renderZoneNode(enfant, data, index))}</>;
  }

  const Component = entry.render;
  return <Component key={key} {...prepared} />;
}

/** Le type du bloc « Composant » (src/lib/components.ts, COMPONENT_BLOCK). */
const COMPONENT_TYPE = "Composant";

export type EditorConfigOptions = {
  mode: CanvasMode;
  /** Jeu de donnees d'exemple, deja prepare cote serveur. */
  data: unknown;
  /** Zone editee : la geometrie de page n'a de sens que dans le corps. */
  zone: string;
  /**
   * Les composants que ce template peut citer, avec le contenu a montrer. Le
   * bloc « Composant » propose cette liste et affiche le contenu choisi.
   */
  components?: EditorComponentChoice[];
  /** Quand on compose un COMPOSANT, le bloc « Composant » n'est pas propose. */
  kind?: "template" | "component";
};

/** Un composant tel que l'editeur le propose (src/lib/componentStore.ts, listComponentsFor). */
export type EditorComponentChoice = {
  slug: string;
  name: string;
  shared: boolean;
  publishedVersion: number | null;
  content: unknown[];
};

/**
 * Le bloc « Composant » dans le canvas : le CONTENU du composant, rendu en
 * lecture seule par le meme chemin que l'en-tete et le pied, dans un cadre qui
 * dit ce que c'est et qu'il se modifie ailleurs.
 *
 * Un composant jamais publie montre son brouillon, et le dit : au rendu, il
 * n'apparaitrait pas (seule la version publiee est depliee).
 */
function ComponentBlock({
  slug,
  choices,
  data,
}: {
  slug: string;
  choices: EditorComponentChoice[];
  data: unknown;
}) {
  const chosen = choices.find((item) => item.slug === slug);
  if (!slug) {
    return <VoidBlock label="Composant" reason="Choisir un composant dans le panneau de droite." />;
  }
  if (!chosen) {
    return (
      <VoidBlock
        label="Composant"
        reason={`Composant « ${slug} » introuvable pour cette portée : il ne sortira pas sur les fiches.`}
      />
    );
  }
  return (
    <div className="ds-component-block" data-component={chosen.slug}>
      <div className="ds-component-label">
        Composant · {chosen.name}
        {chosen.publishedVersion === null ? " — non publié : absent des fiches" : ` · v${chosen.publishedVersion}`}
      </div>
      {renderZonePreview({ content: chosen.content }, data)}
    </div>
  );
}

/**
 * Ce que l'editeur doit passer a `<Puck>` : la configuration ET les overrides.
 *
 * Les deux sont rendus ENSEMBLE et separement parce qu'ils vont a deux endroits
 * differents — `config={...}` et `overrides={...}` — et que les confondre a
 * deja coute une fonctionnalite entierement morte (voir ContainerActionsBridge).
 */
export type EditorSetup<T extends Config> = {
  config: T;
  // `ReactElement` et non `ReactNode` : c'est ce que le type Overrides de Puck
  // exige, et le compilateur l'a signale des le premier branchement reel.
  overrides: { preview: (props: { children: ReactNode }) => ReactElement };
};

/**
 * Le type Config de Puck est parametre par la carte des props de CHAQUE bloc.
 * Le derivant bloc par bloc de facon generique, on ne peut pas le reconstruire
 * sans reecrire cette carte : d'ou les conversions, cantonnees a cette fonction.
 */
export function buildEditorConfig<T extends Config>(
  base: T,
  options: EditorConfigOptions
): EditorSetup<T> {
  const { mode, data, zone } = options;
  const choices = options.components ?? [];
  const composing = options.kind === "component";
  const source = base as unknown as {
    components: Record<string, ComponentEntry>;
    root?: { fields?: Record<string, unknown>; [key: string]: unknown };
    [key: string]: unknown;
  };

  const components: Record<string, ComponentEntry> = {};

  for (const [type, entry] of Object.entries(source.components)) {
    // Pas de composant dans un composant : le bloc disparait de la palette.
    if (type === COMPONENT_TYPE && composing) continue;

    if (type === COMPONENT_TYPE) {
      components[type] = {
        ...entry,
        // Le champ texte du registre devient la liste des composants
        // disponibles : un slug tape a la main finirait en bloc vide.
        fields: {
          component: {
            type: "select",
            label: "Composant",
            options: [
              { label: "Choisir…", value: "" },
              ...choices.map((item) => ({
                label: `${item.name}${item.shared ? " (bibliothèque)" : ""}${item.publishedVersion === null ? " — non publié" : ""}`,
                value: item.slug,
              })),
            ],
          },
        } as unknown as ComponentEntry["fields"],
        render: (props: AnyProps) => (
          <ComponentBlock slug={String(props.component ?? "")} choices={choices} data={data} />
        ),
      };
      continue;
    }

    const override = EDITOR_RENDER[type];

    // Un bloc a edition en ligne (Heading.text, Text.content...) recoit de
    // Puck un ELEMENT React a la place de la valeur du champ contentEditable
    // (voir bind.ts:resolveValue, qui le laisse deliberement intact). Resoudre
    // ses props le detruirait. Ces blocs sont donc les SEULS a garder le
    // passage direct en mode Tokens ; tous les autres suivent desormais le
    // meme pipeline qu'en mode Apercu (resolution + placeholder), qu'ils
    // aient ou non un champ contentEditable — voir le commentaire dans
    // `render` ci-dessous pour le bug que ca corrige.
    const hasEditableField = Object.values(entry.fields ?? {}).some(
      (field) => field?.contentEditable === true
    );

    components[type] = {
      ...entry,
      fields: mode === "preview" ? withoutContentEditable(entry.fields) : entry.fields,
      render: (props: AnyProps) => {
        if (override) {
          // Les props RESOLUES, et pas les brutes : `onlyIf` porte un token dont
          // seule la valeur resolue dit si la condition est remplie.
          return override(resolveBlockProps(mergeBlockProps(props, entry.defaultProps), data));
        }

        // Mode Tokens, bloc a edition en ligne : rien a resoudre, sous peine
        // de detruire l'element d'edition que Puck a substitue au champ.
        if (mode !== "preview" && hasEditableField) {
          return entry.render(props);
        }

        // Tous les autres cas — mode Apercu, OU mode Tokens sur un bloc SANS
        // champ editable (FeatureTable, ImageGallery, Image, QrCode...).
        //
        // Ces blocs n'ont rien de sensé a afficher a partir d'un token brut :
        // il n'existe pas de representation utile d'un "{{features}}" pour un
        // tableau. Leur laisser les props brutes (l'ancien comportement en
        // mode Tokens) reproduisait exactement le bug documente en tete de ce
        // fichier — invisibles a l'ecran, pleine page dans le PDF — simplement
        // deplace du mode Apercu vers le mode Tokens plutot qu'elimine. On leur
        // applique donc LE MEME pipeline de resolution et de placeholder,
        // quel que soit le mode.
        const prepared = resolveBlockProps(mergeBlockProps(props, entry.defaultProps), data);

        const reason = diagnose(type, prepared);
        if (reason !== null) {
          return <VoidBlock label={entry.label ?? type} reason={reason} />;
        }

        const output = entry.render(prepared);
        if (isEmptyRender(output)) {
          return (
            <VoidBlock
              label={entry.label ?? type}
              reason="Ce bloc ne produit rien avec le jeu de données choisi."
            />
          );
        }

        // Le bloc sort, mais peut-etre pas comme son auteur l'attend : on montre
        // le rendu REEL, surmonte de ce qui cloche. Voir warnAbout.
        const warning = warnAbout(type, prepared);
        return warning === null ? output : <WarnBlock message={warning}>{output}</WarnBlock>;
      },
    };
  }

  const categories = source.categories as Record<string, { components?: string[] }> | undefined;

  return {
    config: {
      ...source,
      components,
      categories: composing && categories
        ? Object.fromEntries(Object.entries(categories).filter(([key]) => key !== "composants"))
        : categories,
      root: {
        ...source.root,
        // La racine ne porte que la geometrie de page, le retrait du corps et
        // l'espacement entre blocs. Ces reglages sont lus sur l'arbre du CORPS au
        // rendu : les proposer en editant un bandeau donnait un panneau de champs
        // dont aucune modification n'avait le moindre effet.
        fields: zone === "body" ? source.root?.fields : {},
      },
    } as unknown as T,
    overrides: {
      // Voir ContainerActionsBridge : point d'extension officiel pour envelopper
      // le canvas sans toucher au reste de la mise en page de l'editeur. A
      // passer a `<Puck overrides={...}>` — un `overrides` range dans la config
      // est ignore en silence.
      preview: (props: { children: ReactNode }) => (
        <ContainerActionsBridge zone={zone}>{props.children}</ContainerActionsBridge>
      ),
    },
  };
}
