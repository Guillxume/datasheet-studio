"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@guillxume/ui/components/badge";
import { Button } from "@guillxume/ui/components/button";
import { Checkbox } from "@guillxume/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { ClipboardPaste, EyeOff, ListChecks } from "lucide-react";
import IconPicker, { IconView, type IconMarkup } from "@/components/IconPicker";
import { parseSelection } from "@/lib/datasheets";
import type { ImportedFiche } from "@/lib/bookImport";
import ImportDialog from "./ImportDialog";
import SelectionPanel, { type SelectedDetail } from "./SelectionPanel";

export type ConsultationRow = {
  /** Valeur de la case : langue et cle du produit (voir selectionValue). */
  value: string;
  /** Le produit, sans la langue : ce qu'on masque (migration 015). */
  productKey: string;
  productId: string;
  productName: string;
  locale: string;
  /** null : la boutique n'a pas transmis l'adresse de la fiche. */
  url: string | null;
  renderedAt: string;
  /** Categorie de niveau 1, celle de l'intercalaire. */
  category: string;
  /**
   * La reference de declinaison ou fournisseur qui a fait repondre la recherche
   * (migration 017). Sans elle, une ligne trouvee par « FRN-88231 » ne montre
   * rien qui ressemble a ce qu'on a tape, et se lit comme un faux resultat.
   */
  matchedRef?: { kind: "fournisseur" | "déclinaison"; ref: string } | null;
};

/**
 * Le tableau des fiches et l'action groupee.
 *
 * L'ACTION N'APPARAIT QU'AVEC UNE SELECTION : un bouton « Telecharger » toujours
 * visible et grise la moitie du temps se lit comme une panne.
 *
 * UNE LIGNE SANS ADRESSE N'A PAS DE CASE : le Studio ne saurait pas ou aller
 * chercher son PDF. La lui laisser cocher produirait un zip plus court que la
 * selection, sans que rien a l'ecran ne l'ait annonce.
 *
 * L'ENVOI EST UN FORMULAIRE CLASSIQUE (POST) : c'est le navigateur qui gere le
 * telechargement de l'archive, sa progression et son nom.
 *
 * LES INTERCALAIRES (tri par categorie) sont des lignes du tableau et non des
 * tableaux separes : les colonnes restent alignees d'une categorie a l'autre, et
 * la case « tout cocher » de l'en-tete continue de porter sur toute la liste.
 * La case d'un intercalaire coche sa seule categorie.
 *
 * LA SELECTION SURVIT A LA RECHERCHE. La recherche est un formulaire GET, donc
 * un rechargement de page : la selection, tenue dans l'etat de ce composant,
 * repartait a zero. Chercher un produit, le cocher, en chercher un autre
 * perdait le premier — c'est pourtant ainsi qu'on compose un envoi de quelques
 * fiches dans un catalogue de milliers (retour du 16/10/2026). Elle est donc
 * gardee dans le sessionStorage de l'onglet, par boutique : elle dure le temps
 * de la session de travail, et ne se melange pas d'une boutique a l'autre.
 *
 * Les cases « tout » et d'intercalaire ne portent que sur les lignes AFFICHEES :
 * decocher une recherche ne doit pas vider ce qui a ete coche avant.
 *
 * LES DETAILS DE CHAQUE FICHE COCHEE SONT GARDES AVEC ELLE (nom, id, categorie,
 * lien) : une fiche cochee lors d'une recherche precedente n'est plus dans
 * `rows`, et le panneau « Voir la selection » doit pourtant pouvoir la nommer.
 *
 * « IMPORT PRODUITS » EST TOUJOURS LA, selection ou non : on peut vouloir un
 * book tire d'un devis sans avoir rien coche (retour du 21/10/2026). Les fiches
 * importees partent directement au book, ou rejoignent la selection.
 */
export default function ConsultationClient({
  shop,
  rows,
  max,
  grouped,
  icons: initialIcons,
  canEditIcons,
  canHide = false,
  emptyMessage = null,
  locales = [],
}: {
  shop: string;
  rows: ConsultationRow[];
  max: number;
  grouped: boolean;
  icons: Record<string, IconMarkup>;
  canEditIcons: boolean;
  /** Administration (consultation:configure) : masquer des fiches. */
  canHide?: boolean;
  /** Aucune ligne pour cette recherche : ce message, et la selection reste. */
  emptyMessage?: string | null;
  /** Les langues de l'index de la boutique, la plus fournie d'abord (import). */
  locales?: string[];
}) {
  const router = useRouter();
  const [hiding, setHiding] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);
  // `restored` : la selection enregistree a ete relue. Avant, rien n'est ecrit —
  // sans quoi le premier rendu, vide, effacerait ce qu'on veut relire.
  const [{ selected, restored }, setSelection] = useState(() => ({ selected: new Set<string>(), restored: false }));
  // Ce qu'on sait de chaque fiche cochee. Les lignes affichees font foi ; les
  // autres viennent du stockage.
  const [details, setDetails] = useState<Record<string, SelectedDetail>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const setSelected = (update: Set<string> | ((current: Set<string>) => Set<string>)) =>
    setSelection((state) => ({
      restored: state.restored,
      selected: typeof update === "function" ? update(state.selected) : update,
    }));
  const storageKey = `consultation-selection:${shop}`;

  // Lue APRES le montage : le rendu serveur ne connait pas le sessionStorage,
  // et le lire pendant le rendu ferait diverger l'hydratation.
  useEffect(() => {
    let saved: Set<string> = new Set();
    let savedDetails: Record<string, SelectedDetail> = {};
    try {
      const raw: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      // Deux formes : la liste de cles des premiers jours, ou { selected, details }.
      const values = Array.isArray(raw) ? raw : (raw as { selected?: unknown })?.selected;
      if (Array.isArray(values)) saved = new Set(values.filter((value): value is string => typeof value === "string"));
      const known = (raw as { details?: unknown })?.details;
      if (known && typeof known === "object" && !Array.isArray(known)) savedDetails = known as Record<string, SelectedDetail>;
    } catch {
      // Stockage bloque ou illisible : on repart d'une selection vide.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique d'un stockage du navigateur, apres l'hydratation
    setSelection({ selected: saved, restored: true });
    setDetails(savedDetails);
  }, [storageKey]);

  const [icons, setIcons] = useState(initialIcons);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  const selectable = rows.filter((row) => row.url !== null);
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.value));
  const someSelected = selected.size > 0 && !allSelected;
  const tooMany = selected.size > max;
  const showLocale = new Set(rows.map((row) => row.locale)).size > 1;
  const shown = new Set(rows.map((row) => row.value));
  const detailOf = (row: ConsultationRow): SelectedDetail => ({
    name: row.productName,
    productId: row.productId,
    category: row.category,
    locale: row.locale,
    url: row.url,
  });
  // Une ligne affichee fait foi ; sinon, ce que le stockage en a retenu ; a
  // defaut (selection d'avant ce panneau), la cle seule.
  const rowByValue = new Map(rows.map((row) => [row.value, row]));
  const knownDetail = (value: string): SelectedDetail => {
    const row = rowByValue.get(value);
    if (row) return detailOf(row);
    const parsed = parseSelection(value);
    return (
      details[value] ?? {
        name: parsed?.productKey ?? value,
        productId: parsed?.productKey ?? value,
        category: "",
        locale: parsed?.locale ?? "",
        url: null,
      }
    );
  };
  const panelItems = [...selected].map((value) => ({ value, shown: shown.has(value), ...knownDetail(value) }));

  useEffect(() => {
    if (!restored) return;
    try {
      if (selected.size === 0) sessionStorage.removeItem(storageKey);
      else
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            selected: [...selected],
            details: Object.fromEntries([...selected].map((value) => [value, knownDetail(value)])),
          })
        );
    } catch {
      // Sans stockage, la selection vaut pour la page affichee, comme avant.
    }
    // knownDetail se recalcule a chaque rendu ; ce qui le fait varier est ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, details, rows, restored, storageKey]);

  const remove = (value: string) =>
    setSelected((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
  const offscreen = [...selected].filter((value) => !shown.has(value)).length;

  const addImported = (fiches: ImportedFiche[]) => {
    setDetails((current) => ({
      ...current,
      ...Object.fromEntries(
        fiches.map((fiche) => [
          fiche.value,
          { name: fiche.name, productId: fiche.productId, category: fiche.category, locale: fiche.locale, url: fiche.url },
        ])
      ),
    }));
    setSelected((current) => new Set([...current, ...fiches.map((fiche) => fiche.value)]));
  };

  const toggle = (value: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const row of selectable) {
        if (allSelected) next.delete(row.value);
        else next.add(row.value);
      }
      return next;
    });

  const groupState = (category: string) => {
    const members = selectable.filter((row) => row.category === category);
    const count = members.filter((row) => selected.has(row.value)).length;
    return { members, all: members.length > 0 && count === members.length, some: count > 0 && count < members.length };
  };

  const toggleGroup = (category: string) => {
    const { members, all } = groupState(category);
    setSelected((current) => {
      const next = new Set(current);
      for (const row of members) {
        if (all) next.delete(row.value);
        else next.add(row.value);
      }
      return next;
    });
  };

  const saveIcon = async (icon: IconMarkup) => {
    if (editing === null) return;
    setSaving(true);
    setIconError(null);
    try {
      const response = await fetch("/api/consultation/category-icon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boutique: shop, category: editing, icon: icon.ref }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Enregistrement impossible.");
      setIcons((current) => ({ ...current, [editing]: icon }));
      setEditing(null);
    } catch (cause) {
      setIconError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Masquer des produits (toutes langues) : ils sortent aussitot de la liste,
   * du zip et du book pour tous les comptes. On les reaffiche depuis la page
   * « Categories et fiches masquees ».
   */
  const hide = async (productKeys: string[]) => {
    setHiding(true);
    setHideError(null);
    try {
      const response = await fetch("/api/consultation/fiches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boutique: shop, products: [...new Set(productKeys)], hidden: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      setSelected(new Set());
      router.refresh();
    } catch (cause) {
      setHideError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setHiding(false);
    }
  };

  const columns = (showLocale ? 6 : 5) + (canHide ? 1 : 0);

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {rows.length === 0 ? (
            emptyMessage
          ) : (
            <>
              {rows.length} fiche{rows.length > 1 ? "s" : ""}
              {selectable.length < rows.length ? ` · ${rows.length - selectable.length} sans lien` : ""}
            </>
          )}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <ClipboardPaste aria-hidden="true" className="size-4" />
          Import produits
        </Button>
      </div>

      {/* LA BARRE D'ACTION GROUPEE RESTE VISIBLE en descendant la liste
          (sticky) : on coche souvent tout en bas, et remonter chercher le
          bouton fait perdre sa place. */}
      {selected.size > 0 ? (
        <form
          id="consultation-selection"
          method="post"
          action="/api/consultation/zip"
          className="bg-background border-primary sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 border px-3 py-2"
        >
          <input type="hidden" name="boutique" value={shop} />
          {[...selected].map((value) => (
            <input key={value} type="hidden" name="fiche" value={value} />
          ))}
          <span className="mr-2 text-sm font-medium">
            {selected.size} fiche{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
            {offscreen > 0 ? (
              <span className="text-muted-foreground font-normal"> · dont {offscreen} hors de cette recherche</span>
            ) : null}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setPanelOpen(true)}>
            <ListChecks aria-hidden="true" className="size-4" />
            Voir la sélection
          </Button>
          <Button type="submit" size="sm" disabled={tooMany}>
            Télécharger toutes ces fiches techniques
          </Button>
          {/* Meme selection, autre destination : le generateur de book la recoit
              dans son URL (GET), ou elle se recharge et se partage. */}
          <Button type="submit" variant="outline" size="sm" formAction="/consultation/book" formMethod="get" disabled={tooMany}>
            Book
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Tout désélectionner
          </Button>
          {canHide ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={hiding || tooMany}
              // Toute la selection, y compris ce qui a ete coche lors d'une
              // recherche precedente : la valeur porte la cle du produit.
              onClick={() => hide([...selected].flatMap((value) => parseSelection(value)?.productKey ?? []))}
            >
              <EyeOff aria-hidden="true" className="size-4" />
              Masquer ces fiches
            </Button>
          ) : null}
          {tooMany ? (
            <span role="alert" className="text-destructive text-sm">
              Au plus {max} fiches par archive : réduire la sélection.
            </span>
          ) : null}
        </form>
      ) : null}

      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 text-center">
                <Checkbox
                  aria-label="Tout sélectionner"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  disabled={selectable.length === 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Id</TableHead>
              <TableHead>Produit</TableHead>
              {showLocale ? <TableHead>Langue</TableHead> : null}
              <TableHead>Fiche</TableHead>
              <TableHead>Générée le</TableHead>
              {canHide ? (
                <TableHead>
                  <span className="sr-only">Masquer</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <Fragment key={row.value}>
                {grouped && (index === 0 || rows[index - 1].category !== row.category) ? (
                  <Divider
                    category={row.category}
                    count={rows.filter((other) => other.category === row.category).length}
                    icon={icons[row.category]}
                    state={groupState(row.category)}
                    columns={columns}
                    canEdit={canEditIcons}
                    onToggle={() => toggleGroup(row.category)}
                    onEditIcon={() => setEditing(row.category)}
                  />
                ) : null}
                <TableRow data-state={selected.has(row.value) ? "selected" : undefined}>
                  <TableCell className="w-9 text-center">
                    {row.url ? (
                      <Checkbox
                        aria-label={`Sélectionner ${row.productName}`}
                        checked={selected.has(row.value)}
                        onCheckedChange={() => toggle(row.value)}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <code className="text-muted-foreground font-mono text-xs">{row.productId}</code>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {row.productName}
                    {row.matchedRef ? (
                      <span className="text-muted-foreground block text-xs">
                        Réf. {row.matchedRef.kind} : <code className="font-mono">{row.matchedRef.ref}</code>
                      </span>
                    ) : null}
                  </TableCell>
                  {showLocale ? <TableCell>{row.locale}</TableCell> : null}
                  <TableCell>
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-foreground inline-flex"
                        title={`Ouvrir la fiche technique de ${row.productName}`}
                        aria-label={`Ouvrir la fiche technique de ${row.productName}`}
                      >
                        <PdfIcon />
                      </a>
                    ) : (
                      <Badge variant="outline">sans lien</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{row.renderedAt}</TableCell>
                  {canHide ? (
                    <TableCell className="w-10 text-right">
                      {/* Aussi pour une ligne « sans lien » : c'est souvent elle
                          qu'on veut retirer — une fiche qui n'existe pas encore. */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={hiding}
                        title={`Masquer ${row.productName}${showLocale ? " (toutes langues)" : ""}`}
                        aria-label={`Masquer ${row.productName}`}
                        onClick={() => hide([row.productKey])}
                      >
                        <EyeOff aria-hidden="true" className="size-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {hideError ? (
        <p role="alert" className="text-destructive mt-2 text-sm">
          Masquage impossible : {hideError}
        </p>
      ) : null}

      {iconError ? (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {iconError}
        </p>
      ) : null}

      <SelectionPanel
        open={panelOpen && selected.size > 0}
        onOpenChange={setPanelOpen}
        formId="consultation-selection"
        items={panelItems}
        max={max}
        onRemove={remove}
        onClear={() => {
          setSelected(new Set());
          setPanelOpen(false);
        }}
      />

      {importOpen ? (
        <ImportDialog
          shop={shop}
          locales={locales}
          onClose={() => setImportOpen(false)}
          onAddToSelection={addImported}
        />
      ) : null}

      {editing !== null ? (
        <IconPicker
          title={`Icône de « ${editing} »`}
          shop={shop}
          initial={icons[editing]?.ref}
          busy={saving}
          onChoose={saveIcon}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

/**
 * L'intercalaire d'une categorie : sa case, son icone, son nom, son effectif.
 *
 * Une ligne sur toute la largeur, en filet d'accent au-dessus : on lit une
 * section qui s'ouvre, pas une ligne de plus. Pas d'aplat de fond, qui
 * alourdirait une liste de quinze categories.
 */
function Divider({
  category,
  count,
  icon,
  state,
  columns,
  canEdit,
  onToggle,
  onEditIcon,
}: {
  category: string;
  count: number;
  icon: IconMarkup | undefined;
  state: { members: unknown[]; all: boolean; some: boolean };
  columns: number;
  canEdit: boolean;
  onToggle: () => void;
  onEditIcon: () => void;
}) {
  return (
    <TableRow className="border-t-primary border-t-2 hover:bg-transparent">
      <TableCell className="w-9 pt-4 text-center">
        <Checkbox
          aria-label={`Sélectionner toute la catégorie ${category}`}
          checked={state.all ? true : state.some ? "indeterminate" : false}
          disabled={state.members.length === 0}
          onCheckedChange={onToggle}
        />
      </TableCell>
      <TableCell colSpan={columns - 1} className="pt-4">
        <span className="inline-flex items-center gap-2 font-medium">
          {icon ? (
            canEdit ? (
              // Bouton nu et non Button : le SVG de l'icone arrive en HTML brut,
              // et Button force la taille de tout <svg> descendant a 16 px.
              <button
                type="button"
                className="text-primary hover:border-primary focus-visible:ring-ring/50 inline-flex cursor-pointer items-center justify-center border border-transparent p-0.5 outline-none focus-visible:ring-[3px]"
                title="Changer l'icône de cette catégorie"
                aria-label={`Changer l'icône de ${category}`}
                onClick={onEditIcon}
              >
                <IconView icon={icon} size={22} />
              </button>
            ) : (
              <span className="text-primary inline-flex items-center justify-center border border-transparent p-0.5">
                <IconView icon={icon} size={22} />
              </span>
            )
          ) : null}
          <span>{category}</span>
          <span className="text-muted-foreground text-sm font-normal">
            {count} fiche{count > 1 ? "s" : ""}
          </span>
        </span>
      </TableCell>
    </TableRow>
  );
}

function PdfIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="12" y="18" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor">
        PDF
      </text>
    </svg>
  );
}
