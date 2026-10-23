"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Badge } from "@guillxume/ui/components/badge";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@guillxume/ui/components/card";
import { Checkbox } from "@guillxume/ui/components/checkbox";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { InputFile } from "@guillxume/ui/components/input-file";
import { Label } from "@guillxume/ui/components/label";
import { cn } from "@guillxume/ui/lib/utils";
import Dialog from "@/components/Dialog";
import { SECTION, THUMB, THUMB_EMPTY, THUMB_LARGE, TITLE } from "../bookStyles";
import UploadButton from "../UploadButton";

/** Les formats d'image que les pages dessinees acceptent. */
const IMAGES = "image/png,image/jpeg,image/webp";

export type SettingsPage = {
  id: string;
  kind: "couverture" | "quatrieme" | "intercalaire";
  title: string;
  categories: string[];
  image: string;
};

/**
 * Les pages fixes du book d'une boutique.
 *
 * CHAQUE ACTION RECHARGE LA PAGE : ce qui s'affiche est ce qui est en base, et
 * le book le posera tel quel. Un etat local qui divergerait (une categorie
 * retiree d'un autre intercalaire par l'API, par exemple) ferait croire a un
 * reglage qui n'existe pas.
 *
 * UN INTERCALAIRE N'EXISTE PAS SANS SON IMAGE : le formulaire de creation
 * l'exige, et l'API le refuse sans.
 *
 * PLUSIEURS COUVERTURES PAR BOUTIQUE (migration 016) : on les nomme pour les
 * reconnaitre en composant le book, et on les range — la premiere de la liste
 * est proposee par defaut.
 */
export default function BookSettings({
  shop,
  pages,
  categories,
}: {
  shop: string;
  pages: SettingsPage[];
  categories: { category: string; count: number }[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SettingsPage | null>(null);

  const dividers = pages.filter((page) => page.kind === "intercalaire");
  const covers = pages.filter((page) => page.kind === "couverture");
  const backs = pages.filter((page) => page.kind === "quatrieme");

  // Les categories des fiches, plus celles deja associees mais absentes de
  // l'index (renommees, ou pas encore generees) : elles doivent rester visibles
  // pour pouvoir etre retirees.
  const known = new Map(categories.map((item) => [item.category, item.count]));
  for (const divider of dividers) for (const category of divider.categories) if (!known.has(category)) known.set(category, 0);
  const allCategories = [...known.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  const owner = new Map<string, SettingsPage>();
  for (const divider of dividers) for (const category of divider.categories) owner.set(category, divider);

  const send = async (fields: Record<string, string | Blob>) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("boutique", shop);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    try {
      const response = await fetch("/api/book/pages", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  return (
    <div>
      {error ? (
        <Alert variant="destructive">
          <Icon icon={CircleAlert} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {(
        [
          ["couverture", "Premières de couverture", "Couverture", covers],
          ["quatrieme", "Quatrièmes de couverture", "Quatrième", backs],
        ] as const
      ).map(([kind, heading, noun, list]) => (
        <section key={kind} className={SECTION}>
          <h2 className={TITLE}>{heading}</h2>
          <p className="text-muted-foreground text-sm">
            Autant que nécessaire, une par usage (salon, grand compte…) : on choisit la sienne en composant le book.
            La première de la liste est proposée par défaut.
          </p>
          {list.length === 0 ? <p className="text-muted-foreground mt-2 text-sm">Aucune pour l&apos;instant.</p> : null}
          <ol className="my-3 list-none p-0">
            {list.map((page, index) => (
              <CoverRow
                key={page.id}
                page={page}
                fallback={`${noun} ${index + 1}`}
                first={index === 0}
                last={index === list.length - 1}
                busy={busy}
                onSave={(fields) => send({ action: "modifier", id: page.id, ...fields })}
                onMove={(direction) => send({ action: "deplacer", id: page.id, sens: String(direction) })}
                onDelete={() => setDeleting(page)}
              />
            ))}
          </ol>
          <NewCover noun={noun} busy={busy} onCreate={(fields) => send({ action: kind, ...fields })} />
        </section>
      ))}

      <section className={SECTION}>
        <h2 className={TITLE}>Intercalaires, dans l&apos;ordre du book</h2>
        <p className="text-muted-foreground text-sm">
          Un intercalaire ouvre les fiches des catégories qui lui sont associées. Une catégorie n&apos;a qu&apos;un
          intercalaire : l&apos;associer ici la retire de l&apos;autre. Les fiches d&apos;une catégorie sans
          intercalaire vont à la suite, sauf si on les range ailleurs en composant le book.
        </p>

        {dividers.length === 0 ? <p className="text-muted-foreground mt-2 text-sm">Aucun intercalaire pour l&apos;instant.</p> : null}

        <ol className="my-3 list-none p-0">
          {dividers.map((divider, index) => (
            <DividerRow
              key={divider.id}
              divider={divider}
              first={index === 0}
              last={index === dividers.length - 1}
              categories={allCategories}
              owner={owner}
              busy={busy}
              onSave={(fields) => send({ action: "modifier", id: divider.id, ...fields })}
              onMove={(direction) => send({ action: "deplacer", id: divider.id, sens: String(direction) })}
              onDelete={() => setDeleting(divider)}
            />
          ))}
        </ol>

        <NewDivider categories={allCategories} owner={owner} busy={busy} onCreate={(fields) => send({ action: "creer", ...fields })} />
      </section>

      {deleting ? (
        <Dialog
          title="Supprimer cette page"
          destructive
          confirmLabel="Supprimer"
          busy={busy}
          onConfirm={() => send({ action: "supprimer", id: deleting.id })}
          onCancel={() => setDeleting(null)}
        >
          <p>
            {deleting.kind === "intercalaire"
              ? `L'intercalaire « ${deleting.title} » et son image seront supprimés. Ses catégories iront « à la suite » dans les prochains books.`
              : `${deleting.title ? `« ${deleting.title} »` : "Cette couverture"} et son image seront supprimées : elle ne sera plus proposée pour les prochains books.`}
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}

/** Une couverture des reglages : son nom, son image, sa place dans la liste. */
function CoverRow({
  page,
  fallback,
  first,
  last,
  busy,
  onSave,
  onMove,
  onDelete,
}: {
  page: SettingsPage;
  fallback: string;
  first: boolean;
  last: boolean;
  busy: boolean;
  onSave: (fields: Record<string, string | Blob>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const titleId = useId();
  return (
    <li className="flex items-start gap-4 border-b py-3">
      <img src={page.image} alt="" className={cn(THUMB, THUMB_LARGE)} />
      <div className="grid min-w-0 flex-1 gap-3">
        <div className="grid max-w-96 gap-2">
          <Label htmlFor={titleId} className="flex items-center gap-2">
            Nom
            {first ? <Badge variant="outline">proposée par défaut</Badge> : null}
          </Label>
          <Input id={titleId} value={title} maxLength={120} placeholder={fallback} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || title.trim() === page.title}
            onClick={() => onSave({ titre: title.trim() })}
          >
            Enregistrer
          </Button>
          <UploadButton label="Remplacer l'image" accept={IMAGES} busy={busy} onFile={(file) => onSave({ image: file })} />
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Monter" disabled={busy || first} onClick={() => onMove(-1)}>
            <Icon icon={ArrowUp} size="sm" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Descendre" disabled={busy || last} onClick={() => onMove(1)}>
            <Icon icon={ArrowDown} size="sm" />
          </Button>
          <Button type="button" variant="outline" color="destructive" size="sm" disabled={busy} onClick={onDelete}>
            Supprimer
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Ajouter une couverture : un nom facultatif, l'image obligatoire. */
function NewCover({
  noun,
  busy,
  onCreate,
}: {
  noun: string;
  busy: boolean;
  onCreate: (fields: Record<string, string | Blob>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const titleId = useId();
  const imageId = useId();
  const what = noun === "Couverture" ? "une première de couverture" : "une quatrième de couverture";

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ajouter {what}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Ajouter {what}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid max-w-96 gap-2">
          <Label htmlFor={titleId}>Nom (facultatif)</Label>
          <Input id={titleId} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Salon 2026" />
        </div>
        <div className="grid max-w-96 gap-2">
          <Label htmlFor={imageId}>Image de la page (obligatoire)</Label>
          <InputFile
            id={imageId}
            accept="image/png,image/jpeg,image/webp"
            onFileAdded={async (file) => setImage(file)}
            onFileRemoved={async () => setImage(null)}
            labels={{
              chooseFile: "Choisir l'image de la page",
              clickToUpload: "Cliquer pour choisir",
              orDragAndDrop: "ou glisser-déposer",
              remove: "Retirer",
              retry: "Réessayer",
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={busy || image === null} onClick={() => image && onCreate({ titre: title.trim(), image })}>
            Ajouter
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Les categories en colonnes : une quinzaine, chacune avec son effectif. */
function CategoryChoice({
  categories,
  owner,
  self,
  value,
  onChange,
}: {
  categories: [string, number][];
  owner: Map<string, SettingsPage>;
  self: string | null;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  // Plusieurs listes sur la page (une par intercalaire, plus la creation) :
  // les id des cases doivent rester uniques.
  const base = useId();
  return (
    <fieldset className="columns-[2_18rem] gap-x-6 border px-3 py-2">
      <legend className="text-muted-foreground px-1 font-mono text-xs tracking-wider uppercase">
        Catégories associées
      </legend>
      {categories.map(([category, count], index) => {
        const other = owner.get(category);
        const id = `${base}-${index}`;
        return (
          <div key={category} className="flex break-inside-avoid items-center gap-2 py-0.5">
            <Checkbox
              id={id}
              checked={value.includes(category)}
              onCheckedChange={(checked) =>
                onChange(checked === true ? [...value, category] : value.filter((item) => item !== category))
              }
            />
            <Label htmlFor={id} className="inline cursor-pointer font-normal leading-normal">
              {category} <span className="text-muted-foreground">({count})</span>
              {other && other.id !== self && !value.includes(category) ? (
                <span className="text-primary text-xs"> → {other.title}</span>
              ) : null}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}

function DividerRow({
  divider,
  first,
  last,
  categories,
  owner,
  busy,
  onSave,
  onMove,
  onDelete,
}: {
  divider: SettingsPage;
  first: boolean;
  last: boolean;
  categories: [string, number][];
  owner: Map<string, SettingsPage>;
  busy: boolean;
  onSave: (fields: Record<string, string | Blob>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(divider.title);
  const [chosen, setChosen] = useState(divider.categories);
  const changed = title.trim() !== divider.title || chosen.join("|") !== divider.categories.join("|");
  const titleId = useId();

  return (
    // items-start et non l'etirement par defaut : la vignette prenait la
    // hauteur de la liste des categories, et object-cover n'en montrait plus
    // qu'une tranche — l'intercalaire paraissait coupe.
    <li className="flex items-start gap-4 border-b py-3">
      <img src={divider.image} alt="" className={cn(THUMB, THUMB_LARGE)} />
      <div className="grid min-w-0 flex-1 gap-3">
        <div className="grid max-w-96 gap-2">
          <Label htmlFor={titleId}>Titre</Label>
          <Input id={titleId} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <CategoryChoice categories={categories} owner={owner} self={divider.id} value={chosen} onChange={setChosen} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !changed || title.trim() === ""}
            onClick={() => onSave({ titre: title.trim(), categories: JSON.stringify(chosen) })}
          >
            Enregistrer
          </Button>
          <UploadButton label="Remplacer l'image" accept={IMAGES} busy={busy} onFile={(file) => onSave({ image: file })} />
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Monter" disabled={busy || first} onClick={() => onMove(-1)}>
            <Icon icon={ArrowUp} size="sm" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Descendre" disabled={busy || last} onClick={() => onMove(1)}>
            <Icon icon={ArrowDown} size="sm" />
          </Button>
          <Button type="button" variant="outline" color="destructive" size="sm" disabled={busy} onClick={onDelete}>
            Supprimer
          </Button>
        </div>
      </div>
    </li>
  );
}

function NewDivider({
  categories,
  owner,
  busy,
  onCreate,
}: {
  categories: [string, number][];
  owner: Map<string, SettingsPage>;
  busy: boolean;
  onCreate: (fields: Record<string, string | Blob>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const titleId = useId();
  const imageId = useId();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Nouvel intercalaire
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Nouvel intercalaire</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid max-w-96 gap-2">
          <Label htmlFor={titleId}>Titre</Label>
          <Input id={titleId} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Bureaux" />
        </div>
        <div className="grid max-w-96 gap-2">
          <Label htmlFor={imageId}>Image de la page (obligatoire)</Label>
          {/* Rien n'est envoye au choix du fichier : l'image part avec « Creer ».
              onFileAdded ne fait que la retenir, onFileRemoved l'oublie. */}
          <InputFile
            id={imageId}
            accept="image/png,image/jpeg,image/webp"
            onFileAdded={async (file) => setImage(file)}
            onFileRemoved={async () => setImage(null)}
            labels={{
              chooseFile: "Choisir l'image de la page",
              clickToUpload: "Cliquer pour choisir",
              orDragAndDrop: "ou glisser-déposer",
              remove: "Retirer",
              retry: "Réessayer",
            }}
          />
        </div>
        <CategoryChoice categories={categories} owner={owner} self={null} value={chosen} onChange={setChosen} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={busy || title.trim() === "" || image === null}
            onClick={() => image && onCreate({ titre: title.trim(), categories: JSON.stringify(chosen), image })}
          >
            Créer
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
