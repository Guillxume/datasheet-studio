"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ActionBar, createUsePuck, type Data } from "@puckeditor/core";
import { Checkbox } from "@guillxume/ui/components/checkbox";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import { Component, Group, Ungroup } from "lucide-react";
import type { EditorComponentChoice } from "@/blocks/previewConfig";
import {
  canGroupWithNext,
  componentBody,
  componentContentFrom,
  groupWithNext,
  replaceWithComponent,
  slugify,
  ungroup,
  zoneItems,
  GROUP_BLOCK,
  type TreeNode,
} from "@/blocks/grouping";
import Dialog from "@/components/Dialog";

/**
 * Grouper, degrouper, creer un composant — depuis la barre d'action du bloc
 * selectionne.
 *
 * Retours utilisateur : « grouper des elements pour faciliter le deplacement »
 * et « creer le composant depuis le template plutot que de faire le travail deux
 * fois ». Les operations sur l'arbre sont dans src/blocks/grouping.ts ; ici, on
 * ne fait que les proposer et les appliquer.
 *
 * DEUX COMPOSANTS, DEUX POINTS DE MONTAGE, tous deux dans le contexte de Puck :
 *  - `BlockActionBar` remplace la barre d'action (`overrides.actionBar`). Elle
 *    n'existe que tant que le bloc est selectionne ;
 *  - `CreateComponentDialog` vit dans `overrides.puck`, donc pour toute la duree
 *    de l'editeur : la boite doit survivre a ce que la barre, elle, disparaisse
 *    (clic hors du bloc, changement de selection). La barre la reveille par un
 *    evenement DOM, comme ContainerTag le fait pour le pont des conteneurs.
 *
 * UNE BOITE, ET NON UNE PAGE, malgre la regle de src/components/Dialog.tsx
 * (« un formulaire va dans une page ») : quitter l'editeur pour remplir ce
 * formulaire ferait perdre les modifications non enregistrees du template —
 * celles-la memes dont on veut faire un composant.
 */

const usePuckStore = createUsePuck();

const OPEN_EVENT = "ds:create-component";

const newId = (type: string) => `${type}-${crypto.randomUUID()}`;

/** Le bloc selectionne et sa position, au format de Puck. */
function useSelection() {
  const data = usePuckStore((s) => s.appState.data);
  const selector = usePuckStore((s) => s.appState.ui.itemSelector);
  const node =
    selector && selector.zone ? (zoneItems(data, selector.zone)?.[selector.index] ?? null) : null;
  return { data, zone: selector?.zone ?? null, index: selector?.index ?? -1, node };
}

export function BlockActionBar({
  label,
  children,
  parentAction,
  composing,
}: {
  label?: string;
  children: ReactNode;
  parentAction: ReactNode;
  /** On compose un composant : pas de composant dans un composant. */
  composing: boolean;
}) {
  const dispatch = usePuckStore((s) => s.dispatch);
  const { data, zone, index, node } = useSelection();

  const groupable = zone !== null && canGroupWithNext(data, zone, index);
  const isGroup = node?.type === GROUP_BLOCK;
  const extractable = !composing && node !== null && componentContentFrom(node) !== null;

  return (
    <ActionBar>
      <ActionBar.Group>
        {parentAction}
        {label ? <ActionBar.Label label={label} /> : null}
      </ActionBar.Group>
      <ActionBar.Group>
        {groupable ? (
          <ActionBar.Action
            label={isGroup ? "Ajouter le bloc suivant au groupe" : "Grouper avec le bloc suivant"}
            onClick={() =>
              dispatch({
                type: "setData",
                data: (previous: Data) => groupWithNext(previous, zone, index, newId(GROUP_BLOCK)),
                // `setData` n'entre pas dans l'historique par defaut : sans cela,
                // « Annuler » ne deferait pas le groupement.
                recordHistory: true,
              })
            }
          >
            <Group size={16} />
          </ActionBar.Action>
        ) : null}
        {isGroup && zone !== null ? (
          <ActionBar.Action
            label="Dégrouper"
            onClick={() => {
              dispatch({
                type: "setData",
                data: (previous: Data) => ungroup(previous, zone, index),
                recordHistory: true,
              });
              // Le groupe n'existe plus : rien ne doit rester selectionne a sa place.
              dispatch({ type: "setUi", ui: { itemSelector: null } });
            }}
          >
            <Ungroup size={16} />
          </ActionBar.Action>
        ) : null}
        {extractable ? (
          <ActionBar.Action
            label="Créer un composant à partir de ce bloc"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
          >
            <Component size={16} />
          </ActionBar.Action>
        ) : null}
        {children}
      </ActionBar.Group>
    </ActionBar>
  );
}

/** Une requete a l'API d'edition ; leve l'erreur qu'elle renvoie. */
async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/editor/template", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

export function CreateComponentDialog({
  scope,
  onCreated,
}: {
  /** Portee du template ouvert : le composant est cree au meme endroit. */
  scope: string;
  onCreated: (choice: EditorComponentChoice) => void;
}) {
  const dispatch = usePuckStore((s) => s.dispatch);
  const config = usePuckStore((s) => s.config);
  const selection = useSelection();
  const id = useId();

  /**
   * Le bloc Composant a selectionner, une fois que Puck a RECU la configuration
   * qui connait le nouveau composant. Selectionne trop tot — dans la foulee de la
   * creation —, le panneau de champs resolvait les champs avec l'ancienne
   * configuration et affichait « Choisir… » au lieu du composant cite.
   */
  const pendingSelect = useRef<{ zone: string; index: number; config: unknown } | null>(null);
  useEffect(() => {
    const pending = pendingSelect.current;
    if (!pending || pending.config === config) return;
    pendingSelect.current = null;
    dispatch({ type: "setUi", ui: { itemSelector: { zone: pending.zone, index: pending.index } } });
  }, [config, dispatch]);

  /** Le bloc vise, FIGE a l'ouverture : la selection peut changer pendant la saisie. */
  const [target, setTarget] = useState<{ zone: string; index: number; content: TreeNode[] } | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const open = () => {
      const content = selection.node ? componentContentFrom(selection.node) : null;
      if (!content || selection.zone === null) return;
      setTarget({ zone: selection.zone, index: selection.index, content });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setReplace(true);
      setError(null);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [selection.node, selection.zone, selection.index]);

  if (!target) return null;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      /*
       * Trois appels aux actions existantes, et non une action nouvelle : ce sont
       * les memes controles (slug, droits, journal) que la creation depuis
       * l'accueil. Le composant est PUBLIE tout de suite — sans cela il ne serait
       * pas deplie (seule la version publiee l'est). Sans risque : aucun
       * template publie ne le cite encore, celui-ci compris tant qu'il n'est
       * pas lui-meme republie.
       */
      await post({ action: "create", scope, slug, name, kind: "component" });
      await post({
        action: "save",
        scope,
        slug,
        trees: { body: componentBody(target.content, newId("Page")), header: null, footer: null, css: null, settings: {} },
      });
      const published = await post({ action: "publish", scope, slug });

      onCreated({
        slug,
        name,
        shared: scope === "shared",
        publishedVersion: published.published_version ?? 1,
        content: target.content,
      });

      if (replace) {
        dispatch({
          type: "setData",
          data: (previous: Data) => replaceWithComponent(previous, target.zone, target.index, slug, newId("Composant")),
          recordHistory: true,
        });
        dispatch({ type: "setUi", ui: { itemSelector: null } });
        pendingSelect.current = { zone: target.zone, index: target.index, config };
      }
      setTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Créer un composant"
      confirmLabel="Créer le composant"
      busy={busy}
      onConfirm={() => {
        if (name.trim() !== "" && slug !== "") void create();
        else setError("Le nom et le slug sont requis.");
      }}
      onCancel={() => setTarget(null)}
    >
      <div className="grid gap-4">
        <p className="m-0">
          {target.content.length > 1 ? `${target.content.length} blocs deviennent` : "Ce bloc devient"} un
          composant réutilisable,
          publié aussitôt dans {scope === "shared" ? "la bibliothèque commune" : `la boutique « ${scope} »`}.
          Il ne change aucune fiche tant qu&apos;un template qui le cite n&apos;est pas publié.
        </p>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Nom affiché</Label>
          <Input
            id={`${id}-name`}
            value={name}
            placeholder="Bandeau coordonnées"
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-slug`}>Slug</Label>
          <Input
            id={`${id}-slug`}
            className="font-mono"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugTouched(true);
            }}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id={`${id}-replace`}
            checked={replace}
            onCheckedChange={(value) => setReplace(value === true)}
          />
          <Label htmlFor={`${id}-replace`} className="leading-snug font-normal">
            Remplacer ce bloc par le composant dans ce template — les modifications du composant s&apos;y
            appliqueront alors aussi.
          </Label>
        </div>

        {error ? (
          <p role="alert" className="text-destructive m-0">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
