"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocksPlugin, Puck, type Data, type Plugin } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Badge } from "@guillxume/ui/components/badge";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Button } from "@guillxume/ui/components/button";
import { Icon } from "@guillxume/ui/components/icon";
import { Label } from "@guillxume/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@guillxume/ui/components/tabs";
import { Textarea } from "@guillxume/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@guillxume/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@guillxume/ui/components/tooltip";
import { cn } from "@guillxume/ui/lib/utils";
import { ArrowLeft, Layers, RefreshCw, WifiOff } from "lucide-react";
import { datasheetConfig } from "@/blocks/registry";
import {
  buildEditorConfig,
  renderZonePreview,
  type CanvasMode,
  type EditorComponentChoice,
} from "@/blocks/previewConfig";
import Dialog from "@/components/Dialog";
import { PRINT_ELEMENT_CSS, PRINT_TYPOGRAPHY } from "@/lib/printCss";
import { scopeCss } from "@/lib/scopeCss";
import { normalizeBodyTree } from "@/lib/pages";
import { describeFailure } from "@/lib/describeFailure";
import { decodeWarningsHeader } from "@/lib/renderWarnings";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DEFAULT_SAMPLE_PROFILE,
  SAMPLE_PROFILES,
  type SampleProfileId,
} from "@/lib/sampleProfiles";
import { BlockActionBar, CreateComponentDialog } from "./BlockActions";
import EditorHotkeys from "./EditorHotkeys";
import LayersPanel from "./LayersPanel";
import { measureCanvas, type CanvasMetrics } from "./measure";
import {
  CheckPanel,
  Metrics,
  PreviewDock,
  VariablesPanel,
  type CheckRow,
  type PreviewMeta,
} from "./panels";

/**
 * Editeur Drag'N'Drop.
 *
 * Consomme LE MEME registry que le moteur de rendu PDF (src/blocks/registry.tsx),
 * derive pour l'editeur par src/blocks/previewConfig.tsx : le meme composant React
 * produit l'apercu et le PDF, et desormais avec les MEMES props — les tokens sont
 * resolus des deux cotes.
 *
 * Trois zones a editer — corps, en-tete, pied de page — et Puck n'en edite qu'une
 * a la fois. On remonte donc Puck par zone (la cle force le remontage) en
 * conservant les trois arbres dans cet etat.
 */
/*
 * ---------------------------------------------------------------------------
 * CE COMPOSANT FAIT PRES DE MILLE LIGNES ET PORTE 24 `useState`. ON NE LE
 * REECRIT PAS — decision du 02/09/2026.
 *
 * Le compte de lignes et le compte de `useState` sont des indices, pas des
 * defauts. Pour un editeur qui porte un canvas, des panneaux, un apercu, une
 * barre de mesure et un etat d'enregistrement, vingt-quatre morceaux d'etat
 * independants ne sont pas anormaux.
 *
 * LES TROIS AVERTISSEMENTS `exhaustive-deps` QUI TRAINAIENT ICI N'ETAIENT PAS LE
 * SYMPTOME D'UNE MACHINE A ETATS IMPLICITE — c'etait l'hypothese, elle etait
 * fausse. Ils portaient sur `online`, lu uniquement pour formuler un message
 * d'erreur. Corriges en cinq lignes (voir `reseauActuel` plus bas), pas en
 * refactorant.
 *
 * Refactorer sans defaut a montrer, c'est du travail speculatif : on remplace du
 * code qui marche par du code qui n'a pas encore ete eprouve. LE BON
 * DECLENCHEUR EST LE PROCHAIN BUG dans ce fichier — on extrait alors la grappe
 * d'etat concernee, avec une raison et un test qui echoue d'abord.
 * ---------------------------------------------------------------------------
 */

export type Zone = "body" | "header" | "footer";

/**
 * Onglet actif de la barre.
 *
 * La feuille de style N'EST PAS une zone : elle ne porte pas d'arbre de blocs,
 * Puck n'a rien a y editer. Elle partage neanmoins la meme barre d'onglets,
 * parce qu'elle repond a la meme question — « quelle partie du template
 * est-ce que je modifie ». La distinguer par un type separe evite qu'elle
 * n'atterrisse jamais la ou `Zone` sert d'index sur EditorTrees.
 */
export type Tab = Zone | "css";

export type EditorTrees = {
  body: Data;
  header: Data;
  footer: Data;
};

const EMPTY: Data = { root: { props: {} }, content: [], zones: {} } as unknown as Data;

const TAB_LABELS: Record<Tab, string> = {
  body: "Corps",
  header: "En-tête (répété)",
  footer: "Pied de page (répété)",
  css: "Feuille de style",
};


/**
 * Exemple montre dans le champ vide de la feuille de style.
 *
 * Un placeholder plutot qu'une documentation ailleurs : la question « comment
 * met-on une autre police ? » se pose devant ce champ, et une reponse qui exige
 * d'aller la chercher dans un README ne sera pas lue. Il disparait a la premiere
 * frappe et ne s'enregistre jamais.
 */
const CSS_PLACEHOLDER = `/* Police : téléverser le fichier dans la bibliothèque,
   puis reprendre l'URL qu'elle affiche. */
@font-face {
  font-family: "Jost";
  src: url("/assets/shared/jost-400") format("woff2");
  font-weight: 400;
  font-style: normal;
}

:root {
  --font-body: "Jost", Arial, Helvetica, sans-serif;

  /* Réutilisables dans les champs des blocs : écrire var(--ds-band)
     dans « Couleur de fond » d'un Panneau, par exemple. */
  --ds-band: #4a453b;
  --ds-rule: #8c8272;
}`;

/**
 * Les defauts de geometrie sont lus SUR LE REGISTRY et non recopies : c'est lui
 * qui les definit, et deux jeux de valeurs finiraient par se contredire.
 */
const ROOT_DEFAULTS = (datasheetConfig.root?.defaultProps ?? {}) as Record<string, unknown>;

/**
 * CSS d'impression applique a la surface de page du canvas.
 *
 * Imbrique sous `.ds-page-sheet` : la feuille est la MEME que celle du document
 * imprime (src/lib/printCss.ts), donc un bloc de texte s'y replie sur le meme
 * nombre de lignes et la mesure de pagination porte sur les bonnes hauteurs. Le
 * canvas heritait sinon de la police et du corps de l'application.
 */
const CANVAS_CSS = `.ds-page-sheet { ${PRINT_TYPOGRAPHY} ${PRINT_ELEMENT_CSS} }`;

const ZOOM_OPTIONS = [1, 0.85, 0.7, 0.55];

type Geometry = {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  hasHeader: boolean;
  hasFooter: boolean;
};

type Props = {
  scope: string;
  slug: string;
  name: string;
  initial: EditorTrees;
  css: string | null;
  settings: Record<string, unknown>;
  publishedVersion: number | null;
  draftVersion: number;
  /** Jeux de donnees d'exemple, prepares cote serveur, par profil. */
  samples: Record<string, unknown>;
  /** « component » : on compose un composant reutilisable, pas un template. */
  kind: "template" | "component";
  /** Les composants que ce template peut citer (vide quand on compose un composant). */
  components: EditorComponentChoice[];
};

const num = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const rootDefault = (key: string, fallback: number): number => num(ROOT_DEFAULTS[key], fallback);

function readGeometry(trees: EditorTrees): Geometry {
  const rootProps =
    ((trees.body as unknown as { root?: { props?: Record<string, unknown> } })?.root?.props ??
      {}) as Record<string, unknown>;

  const filled = (tree: Data | undefined): boolean =>
    Array.isArray((tree as unknown as { content?: unknown[] })?.content) &&
    ((tree as unknown as { content: unknown[] }).content.length > 0);

  return {
    pageWidth: num(rootProps.pageWidth, rootDefault("pageWidth", 210)),
    pageHeight: num(rootProps.pageHeight, rootDefault("pageHeight", 297)),
    marginTop: num(rootProps.marginTop, rootDefault("marginTop", 32)),
    marginBottom: num(rootProps.marginBottom, rootDefault("marginBottom", 22)),
    marginLeft: num(rootProps.marginLeft, rootDefault("marginLeft", 0)),
    marginRight: num(rootProps.marginRight, rootDefault("marginRight", 0)),
    hasHeader: filled(trees.header),
    hasFooter: filled(trees.footer),
  };
}

/**
 * Correspondance identifiant Puck -> libelle de bloc.
 *
 * Puck pose `data-puck-component="<id>"` sur l'element racine de chaque bloc :
 * cette carte est ce qui permet a la barre de mesure de nommer le bloc coupe par
 * un saut de page, plutot que d'annoncer « un bloc » et de laisser chercher.
 */
function indexBlockLabels(tree: unknown, into: Map<string, string>): void {
  const components = datasheetConfig.components as unknown as Record<string, { label?: string }>;

  const walk = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      if (node === null || typeof node !== "object") continue;

      const { type, props } = node as { type?: unknown; props?: Record<string, unknown> };
      const bag = props ?? {};

      if (typeof type === "string" && typeof bag.id === "string") {
        into.set(bag.id, components[type]?.label ?? type);
      }
      // Les slots sont des tableaux de noeuds sous une prop quelconque.
      for (const value of Object.values(bag)) {
        if (Array.isArray(value)) walk(value);
      }
    }
  };

  walk((tree as { content?: unknown })?.content);
}

export default function EditorClient(props: Props) {
  const [tab, setTab] = useState<Tab>("body");

  /**
   * Zone reellement editee par Puck.
   *
   * Sur l'onglet « Feuille de style », Puck n'est pas monte du tout : on retient
   * le corps pour que la geometrie de page et les metadonnees restent calculees
   * sur une zone valide, et que revenir a l'onglet Corps ne reconstruise rien.
   */
  const zone: Zone = tab === "css" ? "body" : tab;

  /**
   * Feuille de style du template, editable.
   *
   * Elle venait des props et n'etait retransmise que telle quelle : le mecanisme
   * de polices et de tokens etait en place des deux cotes (rendu ET canvas) sans
   * qu'aucun ecran ne permette d'y ecrire une ligne.
   */
  const [css, setCss] = useState<string>(props.css ?? "");

  /**
   * Etat du reseau.
   *
   * Initialise a `true` et non a `navigator.onLine` : ce composant est rendu
   * cote serveur, ou `navigator` n'existe pas. La valeur reelle est lue au
   * montage, dans l'effet ci-dessous.
   */
  const [online, setOnline] = useState(true);

  /**
   * Le corps est-il vide ?
   *
   * Suivi en etat plutot que lu depuis `trees` a chaque rendu : l'arbre vit
   * dans une ref, dont les mutations ne declenchent aucun rendu — le message
   * d'etat vide resterait donc affiche apres la pose du premier bloc.
   */
  const [bodyEmpty, setBodyEmpty] = useState(
    () => ((props.initial.body as unknown as { content?: unknown[] })?.content ?? []).length === 0
  );

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  /**
   * L'etat du reseau AU MOMENT de l'erreur, et non celui capture a la creation
   * du rappel.
   *
   * POURQUOI CETTE FONCTION EXISTE. Les trois rappels d'enregistrement lisaient
   * la variable d'etat `online` depuis leur fermeture, sans la declarer en
   * dependance — ce que `react-hooks/exhaustive-deps` signalait a juste titre,
   * et qui a traine trois avertissements pendant des mois. Le defaut etait reel
   * mais minuscule : on pouvait afficher « connexion perdue » alors qu'elle
   * etait revenue, ou l'inverse. Un message legerement faux, rien de plus.
   *
   * L'AJOUTER AUX DEPENDANCES AURAIT ETE LA MAUVAISE REPONSE : les trois rappels
   * seraient recrees a chaque bascule du reseau, donc les `useEffect` qui en
   * dependent rejoues, pour une valeur qui ne sert qu'a formuler une phrase.
   *
   * Lire `navigator.onLine` a l'instant voulu est plus juste que l'etat : l'etat
   * n'en est qu'un miroir, mis a jour par l'effet ci-dessus. L'etat reste
   * necessaire pour le RENDU du bandeau hors ligne, qui doit bien declencher un
   * rendu ; il ne sert plus a decrire une erreur.
   */
  const reseauActuel = () => (typeof navigator === "undefined" ? true : navigator.onLine);
  const [status, setStatus] = useState<{ text: string; level: "ok" | "warn" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [published, setPublished] = useState(props.publishedVersion);
  const [showVars, setShowVars] = useState(false);

  // --- Canvas ---------------------------------------------------------------
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("preview");
  const [profile, setProfile] = useState<SampleProfileId>(DEFAULT_SAMPLE_PROFILE);
  const [zoom, setZoom] = useState(1);
  const [metrics, setMetrics] = useState<CanvasMetrics>(null);
  const [geometry, setGeometry] = useState<Geometry>(() => readGeometry(props.initial));

  // --- Apercu PDF -----------------------------------------------------------
  const [dockOpen, setDockOpen] = useState(false);
  const [dockFull, setDockFull] = useState(false);
  const [autoPreview, setAutoPreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  // --- Controle avant publication ------------------------------------------
  const [showCheck, setShowCheck] = useState(false);
  const [checkRows, setCheckRows] = useState<CheckRow[] | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);

  // Les arbres vivent dans une ref : onChange se declenche a chaque frappe, et
  // repasser par l'etat React ferait remonter Puck en perdant le focus.
  /**
   * Arbres du modele, corps CONVERTI en pages des l'ouverture.
   *
   * Un modele enregistre avant l'introduction des pages porte ses blocs
   * directement a la racine du corps ; le studio, lui, ne sait dessiner que des
   * pages. La conversion range ces blocs dans une premiere page — rien n'est
   * perdu, rien ne bouge a l'impression (le rendu convertit de la meme facon,
   * voir src/lib/pages.ts) — et se fixe au premier enregistrement.
   */
  const trees = useRef<EditorTrees>({
    ...props.initial,
    body: normalizeBodyTree(props.initial.body),
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const previewAbort = useRef<AbortController | null>(null);
  /** Date de la derniere modification, pour l'apercu auto. Voir la boucle de veille. */
  const changedAt = useRef<number>(0);
  const previewedAt = useRef<number>(0);

  const say = (text: string, level: "ok" | "warn" | "error" = "ok") => setStatus({ text, level });

  const post = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/editor/template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: props.scope, slug: props.slug, ...body }),
    });
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error ?? `HTTP ${response.status}`);
    }
    return data;
  }, [props.scope, props.slug]);

  /** Corps commun a l'enregistrement, a l'apercu et au controle. */
  const payload = useCallback(
    () => ({
      body: trees.current.body,
      header: trees.current.header,
      footer: trees.current.footer,
      css,
      settings: props.settings,
    }),
    [css, props.settings]
  );

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const result = await post({ action: "save", trees: payload() });
      setDirty(false);
      say(`Brouillon enregistré (version ${result.draft_version}).`);
    } catch (error) {
      say(describeFailure(error, reseauActuel()), "error");
    } finally {
      setBusy(false);
    }
  }, [post, payload]);

  /**
   * Publier un COMPOSANT republie les templates qui le citent : la liste est
   * montree avant, et c'est elle qu'on confirme. Un composant que rien ne cite
   * se publie sans question.
   */
  const [pendingDependents, setPendingDependents] = useState<
    { slug: string; name: string; shopSlug: string | null }[] | null
  >(null);

  const doPublish = useCallback(async () => {
    setBusy(true);
    setPendingDependents(null);
    try {
      // Toujours enregistrer avant de publier : publier un brouillon dont les
      // dernieres modifications ne sont pas en base serait un piege silencieux.
      await post({ action: "save", trees: payload() });
      const result = await post({ action: "publish" });
      setDirty(false);
      setPublished(result.published_version);
      const republished = (result.republished ?? []) as { name: string }[];
      say(
        props.kind === "component"
          ? `Composant publié (v${result.published_version}).` +
              (republished.length > 0
                ? ` ${republished.length} template(s) republié(s) : les boutiques régénèrent leurs fiches dans les minutes qui viennent.`
                : " Aucun template ne l'utilise encore.")
          : `Version ${result.published_version} publiée. Les boutiques utilisant ce template la servent désormais.`
      );
    } catch (error) {
      say(describeFailure(error, reseauActuel()), "error");
    } finally {
      setBusy(false);
    }
  }, [post, payload, props.kind]);

  const publish = useCallback(async () => {
    if (props.kind !== "component") return doPublish();
    try {
      const result = await post({ action: "dependances" });
      const dependents = (result.dependents ?? []) as { slug: string; name: string; shopSlug: string | null }[];
      if (dependents.length === 0) return doPublish();
      setPendingDependents(dependents);
    } catch (error) {
      say(describeFailure(error, reseauActuel()), "error");
    }
  }, [post, doPublish, props.kind]);

  /**
   * Rendu de l'apercu.
   *
   * Les requetes en vol sont annulees : en rafraichissement automatique, une
   * frappe rapide en declencherait sinon une file entiere, dont seule la derniere
   * reponse est utile — et chacune occupe un Chromium.
   */
  const runPreview = useCallback(
    async (options?: { silent?: boolean }) => {
      previewAbort.current?.abort();
      const abort = new AbortController();
      previewAbort.current = abort;
      previewedAt.current = Date.now();

      setPreviewBusy(true);
      if (!options?.silent) say("Rendu de l'aperçu…");

      try {
        const response = await fetch("/api/editor/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // La portee choisit les composants deplies dans l'apercu.
          body: JSON.stringify({ ...payload(), profile, scope: props.scope }),
          signal: abort.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            [data.error, data.detail].filter(Boolean).join(" :: ") || `HTTP ${response.status}`
          );
        }

        const rawWarnings = response.headers.get("x-render-warnings");
        const pagesHeader = response.headers.get("x-pdf-pages");
        const blob = await response.blob();

        // Blob URL plutot que pdf.js : le lecteur PDF integre au navigateur suffit,
        // et evite d'embarquer une bibliotheque de rendu de plusieurs centaines de
        // kilooctets pour afficher un apercu.
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setPreviewMeta({
          profile,
          pages: pagesHeader === null ? null : Number(pagesHeader),
          // decodeWarningsHeader et non decodeURIComponent : un en-tete tronque
          // faisait lever « URI malformed » ICI, et l'apercu echouait alors que
          // son PDF etait arrive. Voir src/lib/renderWarnings.ts.
          warnings: decodeWarningsHeader(rawWarnings),
          bytes: blob.size,
        });
        if (!options?.silent) say("Aperçu généré.");
      } catch (error) {
        // Une annulation est un evenement normal du rafraichissement auto.
        if (error instanceof DOMException && error.name === "AbortError") return;
        say(describeFailure(error, reseauActuel()), "error");
      } finally {
        if (previewAbort.current === abort) {
          setPreviewBusy(false);
          previewAbort.current = null;
        }
      }
    },
    [payload, profile, props.scope]
  );

  const openPreview = useCallback(() => {
    setDockOpen(true);
    void runPreview();
  }, [runPreview]);

  /**
   * Controle avant publication : le template rendu sur CHAQUE profil de donnees.
   *
   * C'est la reponse a la question qui compte sur un parc de plus de mille
   * fiches — « est-ce que ce template tient aussi pour les produits qui sortent
   * de l'ordinaire ? ». Les profils sont rendus l'un apres l'autre, et non en
   * parallele : une rafale de quatre Chromium sur le meme Gotenberg entrerait en
   * concurrence avec une generation en masse en cours cote boutique.
   */
  const runCheck = useCallback(async () => {
    setShowCheck(true);
    setCheckBusy(true);
    setCheckRows(SAMPLE_PROFILES.map((entry) => ({ profile: entry.id, state: "pending" })));

    const body = payload();

    for (const entry of SAMPLE_PROFILES) {
      setCheckRows((rows) =>
        (rows ?? []).map((row) => (row.profile === entry.id ? { ...row, state: "running" } : row))
      );

      try {
        const response = await fetch("/api/editor/preview?format=report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, profile: entry.id, scope: props.scope }),
        });
        const data = await response.json();

        setCheckRows((rows) =>
          (rows ?? []).map((row) =>
            row.profile === entry.id
              ? response.ok && data.ok
                ? {
                    ...row,
                    state: "ok",
                    pages: data.pages ?? null,
                    warnings: data.warnings ?? [],
                    ms: data.ms,
                  }
                : {
                    ...row,
                    state: "error",
                    error: [data.error, data.detail].filter(Boolean).join(" :: ") || "échec",
                  }
              : row
          )
        );
      } catch (error) {
        setCheckRows((rows) =>
          (rows ?? []).map((row) =>
            row.profile === entry.id
              ? { ...row, state: "error", error: error instanceof Error ? error.message : String(error) }
              : row
          )
        );
      }
    }

    setCheckBusy(false);
  }, [payload, props.scope]);

  /**
   * Contexte transmis aux blocs : la zone editee et la geometrie de page.
   *
   * La geometrie vient TOUJOURS de l'arbre du corps, y compris en editant un
   * bandeau : c'est la que le moteur de rendu la lit. Sans cela, la bande
   * reservee se dessinait sur la largeur de la fenetre du navigateur.
   */
  const metadata = useMemo(
    () => ({
      zone,
      reservedMm:
        zone === "header" ? geometry.marginTop : zone === "footer" ? geometry.marginBottom : 0,
      pageWidth: geometry.pageWidth,
      pageHeight: geometry.pageHeight,
      marginTop: geometry.marginTop,
      marginBottom: geometry.marginBottom,
      marginLeft: geometry.marginLeft,
      marginRight: geometry.marginRight,
      hasHeader: geometry.hasHeader,
      hasFooter: geometry.hasFooter,
      /**
       * En-tete et pied REELS, rendus une fois et poses sur chaque page.
       *
       * Ils ne sont fournis QUE pour le corps : en editant un bandeau, la
       * surface montre deja ce bandeau-la, en vrai et en modifiable. Les
       * remontrer en lecture seule autour serait une duplication trompeuse.
       *
       * Rendus depuis les arbres, avec le meme pipeline de resolution que les
       * blocs du corps — c'est ce qui garantit qu'un token du bandeau y est
       * resolu contre le MEME profil d'exemple que le reste de la page.
       */
      headerNode: zone === "body" ? renderZonePreview(trees.current.header, props.samples[profile]) : undefined,
      footerNode: zone === "body" ? renderZonePreview(trees.current.footer, props.samples[profile]) : undefined,
    }),
    // `trees.current` est une ref : elle ne figure pas dans les dependances et
    // ne declenche aucun recalcul. Les bandeaux sont donc figes pour la duree de
    // l'onglet Corps, et rafraichis au retour depuis l'onglet En-tete ou Pied —
    // moment ou `zone` change, donc ou ce memo est recalcule. C'est exactement
    // la frequence utile : on ne modifie pas un bandeau en editant le corps.
    [zone, geometry, profile, props.samples]
  );

  /**
   * Configuration ET overrides : les deux moities de ce que `<Puck>` attend.
   *
   * `overrides` est une PROP de `<Puck>`, pas un champ de `Config`. Le pont qui
   * transforme les evenements du canvas (« Ajouter une page », dupliquer ou
   * supprimer un conteneur) en actions Puck vit dans `overrides.preview` : sans
   * cette prop, il n'est jamais monte et ces boutons ne font rien, en silence.
   */
  /**
   * Les composants que ce template peut citer. En etat et non lus des props :
   * un composant cree DEPUIS ce template (BlockActions.tsx) doit s'y ajouter
   * sans recharger la page, sinon le bloc qui le cite s'afficherait
   * « introuvable » jusqu'au rechargement.
   */
  const [componentChoices, setComponentChoices] = useState(props.components);

  const { config: editorConfig, overrides: baseOverrides } = useMemo(
    () =>
      buildEditorConfig(datasheetConfig, {
        mode: canvasMode,
        data: props.samples[profile],
        zone,
        components: componentChoices,
        kind: props.kind,
      }),
    [canvasMode, profile, zone, props.samples, componentChoices, props.kind]
  );

  /**
   * Grouper, degrouper et creer un composant : la barre d'action du bloc
   * selectionne, et la boite de creation, montee pour toute la duree de
   * l'editeur. Voir BlockActions.tsx. Et, au meme endroit parce qu'il faut le
   * contexte de Puck, l'annulation au clavier sur toutes les dispositions
   * (EditorHotkeys.tsx).
   */
  const blockOverrides = useMemo(
    () => ({
      actionBar: (bar: { label?: string; children: ReactNode; parentAction: ReactNode }) => (
        <BlockActionBar {...bar} composing={props.kind === "component"} />
      ),
      puck: ({ children }: { children: ReactNode }) => (
        <>
          {children}
          <EditorHotkeys />
          <CreateComponentDialog
            scope={props.scope}
            onCreated={(choice) => setComponentChoices((current) => [...current, choice])}
          />
        </>
      ),
    }),
    // Identite STABLE, distincte des overrides de buildEditorConfig : `puck`
    // enveloppe toute l'interface de Puck, et un nouveau composant a chaque
    // changement de profil ou de mode la remonterait entiere.
    [props.kind, props.scope]
  );

  const editorOverrides = useMemo(
    () => ({ ...baseOverrides, ...blockOverrides }),
    [baseOverrides, blockOverrides]
  );

  /**
   * Barre laterale gauche : la palette et les Calques, en francais.
   *
   * Puck remplace un plugin par celui qu'on lui passe sous le MEME nom
   * (`blocks`, `outline`). Les Calques sont les notres : l'Outline de Puck ne
   * sait que selectionner, et le retour utilisateur etait de pouvoir y deplacer
   * les blocs. Voir LayersPanel.tsx.
   */
  const plugins = useMemo<Plugin[]>(
    () => [
      { ...blocksPlugin(), label: "Blocs" },
      {
        name: "outline",
        label: "Calques",
        icon: <Layers />,
        render: () => <LayersPanel zone={zone} />,
      },
    ],
    [zone]
  );

  const onChange = useCallback(
    (data: Data) => {
      trees.current = { ...trees.current, [zone]: data };
      changedAt.current = Date.now();
      setDirty(true);
      if (zone === "body") {
        setBodyEmpty(((data as unknown as { content?: unknown[] }).content ?? []).length === 0);
      }
    },
    [zone]
  );

  const puckKey = `${zone}:${canvasMode}`;

  /**
   * Donnees initiales de Puck, FIGEES pour la duree de vie de cette instance.
   *
   * Passer `trees.current[zone]` directement rendait la prop instable des la
   * premiere frappe : Puck regenere son store des que l'identite de ses donnees
   * initiales change, ce qui est inutile — apres montage, l'etat du document est
   * le sien, et il nous le rend par onChange.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const puckData = useMemo(() => trees.current[zone] ?? EMPTY, [puckKey]);

  /**
   * Boucle de veille du canvas, unique et a intervalle fixe.
   *
   * Trois lectures dont aucune ne peut etre declenchee par un evenement fiable :
   * la geometrie et l'encombrement vivent dans le DOM de Puck, et les frappes ne
   * passent volontairement pas par l'etat React. Un intervalle qui ne fait que
   * LIRE le layout est plus simple et plus robuste qu'un observateur de mutations
   * sur tout le sous-arbre, pour un cout negligeable.
   */
  useEffect(() => {
    const tick = () => {
      // 1. La geometrie de page a-t-elle change ? Elle pilote la surface, les
      //    bandes reservees et les sauts de page.
      setGeometry((current) => {
        const next = readGeometry(trees.current);
        return shallowEqual(current, next) ? current : next;
      });

      // 2. Encombrement du contenu.
      const root = canvasRef.current;
      if (root) {
        const labels = new Map<string, string>();
        indexBlockLabels(trees.current[zone], labels);
        const next = measureCanvas(root, (id) => labels.get(id) ?? "Bloc");
        setMetrics((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next
        );
      }

      // 3. Apercu automatique, une fois les modifications retombees. Un rendu
      //    coute un Chromium : on attend le silence plutot que de suivre la frappe.
      if (
        autoPreview &&
        dockOpen &&
        changedAt.current > previewedAt.current &&
        Date.now() - changedAt.current > 1200 &&
        previewAbort.current === null
      ) {
        void runPreview({ silent: true });
      }
    };

    const timer = window.setInterval(tick, 500);
    tick();
    return () => window.clearInterval(timer);
  }, [zone, autoPreview, dockOpen, runPreview]);

  /** Un brouillon perdu est perdu : le navigateur doit demander confirmation. */
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /** Cmd/Ctrl + S : le reflexe de tout le monde. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!busy) void save();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, save]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const currentProfile = SAMPLE_PROFILES.find((entry) => entry.id === profile);

  /**
   * Couleurs de la boutique, injectees dans le canvas.
   *
   * Les blocs ecrivent `var(--color-primary)`. Ces variables sont posees sur
   * `:root` par le document imprime, a partir de `data.shop.colors` — mais rien
   * ne les definissait dans l'editeur : un titre en couleur primaire y sortait
   * noir, et le contraste d'un texte blanc sur panneau colore etait impossible a
   * juger. Les valeurs viennent du jeu de donnees d'exemple, donc exactement
   * celles de l'apercu PDF. Les defauts sont ceux de buildDocument().
   */
  const canvasColors = useMemo(() => {
    const shop = (props.samples[profile] as { shop?: { colors?: Record<string, string> } })?.shop;
    return {
      primary: shop?.colors?.primary ?? "#1a1a1a",
      secondary: shop?.colors?.secondary ?? "#666666",
    };
  }, [props.samples, profile]);

  /**
   * Feuille du template, confinee a la surface de page.
   *
   * Elle etait transmise a l'enregistrement et au rendu, mais jamais injectee
   * ici : une police ou une rampe de couleurs definie par le template sortait
   * dans le PDF et restait absente de l'apercu. C'est precisement la divergence
   * apercu/PDF que le partage du registry existe pour empecher.
   *
   * Le confinement n'est pas optionnel : la feuille est ecrite pour un document
   * imprime, ou `body` designe la page. Injectee telle quelle, une seule regle
   * `body { font-family: ... }` repeindrait cette barre d'outils et les
   * panneaux. Voir src/lib/scopeCss.ts pour ce qui reste volontairement global
   * (@font-face, @keyframes) et pourquoi.
   */
  const scopedTemplateCss = useMemo(() => scopeCss(css, ".ds-page-sheet"), [css]);

  return (
    /*
     * L'editeur occupe tout l'ecran : Puck a besoin d'une hauteur reelle. La
     * classe `ed` reste le crochet des jetons de Puck et des regles du canvas
     * (editor.css) ; la geometrie, elle, est portee ici.
     */
    <div className="ed bg-background text-foreground flex h-screen flex-col overflow-hidden">
      <style>{CANVAS_CSS}</style>
      {scopedTemplateCss ? <style>{scopedTemplateCss}</style> : null}

      {/*
        TRAITEMENT DU TERRITOIRE — plat, sans ombre portee. La barre, les
        panneaux et le dock prennent --card ; le canvas, lui, reste sur le
        bureau. C'est ce leger ecart qui pose la hierarchie, pas un relief :
        une ombre portee dans une application qui fabrique des pages imprimees
        mentirait sur ce qu'elle produit. Le filet d'un pixel fait le reste.
      */}
      <header className="bg-card flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Le glyphe seul ne constitue pas un intitule : hors contexte, une
              fleche ne dit pas ou elle mene. */}
          <Button asChild variant="ghost" size="icon" aria-label="Retour à la liste des templates">
            <a href="/">
              <Icon icon={ArrowLeft} size="sm" />
            </a>
          </Button>
          {/*
            Troncature du titre et du chemin. Mesure avant correction : un nom
            de template de 110 caracteres faisait passer la barre de 87 a 154 px,
            et repoussait donc le canvas de 67 px en permanence. Plafond en `ch`
            et non en pixels : il suit le corps du texte. `title` : la valeur
            entiere doit rester atteignable.
          */}
          <strong title={props.name} className="max-w-[32ch] truncate font-semibold">
            {props.name}
          </strong>
          <code
            title={`${props.scope === "shared" ? "bibliothèque" : props.scope}/${props.slug}`}
            className="text-muted-foreground max-w-[26ch] truncate font-mono text-xs"
          >
            {props.scope === "shared" ? "bibliothèque" : props.scope}/{props.slug}
          </code>
          <Badge variant="outline">
            {published === null ? "aucune version publiée" : `publié : v${published}`}
          </Badge>
          {dirty ? <BadgeStatus status="amber">modifications non enregistrées</BadgeStatus> : null}
        </div>

        {/*
          Onglets : la partie du template qu'on modifie. Un etat client, d'ou
          Tabs. Activation MANUELLE : changer d'onglet remonte Puck, ce qu'une
          simple navigation aux fleches ne doit pas declencher.
        */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          activationMode="manual"
          className="ml-auto"
        >
          <TabsList aria-label="Partie du template">
            {/* Un composant n'a qu'un contenu : il est deplie la ou on le place, et
                c'est la feuille de style du template qui s'y applique. */}
            {(Object.keys(TAB_LABELS) as Tab[])
              .filter((t) => props.kind !== "component" || t === "body")
              .map((t) => (
                <TabsTrigger key={t} value={t}>
                  {TAB_LABELS[t]}
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>

        {pendingDependents !== null ? (
          <Dialog
            title="Publier ce composant"
            confirmLabel={`Publier et republier ${pendingDependents.length} template(s)`}
            busy={busy}
            onConfirm={doPublish}
            onCancel={() => setPendingDependents(null)}
          >
            <p>
              Ces templates citent ce composant. Ils seront <strong>republiés</strong>, et les boutiques
              régénéreront leurs fiches avec la nouvelle version :
            </p>
            <ul className="list-disc pl-5">
              {pendingDependents.map((item) => (
                <li key={`${item.shopSlug ?? "shared"}/${item.slug}`}>
                  {item.name}{" "}
                  <code className="text-muted-foreground font-mono text-xs">
                    {item.shopSlug ?? "bibliothèque"}
                  </code>
                </li>
              ))}
            </ul>
          </Dialog>
        ) : null}

        {/*
          Reglages d'affichage du canvas — anciennement une deuxieme barre
          sous celle-ci. Ce sont des reglages de VUE (quoi afficher, a quelle
          echelle), pas des actions : ils rejoignent la barre principale plutot
          que d'en former une deuxieme, pour que le canvas commence plus haut.
        */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/*
            Un segment est un choix parmi des alternatives equivalentes, pas
            l'action qui engage : l'etat actif reste un fond discret, jamais
            l'aplat terre cuite reserve a « Publier ».
          */}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={canvasMode}
            onValueChange={(value) => {
              // Radix rend une valeur vide quand on reclique le segment actif :
              // il y a toujours un mode, on l'ignore.
              if (value) setCanvasMode(value as CanvasMode);
            }}
            aria-label="Contenu du canvas"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="preview">Données d&apos;exemple</ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Les tokens sont remplacés par les données du profil choisi</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="tokens">Tokens</ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                Affiche les tokens et permet d&apos;éditer les textes directement sur le canvas
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>

          <div className="flex items-center gap-1.5">
            <Label htmlFor="ed-profil" className="text-muted-foreground font-normal">
              Profil
            </Label>
            <Select
              value={profile}
              disabled={canvasMode !== "preview"}
              onValueChange={(value) => setProfile(value as SampleProfileId)}
            >
              <SelectTrigger id="ed-profil" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_PROFILES.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Label htmlFor="ed-zoom" className="text-muted-foreground font-normal">
              Zoom
            </Label>
            <Select value={String(zoom)} onValueChange={(value) => setZoom(Number(value))}>
              <SelectTrigger id="ed-zoom" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOOM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {Math.round(value * 100)} %
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            La bascule de theme se range ici, avec le zoom : ce sont les deux
            reglages qui changent CE QU'ON VOIT sans rien changer au document.
            Elle n'affecte pas la feuille, qui reste blanche dans les deux
            themes — c'est du papier.
          */}
          <ThemeToggle />

          <Metrics metrics={metrics} zone={zone} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVars((open) => !open)}
          >
            {showVars ? "Masquer les variables" : "Variables"}
          </Button>
          {/*
            Distinct des bascules qui l'entourent : ce bouton declenche un
            rendu sequentiel sur TOUS les profils cote serveur (plusieurs secondes),
            pas un simple affichage/masquage. Le contour en tirets et
            l'icone dediee signalent ce cout avant le clic — voir
            l'audit UX, constat "Important" sur la hierarchie des actions.
          */}
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary border-dashed"
            onClick={runCheck}
            disabled={checkBusy}
            // Le libelle passe a « Contrôle en cours… » pendant plusieurs
            // secondes ; sans aria-busy, rien ne signale l'attente autrement
            // que par ce changement de texte.
            aria-busy={checkBusy}
          >
            <Icon
              icon={RefreshCw}
              size="sm"
              className={checkBusy ? "animate-spin motion-reduce:animate-none" : undefined}
            />
            {/*
              Le nombre est DERIVE du catalogue, jamais recopie : ajouter un
              profil a deja rendu ce libelle faux une fois, et un bouton qui
              annonce quatre rendus pour en faire cinq est un mensonge que rien
              ne signale.
            */}
            {checkBusy ? "Contrôle en cours…" : `Contrôler les ${SAMPLE_PROFILES.length} profils`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(dockOpen && "border-primary text-primary")}
            onClick={() => (dockOpen ? setDockOpen(false) : openPreview())}
          >
            {dockOpen ? "Fermer l'aperçu" : "Aperçu PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={save} disabled={busy || !dirty} title="Cmd/Ctrl + S">
            Enregistrer
          </Button>
          {/* L'action principale de l'ecran : le seul aplat de la barre. */}
          <Button size="sm" onClick={publish} disabled={busy}>
            Publier
          </Button>
        </div>
      </header>

      {/*
        Regions live PERMANENTES, invisibles a l'oeil : elles restent montees
        meme vides. Une region creee en meme temps que son message peut voir
        l'annonce manquee — c'est le changement de contenu d'une region deja
        presente qui declenche la lecture. Deux regions figees, chacune avec son
        niveau, plutot qu'un `aria-live` qui basculerait sur un meme noeud.
      */}
      <div className="sr-only" role="status" aria-live="polite">
        {status && status.level !== "error" ? status.text : ""}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {status?.level === "error" ? status.text : ""}
      </div>

      {status ? (
        // aria-hidden : le texte est deja porte par les regions ci-dessus, sans
        // quoi il serait annonce deux fois.
        <div
          className={cn(
            "bg-card border-b px-4 py-2 text-sm",
            status.level === "ok" && "text-green-700 dark:text-green-400",
            status.level === "warn" && "text-amber-700 dark:text-amber-400",
            status.level === "error" && "text-destructive",
          )}
          aria-hidden="true"
        >
          {status.text}
        </div>
      ) : null}

      {showVars ? <VariablesPanel /> : null}

      {showCheck ? (
        <CheckPanel rows={checkRows ?? []} onClose={() => setShowCheck(false)} />
      ) : null}

      {/*
        Etat hors-ligne. Persistant tant que la connexion manque, contrairement
        au statut qui, lui, rend compte d'une action ponctuelle. Il ne desactive
        volontairement AUCUN bouton : `navigator.onLine` signale l'absence
        d'interface reseau, pas l'inaccessibilite du serveur — bloquer
        l'enregistrement sur cette base empecherait une sauvegarde qui aurait pu
        aboutir.
      */}
      {!online ? (
        <Alert variant="warning" role="status" className="border-x-0 border-t-0">
          <Icon icon={WifiOff} />
          <AlertDescription>
            <p>
              <strong>Hors ligne.</strong>{" "}Vos modifications restent dans l&apos;éditeur, mais ne
              peuvent pas être enregistrées tant que la connexion n&apos;est pas revenue.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="bg-card text-muted-foreground border-b px-4 py-2 text-sm">
        {/*
          Etat vide du corps. Un premier usage n'est pas une erreur : c'est le
          moment ou une explication a le plus de valeur, et le seul ou l'on sait
          avec certitude que l'utilisateur n'a encore rien fait.
        */}
        {tab === "body" && bodyEmpty ? (
          <>
            Ce corps de fiche est <strong>vide</strong>. Faites glisser un bloc depuis la palette
            de gauche — ou partez du template fourni (<code className="font-mono text-xs">pnpm starter</code>),
            qui pose déjà bandeau latéral, visuels et tableau de caractéristiques.
          </>
        ) : tab === "css" ? (
          <>
            CSS appliqué au <strong>document imprimé</strong>. C&apos;est ici que se déclarent
            une police (<code className="font-mono text-xs">@font-face</code>) et les variables
            réutilisables dans les champs des blocs. Dans l&apos;éditeur, ces règles sont confinées
            à la surface de page : elles ne peuvent pas repeindre l&apos;interface.
          </>
        ) : canvasMode === "tokens" ? (
          <>
            Le canvas affiche les <strong>tokens</strong>{" "}: les textes sont éditables directement,
            mais rien ne montre la place que prendront les données réelles. Repasser en
            « Données d&apos;exemple » pour composer la mise en page.
          </>
        ) : zone === "body" ? (
          <>
            Page à l&apos;échelle, avec les données du profil <strong>{currentProfile?.label}</strong>.{" "}
            {currentProfile?.purpose}
          </>
        ) : (
          <>
            Zone répétée sur chaque page.{" "}
            <strong>{metadata.reservedMm} mm lui sont réservés</strong> par la géométrie de page
            (réglage « Bande {zone === "header" ? "haute" : "basse"}{" "}», onglet « Corps ») : ce qui
            dépasse la limite est masqué à l&apos;impression. Les images y sont intégrées
            automatiquement.
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {tab === "css" ? (
          /* Onglet « Feuille de style ». Il occupe la place du canvas — ce n'est
             pas une zone a composer, il n'y a donc ni surface de page ni palette. */
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-auto p-4">
            <Label htmlFor="ed-css-input" className="text-muted-foreground">
              Feuille de style du template
            </Label>
            <Textarea
              id="ed-css-input"
              // Monospace et tabulation courte : du CSS se relit par
              // l'alignement de ses accolades, ce qu'une police
              // proportionnelle detruit. Le placeholder n'est pas decoratif :
              // il PORTE l'exemple, d'ou --muted-foreground (fourni par le
              // composant) plutot que le gris par defaut du navigateur.
              className="field-sizing-fixed min-h-72 flex-1 resize-y font-mono text-sm leading-relaxed [tab-size:2]"
              value={css}
              spellCheck={false}
              // Un editeur de code (coloration, pliage, completion) serait une
              // dependance a part entiere pour un champ dont l'usage tient en
              // quelques dizaines de lignes : un textarea monospace suffit, et
              // rien n'empeche de le remplacer plus tard sans toucher au reste.
              placeholder={CSS_PLACEHOLDER}
              onChange={(event) => {
                setCss(event.target.value);
                setDirty(true);
              }}
            />
            <p className="text-muted-foreground m-0 max-w-[70ch] text-sm">
              Les références <code className="font-mono text-[0.95em]">/assets/…</code> de la
              bibliothèque sont converties en données embarquées au rendu : une police déclarée
              ici part donc AVEC le PDF, sans dépendre du réseau. Le corps du document et les
              bandeaux répétés partagent cette même feuille.
            </p>
          </div>
        ) : (
        <div
          // `ed-canvas` : crochet de l'anneau de focus du canvas (editor.css).
          // `*:h-full` : la racine de Puck prend toute la hauteur.
          className="ed-canvas relative min-h-0 min-w-0 flex-1 *:h-full"
          ref={canvasRef}
          style={
            {
              "--ds-zoom": String(zoom),
              "--color-primary": canvasColors.primary,
              "--color-secondary": canvasColors.secondary,
            } as CSSProperties
          }
        >
          <Puck
            key={puckKey}
            config={editorConfig}
            data={puckData}
            metadata={metadata}
            overrides={editorOverrides}
            plugins={plugins}
            onChange={onChange}
            onPublish={save}
            // Canvas non isole : les reperes de saut de page et les styles de
            // l'application doivent pouvoir s'y appliquer. Les blocs n'utilisant que
            // des styles en ligne, il n'y a pas de risque de fuite de CSS.
            //
            // Consequence a connaitre : Puck n'applique la largeur de viewport et le
            // zoom que lorsque l'iframe est active. La geometrie de page est donc
            // portee par la surface de page elle-meme (src/blocks/canvasChrome.tsx),
            // et le zoom ci-dessus est le notre.
            iframe={{ enabled: false }}
          />
        </div>
        )}

        {dockOpen ? (
          <PreviewDock
            url={previewUrl}
            meta={previewMeta}
            busy={previewBusy}
            auto={autoPreview}
            full={dockFull}
            downloadName={`${props.slug}-${profile}.pdf`}
            onAutoChange={setAutoPreview}
            onToggleFull={() => setDockFull((full) => !full)}
            onRefresh={() => runPreview()}
            onClose={() => setDockOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}
