"use client";

import { Badge } from "@guillxume/ui/components/badge";
import { Button } from "@guillxume/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@guillxume/ui/components/sheet";
import { FileText, X } from "lucide-react";

/** Ce que le panneau sait d'une fiche cochee, meme hors de la recherche affichee. */
export type SelectedDetail = {
  name: string;
  productId: string;
  /** Categorie de niveau 1 ; vide si inconnue (selection anterieure au panneau). */
  category: string;
  locale: string;
  url: string | null;
};

export type SelectionItem = SelectedDetail & {
  value: string;
  /** Affichee dans la recherche courante. */
  shown: boolean;
};

/**
 * « Voir la selection » : la liste de ce qui est coche, toutes recherches
 * confondues, avec de quoi en retirer une fiche et lancer l'envoi.
 *
 * UN PANNEAU LATERAL ET NON UNE MODALE CENTREE. On le consulte comme un panier :
 * la liste reste visible derriere, et il tient deux cents fiches sans devenir
 * une fenetre a faire defiler dans une fenetre. Les actions sont en pied, pour
 * qu'on puisse relire puis envoyer sans revenir a la barre.
 *
 * LES BOUTONS D'ENVOI SOUMETTENT LE FORMULAIRE DE LA BARRE (`form=…`) : une
 * seule source pour les champs envoyes au zip et au book, et rien a garder
 * synchronise entre deux formulaires.
 *
 * Regroupee par categorie, comme le book qu'on s'apprete souvent a composer :
 * on y voit d'un coup d'oeil qu'une section est vide ou en double.
 */
export default function SelectionPanel({
  open,
  onOpenChange,
  formId,
  items,
  max,
  onRemove,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  items: SelectionItem[];
  max: number;
  onRemove: (value: string) => void;
  onClear: () => void;
}) {
  const tooMany = items.length > max;
  const showLocale = new Set(items.map((item) => item.locale)).size > 1;

  const groups = new Map<string, SelectionItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  // Ordre alphabetique, categorie inconnue en dernier ; les fiches par nom.
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")
  );
  for (const [, list] of ordered) list.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const clear = () => {
    // Une selection de quelques fiches se refait vite ; une de cinquante,
    // composee en plusieurs recherches, non.
    if (items.length > 5 && !window.confirm(`Retirer les ${items.length} fiches de la sélection ?`)) return;
    onClear();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ma sélection</SheetTitle>
          <SheetDescription>
            {items.length} fiche{items.length > 1 ? "s" : ""}, toutes recherches confondues. Gardée le temps de
            cette session, pour cette boutique.
          </SheetDescription>
          {tooMany ? (
            <p role="alert" className="text-destructive m-0 text-sm">
              Au plus {max} fiches par archive : en retirer {items.length - max}.
            </p>
          ) : null}
        </SheetHeader>

        <div className="-mt-4 min-h-0 flex-1 overflow-y-auto px-4">
          {ordered.map(([category, list]) => (
            <section key={category || "(inconnue)"} aria-label={category || "Catégorie inconnue"} className="pt-4">
              <h3 className="text-muted-foreground m-0 mb-1 flex items-baseline justify-between text-xs font-semibold tracking-wider uppercase">
                <span>{category || "Catégorie inconnue"}</span>
                <span className="font-normal tabular-nums normal-case">{list.length}</span>
              </h3>
              <ul className="m-0 list-none p-0">
                {list.map((item) => (
                  <li key={item.value} className="flex items-start gap-2 border-b py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm leading-5 font-medium break-words">{item.name}</p>
                      <p className="text-muted-foreground m-0 flex flex-wrap items-center gap-x-2 text-xs">
                        <code className="font-mono">{item.productId}</code>
                        {showLocale ? <Badge variant="outline">{item.locale}</Badge> : null}
                        {item.shown ? null : <span>hors de cette recherche</span>}
                      </p>
                    </div>
                    {item.url ? (
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Ouvrir la fiche technique de ${item.name}`}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Ouvrir la fiche technique de ${item.name}`}
                        >
                          <FileText aria-hidden="true" className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Retirer de la sélection"
                      aria-label={`Retirer ${item.name} de la sélection`}
                      onClick={() => onRemove(item.value)}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <SheetFooter>
          <Button type="submit" form={formId} disabled={tooMany}>
            Télécharger ces {items.length} fiche{items.length > 1 ? "s" : ""}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="submit"
              variant="outline"
              form={formId}
              formAction="/consultation/book"
              formMethod="get"
              disabled={tooMany}
            >
              Composer un book
            </Button>
            <Button type="button" variant="outline" onClick={clear}>
              Tout retirer
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
