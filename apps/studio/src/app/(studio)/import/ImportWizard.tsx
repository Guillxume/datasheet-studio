"use client";

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { parseCsv } from "@/lib/csv";
import {
  assetKeyFor,
  buildReportCsv,
  detectItemsPath,
  discoverJsonColumns,
  findImageFile,
  imageMime,
  indexImageFolder,
  itemsAt,
  pdfFilename,
  type ReportRow,
} from "@/lib/importCatalog";
import {
  csvRecord,
  isRemoteRef,
  jsonRecord,
  mapRecord,
  suggestTarget,
  TARGET_GROUPS,
  TRANSFORMS,
  type MappingTable,
  type SourceRecord,
} from "@/lib/importMapping";
import { getPath } from "@/lib/mapping";
import {
  catalogSize,
  selectRows,
  type Catalog,
  type RowFilter,
} from "@/lib/importSelection";
import { SHOP_FIELDS, shopFieldsFrom, shopSeed } from "@/lib/shopFields";
import { renderDataSchema } from "@/lib/payload";
import { decodeWarningsHeader } from "@/lib/renderWarnings";
import { zipParts, type ZipEntry } from "@/lib/zip";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import { Progress } from "@guillxume/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { cn } from "@guillxume/ui/lib/utils";
import { CircleAlert, Download, Eye, FileUp, FolderUp, RotateCcw, TriangleAlert } from "lucide-react";
import SectionHead from "@/components/SectionHead";

/**
 * Import d'un catalogue : un CSV ou un JSON -> un ZIP de fiches.
 *
 * LE LOT EST PILOTE D'ICI, fiche par fiche, et ce n'est pas un detail
 * d'implementation : c'est ce qui rend l'operation supportable. Une seule
 * requete qui rendrait 400 fiches tiendrait dix minutes — au-dela de ce que le
 * reverse proxy laisse passer — sans rien montrer, sans pouvoir etre annulee, et
 * un echec en fin de course perdrait tout. Ici chaque requete dure le temps
 * d'une fiche, la progression est reelle, l'annulation est immediate, et seuls
 * les echecs sont rejoues.
 *
 * CE QUE CETTE PAGE N'EST PAS. Elle ne remplace pas les collecteurs
 * (collectors/README.md) : elle ne tient pas de journal entre deux passages, ne
 * sait pas reprendre un lot interrompu, et l'archive vit dans la memoire de
 * l'onglet. C'est l'outil du lot qu'on regarde passer — quelques dizaines a
 * quelques centaines de fiches, un fichier qu'on vient de recevoir. Au-dela, le
 * cache de fraicheur et la reprise des collecteurs ne se remplacent pas par un
 * onglet ouvert.
 *
 * LA CORRESPONDANCE EST CELLE DES COLLECTEURS, au fichier pres : ce qui est
 * regle ici s'exporte en JSON et se repasse a `--mapping`, et l'inverse. Sans
 * cela, le premier import se ferait a l'ecran et sa mise en production
 * demanderait de tout refaire.
 */

type Template = {
  slug: string;
  scope: string;
  name: string;
  published: number | null;
  draft: number;
};
/**
 * Les reglages arrivent du serveur (table shops, poses dans /admin/boutiques) et
 * prealimentent l'identite de la fiche. Le type est volontairement lache — la
 * validation est faite en amont par `shopSettingsSchema`, et la dupliquer ici
 * ferait deux verites.
 */
type ShopSettings = {
  url?: string;
  logo?: string;
  colors?: { primary?: string; secondary?: string };
  company?: { address?: string; phone?: string; email?: string; legal?: string };
};

type Shop = { slug: string; name: string; settings?: ShopSettings };


type Attempt = {
  ref: string;
  line: number;
  warnings: string[];
  pdf?: Uint8Array;
  error?: string;
};

/** Ce qu'un onglet encaisse sans peiner. Au-dela, on le dit plutot que ramer. */
const COMFORTABLE_BATCH = 300;

/*
 * Sentinelles des selects : Radix interdit un element de valeur vide, que les
 * selects natifs utilisaient pour « aucune boutique », « toutes les lignes »,
 * « ignorer » et « aucune transformation ». Elles ne sortent jamais du rendu :
 * l'etat garde la chaine vide.
 */
const NO_SHOP = "__aucune__";
const ALL_ROWS = "__toutes__";
const IGNORE = "__ignorer__";
const NO_TRANSFORM = "__aucune_transformation__";

const KNOWN_TARGETS = new Set(TARGET_GROUPS.flatMap((group) => group.targets.map((entry) => entry.path)));
const KNOWN_TRANSFORMS = new Set(TRANSFORMS.map((entry) => entry.id));

/*
 * Grille de formulaire : des colonnes d'au moins 14rem, autant que la largeur
 * en accepte. `auto-fit` et non `auto-fill` — avec deux champs seulement, la
 * seconde variante laisserait des colonnes vides et les champs seraient etroits
 * sans raison.
 */
const FORM_GRID = "grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-4 gap-y-3";

/** En-tetes de colonnes : libelles graves, comme les etiquettes du Studio. */
const HEAD = "text-muted-foreground font-mono text-xs tracking-wider uppercase";

/*
 * Bouton d'envoi de fichier : un <label> qui porte un <input type="file">
 * masque. Le focus clavier tombe sur l'input ; le cadre le montre sur le bouton.
 */
const UPLOAD = "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]";

const PAYLOAD =
  "bg-muted/40 max-h-[22rem] overflow-auto border px-3 py-2 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]";

export default function ImportWizard({
  shops,
  templates,
}: {
  shops: Shop[];
  templates: Template[];
}) {
  const uid = useId();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mapping, setMapping] = useState<MappingTable>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const [shopSlug, setShopSlug] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [version, setVersion] = useState<"published" | "draft">("published");
  const [locale, setLocale] = useState("fr");
  const [listSeparator, setListSeparator] = useState("|");
  const [concurrency, setConcurrency] = useState(2);
  const [shopFields, setShopFields] = useState<Record<string, string>>({});

  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(0);
  const [filter, setFilter] = useState<RowFilter>({ column: "", value: "", negate: false });

  const [images, setImages] = useState<Map<string, File>>(new Map());
  const [imagesLabel, setImagesLabel] = useState<string | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [apercu, setApercu] = useState(false);
  const [apercuErreur, setApercuErreur] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [zipName, setZipName] = useState<string | null>(null);

  const attempts = useRef(new Map<number, Attempt>());
  const abort = useRef<AbortController | null>(null);
  const zipUrl = useRef<string | null>(null);

  const count = catalogSize(catalog);

  /** Les templates que cette boutique peut servir — la regle de production. */
  const visibleTemplates = useMemo(
    () => templates.filter((template) => template.scope === "shared" || template.scope === shopSlug),
    [templates, shopSlug]
  );
  const template = visibleTemplates.find((row) => `${row.scope}|${row.slug}` === templateKey) ?? null;

  const recordAt = useCallback(
    (index: number): SourceRecord => {
      if (catalog === null) throw new Error("aucun catalogue");
      return catalog.kind === "csv"
        ? csvRecord(catalog.columns, catalog.rows[index])
        : jsonRecord(catalog.items[index]);
    },
    [catalog]
  );

  /** La premiere valeur non vide d'une colonne : un exemple vaut un libelle. */
  const samples = useMemo(() => {
    const out: Record<string, string> = {};
    if (catalog === null) return out;

    for (const column of catalog.columns) {
      let value: unknown;
      for (let index = 0; index < Math.min(count, 20) && !isShown(value); index += 1) {
        value =
          catalog.kind === "csv"
            ? csvRecord(catalog.columns, catalog.rows[index]).read(column)
            : (jsonRecord(catalog.items[index]).readMany(column)?.find(isShown) ??
              getPath(catalog.items[index], column));
      }
      out[column] = isShown(value) ? truncate(String(value)) : "";
    }
    return out;
  }, [catalog, count]);

  const mappedCount = Object.values(mapping).filter((target) => target !== "").length;

  /**
   * Les lignes que le filtre garde.
   *
   * Sans filtre, un export PrestaShop rend AUSSI les produits desactives — 409
   * sur les 1042 de l'export qui a servi de reference au collecteur. C'est le
   * meme besoin que son `--where`, et la meme forme : le filtre porte sur une
   * colonne du FICHIER, celle que l'utilisateur a sous les yeux.
   */
  const eligible = useMemo(() => selectRows(catalog, filter), [catalog, filter]);

  /** Ce qui sera reellement traite : le filtre d'abord, la plage ensuite. */
  const selection = useMemo(() => eligible.slice(from - 1, to), [eligible, from, to]);

  /** Le filtre change la numerotation : la plage suit, sans quoi elle deborde. */
  /**
   * Rend le template choisi sur les donnees d'exemple du Studio et l'ouvre.
   *
   * Le meme sas que le lot (src/lib/renderQueue.ts) : un apercu demande pendant
   * une generation en masse attend son tour, il ne double personne.
   */
  async function apercuTemplate() {
    if (template === null) return;

    setApercu(true);
    setApercuErreur(null);

    try {
      const response = await fetch("/api/editor/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template: { scope: template.scope, slug: template.slug, version },
          shop: shopSeed(shopFields),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setApercuErreur(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setApercu(false);
    }
  }

  function changeFilter(next: RowFilter) {
    setFilter(next);
    setFrom(1);
    setTo(selectRows(catalog, next).length);
    setCheck(null);
  }

  // --- 1. Le fichier --------------------------------------------------------

  async function loadFile(file: File | null) {
    if (!file) return;
    setFileError(null);
    setPreview(null);
    setCheck(null);
    resetRun();

    try {
      const text = await file.text();
      const loaded = file.name.toLowerCase().endsWith(".json")
        ? loadJson(file.name, text)
        : loadCsv(file.name, text);

      setCatalog(loaded);
      // La suggestion ne fait QUE l'identite : une colonne deja nommee comme un
      // champ du contrat. Voir suggestTarget — deviner un alias se tromperait
      // en silence.
      setMapping(Object.fromEntries(loaded.columns.map((column) => [column, suggestTarget(column)])));
      setFilter({ column: "", value: "", negate: false });
      setFrom(1);
      setTo(loaded.kind === "csv" ? loaded.rows.length : loaded.items.length);
    } catch (cause) {
      setCatalog(null);
      setFileError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function changeItemsPath(path: string) {
    if (catalog === null || catalog.kind !== "json") return;
    const items = itemsAt(catalog.root, path);
    const columns = discoverJsonColumns(items);
    setCatalog({ ...catalog, itemsPath: path, items, columns });
    setMapping(Object.fromEntries(columns.map((column) => [column, suggestTarget(column)])));
    setFrom(1);
    setTo(items.length);
  }

  // --- 2. La correspondance -------------------------------------------------

  function setTarget(column: string, target: string) {
    setMapping((current) => ({ ...current, [column]: target }));
    setPreview(null);
    setCheck(null);
  }

  function exportMapping() {
    // Exactement le fichier que --mapping attend : les colonnes ecartees n'y
    // figurent pas, puisque c'est une liste blanche des deux cotes.
    const kept = Object.fromEntries(Object.entries(mapping).filter(([, target]) => target !== ""));
    download(
      new Blob([JSON.stringify(kept, null, 2)], { type: "application/json" }),
      `mapping-${catalog?.fileName.replace(/\.[^.]+$/, "") ?? "catalogue"}.json`
    );
  }

  async function importMapping(file: File | null) {
    if (!file || catalog === null) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Un fichier de correspondance est un objet { colonne: cible }.");
      }
      const loaded = parsed as Record<string, unknown>;
      const next: MappingTable = {};
      const unknown: string[] = [];
      for (const column of catalog.columns) {
        const target = loaded[column];
        next[column] = typeof target === "string" ? target : "";
      }
      // Une correspondance qui vise une colonne absente du fichier ne s'appliquera
      // jamais : le dire vaut mieux que de laisser chercher pourquoi un champ
      // reste vide.
      for (const column of Object.keys(loaded)) {
        // "//" est la cle de commentaire des fichiers livres
        // (collectors/csv/prestashop.mapping.json) : ce n'est pas une colonne.
        if (column !== "//" && !catalog.columns.includes(column)) unknown.push(column);
      }
      setMapping(next);
      setFileError(
        unknown.length === 0
          ? null
          : `Correspondance chargée. ${unknown.length} colonne(s) du fichier de mapping sont absentes du catalogue : ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "..." : ""}`
      );
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  // --- 3. Construire un payload --------------------------------------------

  const buildPayload = useCallback(
    async (index: number) => {
      const attachments = new Map<string, File>();
      const missing: string[] = [];

      const mapped = await mapRecord(recordAt(index), mapping, {
        listSeparator,
        fallbackRef: `ligne-${index + 2}`,
        seed: { shop: shopSeed(shopFields) },
        resolveImage: (raw) => {
          if (isRemoteRef(raw)) return raw;
          const file = findImageFile(images, raw);
          if (file === undefined) {
            // Sans dossier d'images, un nom de fichier local ne designe rien
            // ici : il ne doit surtout pas partir tel quel, le Studio refuse
            // les chemins nus.
            missing.push(raw);
            return undefined;
          }
          const key = assetKeyFor(raw);
          attachments.set(key, file);
          return `asset://${key}`;
        },
      });

      return { mapped, attachments, missing };
    },
    [recordAt, mapping, listSeparator, shopFields, images]
  );

  async function showFirstPayload() {
    setCheck(null);
    try {
      const { mapped } = await buildPayload(selection[0] ?? 0);
      setPreview(JSON.stringify({ ref: mapped.ref, data: mapped.data }, null, 2));
    } catch (cause) {
      setPreview(`Erreur : ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  /**
   * Validation LOCALE de tout le lot, avec le schema du serveur lui-meme.
   *
   * Le meme argument que dans collectors/core/payload.ts : le Studio repond 422
   * avec le chemin exact du champ fautif, la validation locale n'apporte donc
   * pas un meilleur diagnostic — elle apporte le MOMENT. Un mapping qui se
   * trompe de champ echoue ici en une seconde, pas au 400e aller-retour.
   */
  async function checkAll() {
    setPreview(null);
    const problems: string[] = [];
    let missingImages = 0;

    for (const index of selection) {
      try {
        const { mapped, missing } = await buildPayload(index);
        missingImages += missing.length;
        const parsed = renderDataSchema.safeParse(mapped.data);
        if (!parsed.success) {
          problems.push(
            `ligne ${index + 2} (${mapped.ref}) : ${parsed.error.issues
              .slice(0, 2)
              .map((issue) => `${issue.path.join(".") || "(racine)"} — ${issue.message}`)
              .join(" ; ")}`
          );
        }
      } catch (cause) {
        problems.push(`ligne ${index + 2} : ${cause instanceof Error ? cause.message : String(cause)}`);
      }
      if (problems.length >= 20) break;
    }

    const total = selection.length;
    setCheck(
      problems.length === 0
        ? `${total} ligne(s) validées par le schéma du Studio.` +
            (missingImages > 0
              ? ` ${missingImages} référence(s) d'image ne pointent sur rien : les fiches sortiront sans ces visuels.`
              : "")
        : `${problems.length}${problems.length >= 20 ? "+" : ""} ligne(s) refusées par le contrat :\n${problems.join("\n")}`
    );
  }

  // --- 4. Le lot ------------------------------------------------------------

  function resetRun() {
    attempts.current = new Map();
    if (zipUrl.current !== null) URL.revokeObjectURL(zipUrl.current);
    zipUrl.current = null;
    setZipName(null);
    setTick((value) => value + 1);
  }

  async function run(indices: number[]) {
    if (template === null) return;

    setRunning(true);
    setPreview(null);
    setCheck(null);
    if (zipUrl.current !== null) {
      URL.revokeObjectURL(zipUrl.current);
      zipUrl.current = null;
      setZipName(null);
    }

    const controller = new AbortController();
    abort.current = controller;
    const queue = [...indices];

    // Un pool et non un Promise.all sur tout le lot : le Studio n'accepte que
    // MAX_CONCURRENT_RENDERS rendus simultanes et met le reste en file avant de
    // repondre 429. Lancer 400 requetes d'un coup ne va pas plus vite, et prive
    // l'apercu de l'editeur, qui partage le meme sas.
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      for (;;) {
        const index = queue.shift();
        if (index === undefined || controller.signal.aborted) return;

        const attempt = await renderOne(index, controller.signal);
        // Une fiche interrompue en vol n'est pas un echec : elle n'a pas ete
        // tentee jusqu'au bout. La compter en echec gonflerait le tableau des
        // reprises avec des lignes que personne n'a demandees.
        if (attempt !== null) attempts.current.set(index, attempt);
        setTick((value) => value + 1);
      }
    });

    await Promise.all(workers);
    abort.current = null;
    setRunning(false);
  }

  async function renderOne(index: number, signal: AbortSignal): Promise<Attempt | null> {
    const line = index + 2;
    let ref = `ligne-${line}`;

    try {
      const { mapped, attachments, missing } = await buildPayload(index);
      ref = mapped.ref;
      const warnings = [
        ...mapped.warnings,
        ...missing.map((raw) => `image introuvable : ${raw}`),
      ];

      const payload = {
        scope: template!.scope,
        slug: template!.slug,
        version,
        locale: mapped.locale ?? locale,
        ...(shopSlug === "" ? {} : { shopScope: shopSlug }),
        data: mapped.data,
      };

      const parsed = renderDataSchema.safeParse(mapped.data);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(
          `contrat : ${issue.path.join(".") || "(racine)"} — ${issue.message}`
        );
      }

      const response = await post(payload, attachments, signal);
      warnings.push(...decodeWarningsHeader(response.headers.get("x-render-warnings")));

      return { ref, line, warnings, pdf: new Uint8Array(await response.arrayBuffer()) };
    } catch (cause) {
      // Le signal fait foi, pas le message : selon le navigateur, une requete
      // interrompue leve « The user aborted a request » ou « This operation was
      // aborted ». Reconnaitre l'annulation au texte se casserait en silence.
      if (signal.aborted) return null;
      return { ref, line, warnings: [], error: cause instanceof Error ? cause.message : String(cause) };
    }
  }

  /**
   * Un envoi, avec la meme discipline que les collecteurs : 429 et 502 sont
   * rejoues en suivant Retry-After, le reste non. C'est cette distinction qui
   * separe un incident d'infrastructure d'un template casse — reessayer sur un
   * 422 ne ferait que perdre du temps 400 fois.
   */
  async function post(
    payload: unknown,
    attachments: Map<string, File>,
    signal: AbortSignal
  ): Promise<Response> {
    let wait = 2000;

    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      if (attachments.size === 0) {
        response = await fetch("/api/editor/render", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal,
        });
      } else {
        const form = new FormData();
        form.append("payload", JSON.stringify(payload));
        for (const [key, file] of attachments) {
          const mime = imageMime(file);
          if (mime === null) continue; // refusee par la route : autant l'omettre
          // `slice` retype sans relire les octets : File.type arrive parfois
          // vide, et la route refuse alors la piece jointe avec un 415.
          form.append(`asset[${key}]`, file.type === mime ? file : file.slice(0, file.size, mime), key);
        }
        response = await fetch("/api/editor/render", { method: "POST", body: form, signal });
      }

      if (response.ok) return response;

      const retryable = response.status === 429 || response.status === 502 || response.status === 503;
      if (retryable && attempt < 4) {
        const after = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : wait, signal);
        wait *= 2;
        continue;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string; detail?: unknown };
      throw new Error(
        `HTTP ${response.status} — ${body.error ?? "erreur"}${
          body.detail === undefined ? "" : ` (${summarize(body.detail)})`
        }`
      );
    }
  }

  function stop() {
    abort.current?.abort();
  }

  // --- 5. L'archive ---------------------------------------------------------

  function buildArchive() {
    const taken = new Set<string>();
    const entries: ZipEntry[] = [];
    const report: ReportRow[] = [];

    for (const index of [...attempts.current.keys()].sort((a, b) => a - b)) {
      const attempt = attempts.current.get(index)!;
      if (attempt.pdf === undefined) {
        report.push({
          ref: attempt.ref,
          line: attempt.line,
          status: "echec",
          file: "",
          warnings: attempt.warnings,
          error: attempt.error,
        });
        continue;
      }
      const name = pdfFilename(attempt.ref, taken);
      entries.push({ name, data: attempt.pdf });
      report.push({
        ref: attempt.ref,
        line: attempt.line,
        status: attempt.warnings.length > 0 ? "avertissements" : "ok",
        file: name,
        warnings: attempt.warnings,
      });
    }

    const encoder = new TextEncoder();
    entries.push({ name: "rapport.csv", data: encoder.encode(buildReportCsv(report)) });
    // Le mapping voyage avec l'archive : c'est ce qui permet de refaire le meme
    // lot dans six mois, ici ou en ligne de commande.
    entries.push({
      name: "mapping.json",
      data: encoder.encode(
        JSON.stringify(
          Object.fromEntries(Object.entries(mapping).filter(([, target]) => target !== "")),
          null,
          2
        )
      ),
    });

    // Blob a partir des morceaux : concatener demanderait de tenir l'archive
    // deux fois en memoire.
    const blob = new Blob(zipParts(entries) as BlobPart[], { type: "application/zip" });
    if (zipUrl.current !== null) URL.revokeObjectURL(zipUrl.current);
    zipUrl.current = URL.createObjectURL(blob);
    const name = `fiches-${template?.slug ?? "lot"}-${stamp()}.zip`;
    setZipName(name);
    downloadUrl(zipUrl.current, name);
  }

  // --- Rendu ----------------------------------------------------------------

  const done = attempts.current.size;
  const results = [...attempts.current.values()];
  const failed = results.filter((attempt) => attempt.pdf === undefined);
  const warned = results.filter((attempt) => attempt.pdf !== undefined && attempt.warnings.length > 0);
  const planned = selection.length;
  void tick; // les compteurs se lisent dans une ref : c'est `tick` qui redessine

  return (
    <>
      <section className="space-y-4">
        <SectionHead as="h2" no="01" title="Le fichier" />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={UPLOAD} asChild>
            <label>
              <Icon icon={FileUp} size="sm" />
              Choisir un CSV ou un JSON
              <input
                type="file"
                className="sr-only"
                accept=".csv,.json,text/csv,application/json"
                onChange={(event) => loadFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </Button>
          {catalog === null ? null : (
            <span className="text-muted-foreground text-sm">
              <strong className="text-foreground">{catalog.fileName}</strong> — {count} ligne(s),{" "}
              {catalog.columns.length} colonne(s)
            </span>
          )}
        </div>

        {catalog?.kind === "json" ? (
          <div className="grid max-w-xl gap-2">
            <Label htmlFor={`${uid}-items`}>Chemin du tableau d&apos;éléments</Label>
            <Input
              id={`${uid}-items`}
              value={catalog.itemsPath}
              onChange={(event) => changeItemsPath(event.target.value)}
              placeholder="items, data.products, ou vide si la racine est le tableau"
            />
          </div>
        ) : null}

        {fileError ? (
          <Alert variant="destructive">
            <Icon icon={CircleAlert} />
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-muted-foreground text-sm">
          Le fichier est lu <strong>dans le navigateur</strong>{" "}: rien n&apos;est téléversé tant que la
          génération n&apos;est pas lancée. Un CSV donne ses colonnes, un JSON ses chemins — dont ceux
          à <Code>[]</Code>, qui traversent un tableau (<Code>medias[].url</Code>).
        </p>
      </section>

      {catalog === null ? null : (
        <section className="space-y-4">
          <SectionHead as="h2" no="02" title="La correspondance" aside={`${mappedCount} colonne(s) retenue(s)`} />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={exportMapping} disabled={mappedCount === 0}>
              <Icon icon={Download} size="sm" />
              Exporter la correspondance
            </Button>
            <Button variant="outline" size="sm" className={UPLOAD} asChild>
              <label>
                <Icon icon={FileUp} size="sm" />
                Charger une correspondance
                <input
                  type="file"
                  className="sr-only"
                  accept=".json,application/json"
                  onChange={(event) => importMapping(event.target.files?.[0] ?? null)}
                />
              </label>
            </Button>
            <div className="flex items-center gap-2">
              <Label htmlFor={`${uid}-separator`} className="text-muted-foreground font-normal">
                Séparateur de listes
              </Label>
              <Input
                id={`${uid}-separator`}
                className="h-8 w-12 text-center"
                value={listSeparator}
                onChange={(event) => setListSeparator(event.target.value || "|")}
              />
            </div>
            <span className="text-muted-foreground text-sm">
              Il découpe <Code>images</Code>, <Code>badges</Code> et{" "}
              <Code>product.category_path</Code> quand une colonne en porte plusieurs. Un export
              PrestaShop utilise la <strong>virgule</strong>{" "}: laisser la barre verticale y
              produirait une seule image dont l&apos;URL serait toute la liste.
            </span>
          </div>

          <p className="text-muted-foreground text-sm">
            C&apos;est le fichier de <Code>--mapping</Code>{" "}des collecteurs, à l&apos;identique : ce qui est
            réglé ici se rejoue en ligne de commande. Une colonne laissée sur « Ignorer » n&apos;est pas
            envoyée — le contrat écarterait les clés inconnues en silence, et elles ne serviraient
            qu&apos;à faire régénérer le catalogue quand une colonne sans rapport bouge.
          </p>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Colonne du fichier</TableHead>
                <TableHead className={HEAD}>Exemple</TableHead>
                <TableHead className={HEAD}>Champ de la fiche</TableHead>
                <TableHead className={HEAD}>Transformation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.columns.map((column) => (
                <MappingRow
                  key={column}
                  column={column}
                  sample={samples[column] ?? ""}
                  target={mapping[column] ?? ""}
                  onChange={(target) => setTarget(column, target)}
                />
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {catalog === null ? null : (
        <section className="space-y-4">
          <SectionHead as="h2" no="03" title="Le template et la boutique" />

          <div className={FORM_GRID}>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-shop`}>Boutique</Label>
              <Select
                value={shopSlug === "" ? NO_SHOP : shopSlug}
                onValueChange={(value) => {
                  const slug = value === NO_SHOP ? "" : value;
                  setShopSlug(slug);
                  setTemplateKey("");
                  const shop = shops.find((row) => row.slug === slug);
                  /*
                   * Les reglages de la boutique ECRASENT les champs saisis a la
                   * main, et c'est le comportement voulu : changer de boutique
                   * en cours d'import doit changer l'identite de la fiche en
                   * entier, pas la laisser a moitie renseignee avec l'adresse du
                   * site precedent. Les valeurs restent modifiables juste en
                   * dessous pour le cas particulier.
                   */
                  setShopFields(shop ? shopFieldsFrom(shop) : {});
                }}
              >
                <SelectTrigger id={`${uid}-shop`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SHOP}>Aucune — bibliothèque commune seule</SelectItem>
                  {shops.map((shop) => (
                    <SelectItem key={shop.slug} value={shop.slug}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${uid}-template`}>Template</Label>
              {/* Une valeur vide rend la mention « Choisir... » : c'est le
                  placeholder de Radix, qui interdit un element de valeur vide. */}
              <Select value={templateKey} onValueChange={setTemplateKey}>
                <SelectTrigger id={`${uid}-template`} className="w-full">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {visibleTemplates.map((row) => (
                    <SelectItem
                      key={`${row.scope}|${row.slug}`}
                      value={`${row.scope}|${row.slug}`}
                      disabled={row.published === null && row.draft === 0}
                    >
                      {row.name} ({row.scope === "shared" ? "bibliothèque" : row.scope})
                      {row.published === null ? " — aucune version publiée" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${uid}-version`}>Version</Label>
              <Select value={version} onValueChange={(value) => setVersion(value as "published" | "draft")}>
                <SelectTrigger id={`${uid}-version`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">
                    Publiée{template?.published === null ? " (aucune)" : ` (v${template?.published ?? "?"})`}
                  </SelectItem>
                  <SelectItem value="draft">Brouillon (v{template?.draft ?? "?"}) — pour éprouver</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${uid}-locale`}>Langue</Label>
              <Input id={`${uid}-locale`} value={locale} onChange={(event) => setLocale(event.target.value)} />
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            La boutique décide de deux choses : les templates proposés (les siens et ceux de la
            bibliothèque commune, comme en production) et les images que le rendu peut lire — un
            template ne voit que <Code>/assets/shared/…</Code> et <Code>/assets/&lt;sa boutique&gt;/…</Code>.
          </p>

          {/*
            APERCU DU TEMPLATE, sur donnees d'exemple.

            C'est la reponse au besoin de l'importateur, qui n'a pas acces a
            l'editeur : voir a quoi ressemble la fiche AVANT de lancer 400
            rendus. Il ne remplace pas le controle d'un integrateur — les
            donnees ne sont pas celles du catalogue — mais il attrape le cas qui
            coute le plus cher : s'etre trompe de template.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={template === null || apercu}
              onClick={apercuTemplate}
            >
              <Icon icon={Eye} size="sm" />
              {apercu ? "Rendu…" : "Aperçu du template"}
            </Button>
            {apercuErreur ? (
              <span role="alert" className="text-destructive text-sm">
                {apercuErreur}
              </span>
            ) : null}
          </div>

          <SectionHead as="h3" level="panel" title="Identité de la boutique sur la fiche" />
          <p className="text-muted-foreground text-sm">
            Ces valeurs sont communes à toutes les fiches du lot. Une colonne mappée sur
            <Code> shop.*</Code> les remplace ligne par ligne. <Code>shop.name</Code> est le seul champ
            que le contrat exige.
          </p>
          <div className={FORM_GRID}>
            {SHOP_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="grid gap-2">
                <Label htmlFor={`${uid}-shop-${key}`}>{label}</Label>
                <Input
                  id={`${uid}-shop-${key}`}
                  value={shopFields[key] ?? ""}
                  placeholder={placeholder}
                  onChange={(event) =>
                    setShopFields((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <SectionHead as="h3" level="panel" title="Images" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className={UPLOAD} asChild>
              <label>
                <Icon icon={FolderUp} size="sm" />
                Choisir un dossier d&apos;images
                <input
                  type="file"
                  className="sr-only"
                  /* webkitdirectory : le seul moyen de lire un dossier depuis un
                     navigateur. L'attribut n'est pas dans les types React. */
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    setImages(indexImageFolder(files));
                    setImagesLabel(files.length === 0 ? null : `${files.length} fichier(s) indexés`);
                  }}
                />
              </label>
            </Button>
            {imagesLabel ? <span className="text-muted-foreground text-sm">{imagesLabel}</span> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Une valeur d&apos;image qui est une URL <Code>https</Code>{" "}traverse telle quelle et sera
            chargée au rendu. Une valeur qui est un nom de fichier est cherchée dans ce dossier, par
            chemin relatif ou par nom seul, et jointe à la requête. Une image introuvable coûte
            l&apos;image, pas la fiche : elle est signalée dans le rapport.
          </p>
        </section>
      )}

      {catalog === null ? null : (
        <section className="space-y-4">
          <SectionHead as="h2" no="04" title="Générer" />

          <div className={FORM_GRID}>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-filter-column`}>Ne garder que les lignes où</Label>
              {/* Une colonne sans en-tete ne peut pas servir de filtre : la
                  colonne vide est deja la valeur « pas de filtre ». */}
              <Select
                value={filter.column === "" ? ALL_ROWS : filter.column}
                onValueChange={(value) => changeFilter({ ...filter, column: value === ALL_ROWS ? "" : value })}
              >
                <SelectTrigger id={`${uid}-filter-column`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ROWS}>Toutes les lignes</SelectItem>
                  {catalog.columns
                    .filter((column) => column !== "")
                    .map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-filter-value`}>{filter.negate ? "est différent de" : "vaut"}</Label>
              {/* La valeur du filtre et sa bascule =/≠ forment UN controle : le
                  bouton est colle au champ, et non pose a cote comme une action
                  independante. */}
              <div className="flex gap-1">
                <Input
                  id={`${uid}-filter-value`}
                  className="min-w-0 flex-1"
                  value={filter.value}
                  disabled={filter.column === ""}
                  placeholder="1"
                  onChange={(event) => changeFilter({ ...filter, value: event.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Inverser le filtre"
                  title="Inverser le filtre"
                  disabled={filter.column === ""}
                  onClick={() => changeFilter({ ...filter, negate: !filter.negate })}
                >
                  {filter.negate ? "≠" : "="}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-from`}>De la ligne retenue</Label>
              <Input
                id={`${uid}-from`}
                type="number"
                className="tabular-nums"
                min={1}
                max={eligible.length}
                value={from}
                onChange={(event) => setFrom(clamp(Number(event.target.value), 1, eligible.length))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-to`}>à la ligne retenue</Label>
              <Input
                id={`${uid}-to`}
                type="number"
                className="tabular-nums"
                min={1}
                max={eligible.length}
                value={to}
                onChange={(event) => setTo(clamp(Number(event.target.value), 1, eligible.length))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-concurrency`}>Rendus simultanés</Label>
              <Select value={String(concurrency)} onValueChange={(value) => setConcurrency(Number(value))}>
                <SelectTrigger id={`${uid}-concurrency`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filter.column !== "" ? (
            <p className="text-muted-foreground text-sm">
              {eligible.length} ligne(s) retenues sur {count} — {count - eligible.length}{" "}écartées par le
              filtre. Sur un export PrestaShop, c&apos;est ainsi qu&apos;on évite de rendre les produits
              désactivés.
            </p>
          ) : null}

          {planned > COMFORTABLE_BATCH ? (
            <Alert variant="warning">
              <Icon icon={TriangleAlert} />
              <AlertDescription>
                <p>
                  {planned}{" "}fiches dans un seul lot : l&apos;archive vit dans la mémoire de cet onglet, et le
                  fermer perd tout. Découper en tranches de {COMFORTABLE_BATCH} avec les deux champs
                  ci-dessus, ou passer par un collecteur (<Code>pnpm collect:csv</Code>), qui tient un
                  journal et sait reprendre.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={showFirstPayload} disabled={running}>
              Voir le premier payload
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={checkAll} disabled={running}>
              Vérifier les {planned} ligne(s)
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetRun();
                run(selection);
              }}
              disabled={running || template === null || planned === 0}
            >
              Générer {planned} fiche(s)
            </Button>
            {running ? (
              <Button type="button" variant="outline" size="sm" onClick={stop}>
                Annuler
              </Button>
            ) : null}
          </div>

          {template === null ? (
            <p className="text-muted-foreground text-sm">Choisir un template pour lancer le lot.</p>
          ) : null}
          {/* Le payload et le compte rendu de verification : du texte a lire,
              parfois long. Il defile dans son cadre plutot que d'allonger la
              page — et `pre` garde les retours a la ligne du JSON, qui sont son
              indentation. */}
          {preview ? <pre className={PAYLOAD}>{preview}</pre> : null}
          {check ? <pre className={PAYLOAD}>{check}</pre> : null}

          {done > 0 || running ? (
            <div className="space-y-1.5">
              <Progress
                aria-label="Avancement du lot"
                value={planned === 0 ? 0 : Math.min(100, (done / planned) * 100)}
              />
              <p className="text-muted-foreground text-sm tabular-nums">
                <strong className="text-foreground">{done}</strong> / {planned} rendues
                {warned.length > 0 ? <> · {warned.length} avec avertissement</> : null}
                {failed.length > 0 ? (
                  <>
                    {" "}
                    · <span className="text-destructive">{failed.length} en échec</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {!running && done > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={buildArchive}
                disabled={results.every((a) => a.pdf === undefined)}
              >
                <Icon icon={Download} size="sm" />
                Télécharger le ZIP
              </Button>
              {failed.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    run(
                      [...attempts.current.entries()]
                        .filter(([, attempt]) => attempt.pdf === undefined)
                        .map(([index]) => index)
                    )
                  }
                >
                  <Icon icon={RotateCcw} size="sm" />
                  Rejouer les {failed.length} échec(s)
                </Button>
              ) : null}
              {zipName ? <span className="text-muted-foreground font-mono text-xs">{zipName}</span> : null}
            </div>
          ) : null}

          {failed.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(HEAD, "text-right")}>Ligne</TableHead>
                  <TableHead className={HEAD}>Référence</TableHead>
                  <TableHead className={HEAD}>Échec</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failed.slice(0, 50).map((attempt) => (
                  <TableRow key={attempt.line}>
                    <TableCell className="text-right align-top tabular-nums">{attempt.line}</TableCell>
                    <TableCell className="align-top">
                      <Code>{attempt.ref}</Code>
                    </TableCell>
                    <TableCell className="text-destructive align-top whitespace-normal">{attempt.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </section>
      )}
    </>
  );
}

// --- Une ligne de correspondance ---------------------------------------------

/**
 * La cible est une CHAINE, pas trois champs de formulaire : c'est elle qui
 * s'exporte et se relit, et la decomposer en etat separe ferait diverger ce qui
 * est a l'ecran de ce qui part dans le fichier.
 *
 * Les selects sont ceux de Radix, qui interdit un element de valeur vide : la
 * cible vide (« Ignorer ») et la transformation vide (« Aucune ») passent par
 * des sentinelles, converties a l'entree et a la sortie. Le contenu d'un select
 * Radix n'est monte qu'a l'ouverture : une table de quelques centaines de
 * colonnes ne rend pas quelques centaines de listes.
 */
function MappingRow({
  column,
  sample,
  target,
  onChange,
}: {
  column: string;
  sample: string;
  target: string;
  onChange: (target: string) => void;
}) {
  const [base, transform] = splitTarget(target);
  const kind = base.startsWith("feature:") ? "feature:" : base.startsWith("custom.") ? "custom." : base;
  const extra = kind === "feature:" || kind === "custom." ? base.slice(kind.length) : "";

  const compose = (nextBase: string, nextTransform: string) =>
    onChange(nextBase === "" ? "" : nextTransform === "" ? nextBase : `${nextBase} | ${nextTransform}`);

  // Une cible ou une transformation venue d'un fichier de correspondance et
  // absente des listes reste affichee telle quelle, plutot qu'un champ vide qui
  // ferait croire la colonne ignoree.
  const knownKind = kind === "" || kind === "feature:" || kind === "custom." || KNOWN_TARGETS.has(kind);
  const knownTransform = transform === "" || KNOWN_TRANSFORMS.has(transform);

  return (
    <TableRow>
      <TableCell className="align-top">
        <Code>{column}</Code>
      </TableCell>
      {/* L'exemple est une DONNEE lue dans le fichier, pas un libelle de
          l'interface : il est pose en retrait pour qu'on ne le confonde pas
          avec un choix a faire. */}
      <TableCell className="text-muted-foreground max-w-[18rem] align-top font-mono text-xs whitespace-normal [overflow-wrap:anywhere]">
        {sample}
      </TableCell>
      <TableCell className="min-w-[16rem] align-top">
        <Select
          value={kind === "" ? IGNORE : kind}
          onValueChange={(value) => {
            const next = value === IGNORE ? "" : value;
            compose(next === "feature:" || next === "custom." ? `${next}${extra}` : next, transform);
          }}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={`Champ de la fiche pour ${column}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={IGNORE}>Ignorer</SelectItem>
            {knownKind ? null : <SelectItem value={kind}>{kind}</SelectItem>}
            {TARGET_GROUPS.map((group) => (
              <SelectGroup key={group.group}>
                <SelectLabel>{group.group}</SelectLabel>
                {group.targets.map((entry) => (
                  <SelectItem key={entry.path} value={entry.path}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            <SelectGroup>
              <SelectLabel>Au cas par cas</SelectLabel>
              <SelectItem value="feature:">Caractéristique nommée...</SelectItem>
              <SelectItem value="custom.">Champ custom...</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {kind === "feature:" || kind === "custom." ? (
          <Input
            className="mt-1 h-8"
            aria-label={kind === "feature:" ? `Caractéristique pour ${column}` : `Clé custom pour ${column}`}
            value={extra}
            placeholder={kind === "feature:" ? "Capacité de charge@Q" : "clé"}
            onChange={(event) => compose(`${kind}${event.target.value}`, transform)}
          />
        ) : null}
      </TableCell>
      <TableCell className="min-w-[12rem] align-top">
        <Select
          value={transform === "" ? NO_TRANSFORM : transform}
          disabled={base === ""}
          onValueChange={(value) => compose(base, value === NO_TRANSFORM ? "" : value)}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={`Transformation pour ${column}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TRANSFORM}>Aucune</SelectItem>
            {knownTransform ? null : <SelectItem value={transform}>{transform}</SelectItem>}
            {TRANSFORMS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}

/** Le code en ligne : un nom de colonne, un chemin, une commande. */
function Code({ children }: { children: ReactNode }) {
  return <code className="bg-muted px-1 font-mono text-xs">{children}</code>;
}

// --- Outils ------------------------------------------------------------------





function loadCsv(fileName: string, text: string): Catalog {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) throw new Error("Fichier vide.");

  const columns = rows[0].map((cell) => cell.trim());
  if (columns.every((column) => column === "")) throw new Error("Aucun en-tête de colonne lisible.");

  return { kind: "csv", fileName, columns, rows: rows.slice(1) };
}

function loadJson(fileName: string, text: string): Catalog {
  const root: unknown = JSON.parse(text);
  const itemsPath = detectItemsPath(root);
  if (itemsPath === null) {
    throw new Error("Aucun tableau d'éléments trouvé. Indiquer son chemin après le chargement.");
  }
  const items = itemsAt(root, itemsPath);
  return { kind: "json", fileName, root, itemsPath, items, columns: discoverJsonColumns(items) };
}

function splitTarget(target: string): [string, string] {
  const [base, ...rest] = target.split("|").map((part) => part.trim());
  return [base ?? "", rest.join(" | ")];
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), Math.max(min, max)) : min;
}

function isShown(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function truncate(value: string): string {
  return value.length > 60 ? `${value.slice(0, 60)}...` : value;
}

function summarize(detail: unknown): string {
  if (typeof detail === "string") return truncate(detail);
  if (Array.isArray(detail)) {
    return detail
      .slice(0, 2)
      .map((issue) => {
        const typed = issue as { path?: unknown[]; message?: string };
        return `${(typed.path ?? []).join(".") || "(racine)"} : ${typed.message ?? "?"}`;
      })
      .join(" ; ");
  }
  return truncate(JSON.stringify(detail ?? ""));
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("abort"));
      },
      { once: true }
    );
  });
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, name);
  // Revoque au tour suivant : revoquer tout de suite annulerait le
  // telechargement dans Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function downloadUrl(url: string, name: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
