"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, FileText, GripVertical, TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Badge } from "@guillxume/ui/components/badge";
import { Button } from "@guillxume/ui/components/button";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import { RadioCardGroup, RadioCardGroupItem } from "@guillxume/ui/components/radio-card-group";
import { Switch } from "@guillxume/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import { cn } from "@guillxume/ui/lib/utils";
import { SECTION, THUMB, THUMB_EMPTY, TITLE } from "./bookStyles";
import UploadButton from "./UploadButton";
import { quoteProblem } from "@/lib/bookQuote";
import {
  bookSections,
  initialGroups,
  moveToGroup,
  removeFiche,
  reorderInGroup,
  type Group,
  type GroupedFiche,
} from "@/lib/bookGroups";

export type BookDivider = { id: string; title: string; categories: string[]; image: string };
/** Une premiere ou quatrieme de couverture proposee ; `title` vide : sans nom. */
export type BookCover = { id: string; title: string; image: string };
/** Le devis par reference ERP : disponible, sans entite pour cette boutique, ou ERP non configure. */
export type ErpAvailability = "pret" | "sans-entite" | "absent";

/** Les statuts d'une proposition commerciale Dolibarr. */
const QUOTE_STATUS: Record<number, string> = { 0: "brouillon", 1: "validé", 2: "signé", 3: "non signé", 4: "facturé" };

const LINK = "text-primary underline underline-offset-4";

/**
 * Le generateur de book.
 *
 * COUVERTURES ET INTERCALAIRES SONT DESSINES A PART et poses dans les reglages
 * du book (super-administrateur). Ce qui se choisit ici :
 *
 *   - la premiere et la quatrieme de couverture, parmi celles de la boutique,
 *     ou aucune (la premiere de la liste est proposee) ;
 *   - le sommaire, coche par defaut : sections, fiches et devis avec leur page,
 *     lignes cliquables, et des signets dans le PDF (src/lib/bookToc.ts) ;
 *   - imprimer ou non l'intercalaire de CHAQUE section : trois fiches d'une
 *     categorie n'ont pas besoin d'une page de garde. La section garde sa place
 *     et l'ordre de ses fiches, seule la page saute. « Tous » et « Aucun »
 *     reglent toutes les sections d'un coup ;
 *   - l'ordre des fiches dans chaque section (glisser-deposer, ou fleches pour
 *     le clavier) ;
 *   - la section d'une fiche : chacune arrive sous l'intercalaire de sa
 *     categorie, et peut passer sous la banniere d'un autre — c'est ainsi
 *     qu'une fiche de « Meuble d'accueil », sans intercalaire, rejoint
 *     « Accessoires » ;
 *   - les fiches sans intercalaire restent « a la suite », apres la derniere
 *     section ;
 *   - le devis du client, un PDF place avant la quatrieme de couverture :
 *     televerse, ou recupere dans l'ERP par sa reference quand le Studio connait
 *     l'ERP et l'entite de la boutique (src/lib/erpQuote.ts). Dans les deux cas
 *     c'est un fichier que l'onglet garde, tant qu'il est ouvert, pour regenerer
 *     sans le choisir a nouveau ; le Studio ne le conserve pas.
 *
 * L'ordre des sections est celui des intercalaires, fixe lui aussi.
 *
 * LA GENERATION PASSE PAR fetch : il faut lire les en-tetes de la reponse pour
 * dire quelles fiches ont ete remplacees par une page « indisponible ». En
 * multipart, pour joindre le devis : la demande en JSON dans `spec`.
 */
export default function BookEditor({
  shop,
  fiches,
  dividers,
  covers,
  backs,
  max,
  ignored,
  canConfigure,
  erp = "absent",
}: {
  shop: string;
  fiches: GroupedFiche[];
  dividers: BookDivider[];
  covers: BookCover[];
  backs: BookCover[];
  max: number;
  ignored: number;
  canConfigure: boolean;
  erp?: ErpAvailability;
}) {
  const [groups, setGroups] = useState<Group[]>(() => initialGroups(fiches, dividers));
  const [dragging, setDragging] = useState<{ group: string | null; index: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ missing: string[]; toc: string } | null>(null);
  const [toc, setToc] = useState(true);
  const [cover, setCover] = useState<string | null>(covers[0]?.id ?? null);
  const [back, setBack] = useState<string | null>(backs[0]?.id ?? null);
  // Les intercalaires a NE PAS imprimer : vide par defaut, tous s'impriment.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [quote, setQuote] = useState<File | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  // D'ou vient le devis joint, quand c'est l'ERP : ce qu'on en montre.
  const [quoteOrigin, setQuoteOrigin] = useState<{ ref: string; date: string; status: number | null; entity: string } | null>(null);
  const [quoteRef, setQuoteRef] = useState("");
  const [fetching, setFetching] = useState(false);

  /**
   * Le meme controle que la route, des le choix : un mauvais fichier ne part
   * pas. Changer de devis efface le resultat de la tentative precedente — son
   * erreur parlait de l'ancien fichier.
   */
  const changeQuote = (file: File | null, origin: typeof quoteOrigin = null) => {
    setQuote(file);
    setQuoteOrigin(origin);
    setError(null);
    setReport(null);
  };
  const chooseQuote = async (file: File, origin: typeof quoteOrigin = null): Promise<void> => {
    const problem = quoteProblem(file.size, new Uint8Array(await file.slice(0, 4).arrayBuffer()));
    setQuoteError(problem);
    if (!problem) changeQuote(file, origin);
  };

  /**
   * Le devis par sa reference : l'ERP le rend en PDF, la page en fait un
   * fichier, et la suite est celle d'un PDF choisi sur le disque.
   */
  const fetchQuote = async () => {
    setFetching(true);
    setQuoteError(null);
    try {
      const response = await fetch("/api/book/devis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boutique: shop, reference: quoteRef }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Echec (HTTP ${response.status}).`);
      }
      const ref = decodeURIComponent(response.headers.get("x-devis-ref") ?? quoteRef.trim());
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `devis-${ref}.pdf`;
      const status = response.headers.get("x-devis-statut");
      const file = new File([await response.blob()], name, { type: "application/pdf" });
      await chooseQuote(file, {
        ref,
        date: response.headers.get("x-devis-date") ?? "",
        status: status === null || status === "" ? null : Number(status),
        entity: response.headers.get("x-devis-entite") ?? "",
      });
      setQuoteRef("");
    } catch (cause) {
      setQuoteError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setFetching(false);
    }
  };
  const settingsLink = canConfigure ? `/consultation/book/reglages?boutique=${encodeURIComponent(shop)}` : null;

  const count = groups.reduce((total, group) => total + group.fiches.length, 0);
  const dividerOf = (id: string | null) => dividers.find((divider) => divider.id === id);
  // Les intercalaires qui ouvriront reellement une section de ce book.
  const used = groups.flatMap((group) => (group.dividerId !== null && group.fiches.length > 0 ? [group.dividerId] : []));
  const printed = used.filter((id) => !skipped.has(id)).length;
  const togglePrint = (id: string, print: boolean) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (print) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const body = new FormData();
      body.append("spec", JSON.stringify({ boutique: shop, sections: bookSections(groups, skipped), cover, back, toc }));
      if (quote) body.append("devis", quote, quote.name);
      const response = await fetch("/api/book", { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Echec (HTTP ${response.status}).`);
      }
      const missing = JSON.parse(decodeURIComponent(response.headers.get("x-book-missing-detail") ?? "%5B%5D")) as string[];
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "book.pdf";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
      setReport({ missing, toc: response.headers.get("x-book-toc") ?? "absent" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-muted-foreground text-sm">
        {count} fiche{count > 1 ? "s" : ""}.
        {ignored > 0 ? ` ${ignored} fiche${ignored > 1 ? "s" : ""} sans adresse ignorée${ignored > 1 ? "s" : ""}.` : ""}{" "}
        <a href={`/consultation?boutique=${encodeURIComponent(shop)}`} className={LINK}>
          Revenir à la consultation
        </a>
        {canConfigure ? (
          <>
            {" · "}
            <a href={`/consultation/book/reglages?boutique=${encodeURIComponent(shop)}`} className={LINK}>
              Couvertures et intercalaires
            </a>
          </>
        ) : null}
      </p>

      <CoverChoice label="Première de couverture" noun="Couverture" options={covers} value={cover} onChange={setCover} settingsLink={settingsLink} />

      <section className={cn(SECTION, "flex flex-wrap items-center gap-3")}>
        <div className="min-w-0 flex-1">
          <h2 className={TITLE}>Sommaire</h2>
          <p className="text-muted-foreground text-sm">
            Après la couverture : chaque section, chaque fiche et le devis, avec leur page. On clique sur une ligne
            pour y aller, et le PDF s&apos;ouvre avec ses signets.
          </p>
        </div>
        <span className="flex items-center gap-2">
          <Switch id="book-sommaire" checked={toc} onCheckedChange={setToc} />
          <Label htmlFor="book-sommaire" className="cursor-pointer text-sm font-normal">
            Sommaire imprimé
          </Label>
        </span>
      </section>

      {used.length > 0 ? (
        <section className={cn(SECTION, "flex flex-wrap items-center gap-3")}>
          <div className="min-w-0 flex-1">
            <h2 className={TITLE}>Intercalaires</h2>
            <p className="text-muted-foreground text-sm">
              {printed} sur {used.length} imprimé{printed > 1 ? "s" : ""}. Chaque section se règle à part : une
              catégorie de trois fiches n&apos;a pas toujours besoin de sa page.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={printed === used.length} onClick={() => setSkipped(new Set())}>
            Tous
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={printed === 0} onClick={() => setSkipped(new Set(used))}>
            Aucun
          </Button>
        </section>
      ) : null}

      {groups.map((group) => {
        const divider = dividerOf(group.dividerId);
        if (group.fiches.length === 0) return null;
        return (
          <section key={group.dividerId ?? "suite"} className={SECTION}>
            {divider ? (
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <img src={divider.image} alt="" className={cn(THUMB, skipped.has(divider.id) && "opacity-30")} />
                <div className="min-w-0 flex-1">
                  <h2 className={TITLE}>{divider.title}</h2>
                  <p className="text-muted-foreground text-sm">
                    {group.fiches.length} fiche{group.fiches.length > 1 ? "s" : ""} ·{" "}
                    {divider.categories.join(", ") || "aucune catégorie associée"}
                    {skipped.has(divider.id) ? " · intercalaire non imprimé : ses fiches s’enchaînent sans page de garde" : ""}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <Switch
                    id={`intercalaire-${divider.id}`}
                    checked={!skipped.has(divider.id)}
                    onCheckedChange={(print) => togglePrint(divider.id, print)}
                  />
                  <Label htmlFor={`intercalaire-${divider.id}`} className="cursor-pointer text-sm font-normal">
                    Intercalaire imprimé
                  </Label>
                </span>
              </div>
            ) : (
              <div className="mb-2 flex items-center gap-3">
                <div>
                  <h2 className={TITLE}>À la suite, sans intercalaire</h2>
                  <p className="text-muted-foreground text-sm">
                    Fiches dont la catégorie n&apos;a pas d&apos;intercalaire : elles suivent la dernière section. Les
                    ranger sous un intercalaire avec « Déplacer sous ».
                  </p>
                </div>
              </div>
            )}

            <ol className="m-0 list-none p-0">
              {group.fiches.map((fiche, index) => (
                <li
                  key={fiche.value}
                  className={cn(
                    "bg-background flex items-center gap-2 border-b px-2 py-1",
                    dragging?.group === group.dividerId && dragging.index === index && "opacity-40",
                  )}
                  draggable
                  onDragStart={() => setDragging({ group: group.dividerId, index })}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    // Glisser-deposer DANS une section ; pour en changer, le menu.
                    if (dragging && dragging.group === group.dividerId) {
                      setGroups((current) => reorderInGroup(current, group.dividerId, dragging.index, index));
                    }
                    setDragging(null);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  <span
                    className="text-muted-foreground inline-flex cursor-grab select-none"
                    aria-hidden="true"
                    title="Glisser pour déplacer dans la section"
                  >
                    <Icon icon={GripVertical} size="sm" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <Badge variant="outline" className="border-primary text-primary font-mono text-[0.65rem]">
                      PDF
                    </Badge>
                    <code className="text-muted-foreground font-mono text-xs">{fiche.productId}</code> {fiche.name}
                    <span className="text-muted-foreground ml-auto text-right text-xs">{fiche.category}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {/* Une liste d'ACTION, pas un champ : sa valeur reste vide, le
                        choix deplace la fiche et le texte d'attente revient. */}
                    <Select
                      value=""
                      onValueChange={(target) =>
                        setGroups((current) => moveToGroup(current, fiche.value, target === "suite" ? null : target))
                      }
                    >
                      <SelectTrigger size="sm" className="max-w-56" aria-label={`Déplacer ${fiche.name} sous un autre intercalaire`}>
                        <SelectValue placeholder="Déplacer sous…" />
                      </SelectTrigger>
                      <SelectContent>
                        {dividers
                          .filter((item) => item.id !== group.dividerId)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.title}
                            </SelectItem>
                          ))}
                        {group.dividerId !== null ? (
                          <SelectItem value="suite">À la suite, sans intercalaire</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="Monter"
                      disabled={index === 0}
                      onClick={() => setGroups((current) => reorderInGroup(current, group.dividerId, index, index - 1))}
                    >
                      <Icon icon={ArrowUp} size="sm" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="Descendre"
                      disabled={index === group.fiches.length - 1}
                      onClick={() => setGroups((current) => reorderInGroup(current, group.dividerId, index, index + 1))}
                    >
                      <Icon icon={ArrowDown} size="sm" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="Retirer du book"
                      onClick={() => setGroups((current) => removeFiche(current, fiche.value))}
                    >
                      <Icon icon={X} size="sm" />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section className={SECTION}>
        <h2 className={TITLE}>Devis client</h2>
        <p className="text-muted-foreground text-sm">
          Un PDF, placé à la fin du book, avant la quatrième de couverture
          {erp === "pret" ? " : récupéré dans l’ERP par sa référence, ou joint depuis votre poste" : ""}. Le Studio ne
          le conserve pas : il part avec ce book, et reste joint tant que cette page est ouverte.
        </p>
        {quote ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm">
              <Icon icon={FileText} size="sm" className="text-primary shrink-0" />
              <span className="truncate">{quote.name}</span>
              <span className="text-muted-foreground whitespace-nowrap tabular-nums">{formatSize(quote.size)}</span>
            </span>
            {quoteOrigin ? (
              <span className="text-muted-foreground text-sm">
                ERP · {quoteOrigin.ref}
                {quoteOrigin.entity ? ` · entité ${quoteOrigin.entity}` : ""}
                {quoteOrigin.date ? ` · ${new Date(`${quoteOrigin.date}T12:00:00`).toLocaleDateString("fr-FR")}` : ""}
                {quoteOrigin.status !== null ? ` · ${QUOTE_STATUS[quoteOrigin.status] ?? `statut ${quoteOrigin.status}`}` : ""}
              </span>
            ) : null}
            <UploadButton label="Remplacer par un PDF" accept="application/pdf,.pdf" busy={busy} onFile={(file) => chooseQuote(file)} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => changeQuote(null)}>
              Retirer
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-3">
            {erp === "pret" ? (
              <>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void fetchQuote();
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="devis-reference" className="text-sm font-normal">
                      Référence du devis dans l&apos;ERP
                    </Label>
                    <Input
                      id="devis-reference"
                      className="h-8 w-48 font-mono"
                      placeholder="D-MA-051341"
                      value={quoteRef}
                      disabled={busy || fetching}
                      onChange={(event) => setQuoteRef(event.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm" disabled={busy || fetching || quoteRef.trim() === ""}>
                    {fetching ? "Récupération…" : "Récupérer"}
                  </Button>
                </form>
                <span className="text-muted-foreground pb-1.5 text-sm">ou</span>
              </>
            ) : null}
            <UploadButton label="Joindre un PDF" accept="application/pdf,.pdf" busy={busy || fetching} onFile={(file) => chooseQuote(file)} />
          </div>
        )}
        {quote && quoteOrigin?.status === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Devis en brouillon : son PDF est celui de la dernière génération dans l&apos;ERP, peut-être antérieur à
            ses dernières modifications.
          </p>
        ) : null}
        {!quote && erp === "sans-entite" ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Pour récupérer un devis par sa référence, l&apos;entité ERP de cette boutique doit être renseignée
            (Administration › Boutiques).
          </p>
        ) : null}
        {quoteError ? (
          <p role="alert" className="text-destructive mt-2 text-sm">
            {quoteError}
          </p>
        ) : null}
      </section>

      <CoverChoice label="Quatrième de couverture" noun="Quatrième" options={backs} value={back} onChange={setBack} settingsLink={settingsLink} />

      <section className={cn(SECTION, "grid justify-items-start gap-3")}>
        <Button type="button" size="lg" disabled={count === 0 || count > max || busy} onClick={generate}>
          {busy ? "Composition du book…" : "Générer le book"}
        </Button>
        {busy ? (
          <p className="text-muted-foreground text-sm">
            Le Studio télécharge {count} fiche{count > 1 ? "s" : ""} auprès de la boutique{quote ? ", vérifie le devis" : ""}{" "}
            et assemble le document : compter quelques secondes par dizaine de fiches.
          </p>
        ) : null}
        {count > max ? (
          <p role="alert" className="text-destructive text-sm">
            Au plus {max} fiches par book.
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <Icon icon={CircleAlert} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {report && (report.toc === "sans-liens" || report.toc === "impossible") ? (
          <Alert variant="warning">
            <Icon icon={TriangleAlert} />
            <AlertDescription>
              {report.toc === "sans-liens"
                ? "Le sommaire est imprimé avec ses numéros de page, mais ses lignes ne sont pas cliquables cette fois-ci."
                : "Le sommaire n'a pas pu être composé : le nombre de pages d'une fiche n'a pas pu être lu. Le book est complet, sans sommaire."}
            </AlertDescription>
          </Alert>
        ) : null}
        {report ? (
          report.missing.length === 0 ? (
            <Alert variant="success">
              <Icon icon={CircleCheck} />
              <AlertDescription>Book téléchargé.</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <Icon icon={TriangleAlert} />
              <AlertDescription>
                <p>
                  Book téléchargé, mais {report.missing.length} fiche{report.missing.length > 1 ? "s" : ""}{" "}
                  n&apos;{report.missing.length > 1 ? "ont" : "a"} pas pu être récupérée{report.missing.length > 1 ? "s" : ""}{" "}
                  — remplacée{report.missing.length > 1 ? "s" : ""} par une page « fiche indisponible » :
                </p>
                <ul className="list-disc pl-5">
                  {report.missing.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )
        ) : null}
      </section>
    </div>
  );
}

/**
 * Le choix d'une couverture : une vignette par page proposee, plus « Aucune ».
 * Des cartes et non une liste deroulante : on choisit une couverture en la
 * VOYANT, et il y en a rarement plus d'une poignee.
 */
function CoverChoice({
  label,
  noun,
  options,
  value,
  onChange,
  settingsLink,
}: {
  label: string;
  /** Pour nommer une couverture sans nom : « Couverture 2 ». */
  noun: string;
  options: BookCover[];
  value: string | null;
  onChange: (id: string | null) => void;
  settingsLink: string | null;
}) {
  return (
    <section className={SECTION}>
      <h2 className={TITLE}>{label}</h2>
      {options.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune n&apos;est configurée pour cette boutique
          {settingsLink ? (
            <>
              {" — "}
              <a href={settingsLink} className={LINK}>
                en ajouter une
              </a>
            </>
          ) : null}
          .
        </p>
      ) : (
        <RadioCardGroup
          aria-label={label}
          value={value ?? AUCUNE}
          onValueChange={(next) => onChange(next === AUCUNE ? null : next)}
          className="mt-2 flex flex-wrap gap-3"
        >
          {options.map((option, index) => (
            <RadioCardGroupItem key={option.id} value={option.id} className="w-28 gap-1.5 p-2">
              <img src={option.image} alt="" className={cn(THUMB, "w-full")} />
              <span className="line-clamp-2 text-xs leading-4">{option.title || `${noun} ${index + 1}`}</span>
            </RadioCardGroupItem>
          ))}
          <RadioCardGroupItem value={AUCUNE} className="w-28 gap-1.5 p-2">
            <span className={cn(THUMB, THUMB_EMPTY, "w-full")} aria-hidden="true" />
            <span className="text-xs leading-4">Aucune</span>
          </RadioCardGroupItem>
        </RadioCardGroup>
      )}
    </section>
  );
}

/** Valeur du choix « pas de couverture » : un identifiant de page est un UUID, jamais ce mot. */
const AUCUNE = "aucune";

/** « 184 ko », « 2,4 Mo » : ce qu'on lit d'un coup d'oeil a cote d'un nom de fichier. */
function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} ko`
    : `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
