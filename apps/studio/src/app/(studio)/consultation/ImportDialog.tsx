"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@guillxume/ui/components/dialog";
import { Icon } from "@guillxume/ui/components/icon";
import { Label } from "@guillxume/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import { Textarea } from "@guillxume/ui/components/textarea";
import { MAX_IMPORT_CHARS, type ImportReport, type ImportedFiche } from "@/lib/bookImport";

type Result = ImportReport & { locale: string; indexedWithSupplierRefs: number; max: number };

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/**
 * « Import produits » : coller un devis, un bloc de tableur, un courriel, et en
 * tirer les fiches d'un book — sans avoir rien coche.
 *
 * DEUX TEMPS DANS LA MEME FENETRE. On colle, puis on LIT le rapport avant
 * d'agir : ce qui a ete trouve, ce qui est ambigu, et surtout les lignes ou
 * aucune reference n'a ete reconnue — c'est la qu'un produit manquerait au book
 * sans que rien d'autre ne le dise. « Modifier le collage » revient au texte,
 * intact.
 *
 * DEUX SORTIES. « Creer le book » part avec les seules fiches importees ;
 * « Ajouter a la selection » les melange a ce qui est deja coche, pour un book
 * compose a moitie a la main.
 */
export default function ImportDialog({
  shop,
  locales,
  onClose,
  onAddToSelection,
}: {
  shop: string;
  /** Les langues de l'index, la plus fournie d'abord : on ne choisit que s'il y en a plusieurs. */
  locales: string[];
  onClose: () => void;
  onAddToSelection: (fiches: ImportedFiche[]) => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [locale, setLocale] = useState(locales[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const search = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/consultation/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boutique: shop, texte: text, langue: locale }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      setResult(data as Result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const fiches = result?.fiches ?? [];
  const tooMany = result !== null && fiches.length > result.max;

  const createBook = () => {
    const params = new URLSearchParams({ boutique: shop });
    for (const fiche of fiches) params.append("fiche", fiche.value);
    router.push(`/consultation/book?${params.toString()}`);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import produits</DialogTitle>
          <DialogDescription>
            Collez les lignes d&apos;un devis, d&apos;un tableau ou d&apos;un courriel, telles quelles : nom,
            quantité, prix, peu importe. Seules les <strong>références fournisseur</strong> sont reconnues, et
            chacune amène la fiche de son produit. Un <strong>package</strong> (plateau, piètement…) est reconnu
            quand toutes ses références figurent dans le collage.
          </DialogDescription>
        </DialogHeader>

        {result === null ? (
          <div className="grid gap-3">
            <Textarea
              aria-label="Lignes à importer"
              className="min-h-56 font-mono text-xs"
              rows={12}
              autoFocus
              maxLength={MAX_IMPORT_CHARS}
              placeholder={"Bureau droit PURE WIST\t109423\t2\t349,00 €\nVestiaire 2 portes\tFRN-88231\t1\t412,00 €"}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            {locales.length > 1 ? (
              <div className="grid max-w-48 gap-2">
                <Label htmlFor="import-langue">Langue des fiches</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger id="import-langue">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locales.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : (
          <ImportResult result={result} />
        )}

        {error ? (
          <Alert variant="destructive">
            <Icon icon={CircleAlert} />
            <AlertDescription>Recherche impossible : {error}</AlertDescription>
          </Alert>
        ) : null}
        {tooMany ? (
          <p role="alert" className="text-destructive text-sm">
            Au plus {result?.max} fiches par book : réduire le collage.
          </p>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          {result === null ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Annuler
              </Button>
              <Button type="button" onClick={search} disabled={busy || text.trim() === ""}>
                {busy ? "Recherche…" : "Rechercher les fiches"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setResult(null)}>
                Modifier le collage
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={fiches.length === 0}
                onClick={() => {
                  onAddToSelection(fiches);
                  onClose();
                }}
              >
                Ajouter à la sélection
              </Button>
              <Button type="button" disabled={fiches.length === 0 || tooMany} onClick={createBook}>
                Créer le book avec {plural(fiches.length, "fiche")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Le rapport : d'abord ce qui demande un regard (index vide, ambiguites, fiches
 * sans adresse, lignes non reconnues), puis la liste de ce qui entrera dans le
 * book, avec la reference et la ligne qui l'ont fait venir.
 */
function ImportResult({ result }: { result: Result }) {
  const { fiches, ambiguous, withoutLink, included, unmatched, lineCount } = result;

  return (
    <div className="grid gap-3 text-sm">
      <p>
        <strong>{plural(fiches.length, "fiche")}</strong> trouvée{fiches.length > 1 ? "s" : ""} sur{" "}
        {plural(lineCount, "ligne")} lue{lineCount > 1 ? "s" : ""}.
      </p>

      {result.indexedWithSupplierRefs === 0 ? (
        <Alert variant="warning">
          <Icon icon={TriangleAlert} />
          <AlertDescription>
            Aucune fiche de cette boutique ne porte encore de référence fournisseur. Elles arrivent avec le module
            de la boutique, à la régénération des fiches : tant qu&apos;elle n&apos;a pas eu lieu, l&apos;import ne
            peut rien reconnaître.
          </AlertDescription>
        </Alert>
      ) : null}

      {ambiguous.length > 0 ? (
        <Alert variant="warning">
          <Icon icon={TriangleAlert} />
          <AlertDescription>
            <p>
              {ambiguous.length > 1 ? "Ces références désignent" : "Cette référence désigne"} plusieurs produits :
              tous ont été ajoutés, à retirer dans le book au besoin.
            </p>
            <ul className="list-disc pl-5">
              {ambiguous.map((item) => (
                <li key={`${item.line}-${item.ref}`}>
                  Ligne {item.line} — <code className="font-mono">{item.ref}</code> : {item.names.join(", ")}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {withoutLink.length > 0 ? (
        <Alert variant="warning">
          <Icon icon={TriangleAlert} />
          <AlertDescription>
            <p>
              Reconnue{withoutLink.length > 1 ? "s" : ""}, mais sans adresse de fiche transmise par la boutique :{" "}
              {withoutLink.length > 1 ? "elles ne peuvent pas" : "elle ne peut pas"} entrer dans un book.
            </p>
            <ul className="list-disc pl-5">
              {withoutLink.map((item) => (
                <li key={`${item.line}-${item.ref}`}>
                  Ligne {item.line} — <code className="font-mono">{item.ref}</code> : {item.name}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {included.length > 0 ? (
        <details className="border-border border px-3 py-2">
          <summary className="cursor-pointer font-medium">
            {plural(included.length, "produit")} écarté{included.length > 1 ? "s" : ""} : compris dans un package
            plus grand du collage
          </summary>
          <p className="text-muted-foreground mt-2">
            Des pieds ou une serrure vendus seuls ont leur propre fiche, mais ici ils font partie d&apos;un
            ensemble. Si le devis les vend vraiment à part, les ajouter à la main.
          </p>
          <ul className="mt-2 grid gap-1">
            {included.map((item) => (
              <li key={item.value}>
                {item.name}{" "}
                <code className="text-muted-foreground font-mono text-xs break-all">{item.refs.join(", ")}</code>{" "}
                <span className="text-muted-foreground">— dans {item.within}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {unmatched.length > 0 ? (
        <details className="border-border border px-3 py-2" open={fiches.length === 0}>
          <summary className="cursor-pointer font-medium">
            {plural(unmatched.length, "ligne")} sans référence fournisseur reconnue
          </summary>
          <p className="text-muted-foreground mt-2">
            Un en-tête ou un total y figure souvent ; un produit aussi, si sa référence fournisseur est inconnue du
            Studio, mal saisie, ou si son package n&apos;est pas complet.
          </p>
          <ul className="mt-2 grid gap-1">
            {unmatched.map((item) => (
              <li key={item.line} className="flex gap-3">
                <span className="text-muted-foreground w-14 shrink-0 tabular-nums">l. {item.line}</span>
                <span className="grid min-w-0 gap-0.5">
                  <code className="font-mono text-xs break-all whitespace-pre-wrap">{item.text}</code>
                  {item.partial ? (
                    // Presque toujours une reference oubliee ailleurs dans le devis :
                    // le dire evite de chercher la faute sur CETTE ligne.
                    <span className="text-muted-foreground text-xs">
                      <code className="font-mono">{item.partial.parts.join(", ")}</code> :{" "}
                      {item.partial.parts.length > 1 ? "références" : "référence"} de{" "}
                      {plural(item.partial.packages, "package")}, dont aucun n&apos;est complet dans le collage.
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {fiches.length > 0 ? (
        <ul className="border-border divide-border max-h-72 divide-y overflow-y-auto border">
          {fiches.map((fiche) => (
            <li key={fiche.value} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5">
              <span className="min-w-0 flex-1">{fiche.name}</span>
              <code className="text-muted-foreground font-mono text-xs break-all">{fiche.refs.join(", ")}</code>
              <span className="text-muted-foreground w-24 text-right text-xs tabular-nums">
                {fiche.lines.length > 1 ? "lignes" : "ligne"} {fiche.lines.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
