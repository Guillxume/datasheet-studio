"use client";

import { Button } from "@guillxume/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@guillxume/ui/components/dialog";
import { Input } from "@guillxume/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@guillxume/ui/components/tabs";
import { Toggle } from "@guillxume/ui/components/toggle";
import { useEffect, useState } from "react";

import type { IconMarkup } from "@/lib/iconTypes";

export type { IconMarkup };

/**
 * Affiche une icone deja resolue.
 *
 * Le SVG vient du serveur (src/lib/icons.ts), construit depuis le jeu Lucide avec
 * ses attributs echappes : c'est la seule chaine que le Studio insere en HTML
 * brut, et elle ne contient jamais de saisie.
 */
export function IconView({ icon, size = 24, label }: { icon: IconMarkup; size?: number; label?: string }) {
  if (icon.svg) {
    return (
      <span
        className="inline-flex shrink-0 [&>svg]:size-full"
        role={label ? "img" : undefined}
        aria-label={label}
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    );
  }
  return (
    // Une image de la bibliotheque : servie par /assets, derriere la session.
    <img className="shrink-0 object-contain" src={icon.src ?? ""} alt={label ?? ""} width={size} height={size} />
  );
}

type Asset = { key: string; scope: string; mime: string; url: string };

/**
 * Choix d'une icone : le jeu integre, ou une image de la bibliotheque.
 *
 * DEUX ONGLETS ET NON UNE LISTE : 1 800 icones au trait et les pictos d'une
 * boutique ne se cherchent pas de la meme facon — les unes par mot-cle, les
 * autres d'un coup d'oeil, il y en a quelques dizaines.
 *
 * LES IMAGES : la bibliotheque commune, et celle de la boutique quand on en
 * connait une. Seules les images matricielles et SVG sont proposees.
 *
 * LE DIALOG DU PACKAGE ET NON @/components/Dialog : ce dernier pose le focus sur
 * « Annuler », ce qui est juste pour une confirmation mais volerait le focus du
 * champ de recherche — ici, on ouvre la boite pour taper un mot-cle. La boite
 * est aussi plus large, pour que la grille montre plus d'icones par ligne.
 */
export default function IconPicker({
  title,
  shop,
  initial,
  onChoose,
  onCancel,
  busy = false,
  imagesOnly = false,
}: {
  title: string;
  shop?: string | null;
  initial?: string | null;
  onChoose: (icon: IconMarkup) => void;
  onCancel: () => void;
  busy?: boolean;
  /** Logo, image de couverture : la bibliotheque seule, sans le jeu d'icones. */
  imagesOnly?: boolean;
}) {
  const [tab, setTab] = useState<"icones" | "images">(
    imagesOnly || initial?.startsWith("/assets/") ? "images" : "icones"
  );
  const [query, setQuery] = useState("");
  const [icons, setIcons] = useState<IconMarkup[]>([]);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [chosen, setChosen] = useState<IconMarkup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recherche avec un court delai : une requete par frappe ferait clignoter la grille.
  useEffect(() => {
    if (tab !== "icones") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/icons?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { ok: boolean; icons?: { ref: string; svg: string }[] }) => {
          setIcons((data.icons ?? []).map((icon) => ({ ref: icon.ref, svg: icon.svg, src: null })));
          setError(null);
        })
        .catch((cause: unknown) => {
          if ((cause as Error).name !== "AbortError") setError("Recherche impossible.");
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tab]);

  useEffect(() => {
    if (tab !== "images" || assets !== null) return;
    const scopes = ["shared", ...(shop ? [shop] : [])];
    Promise.all(
      scopes.map((scope) =>
        fetch(`/api/editor/assets?scope=${encodeURIComponent(scope)}`)
          .then((response) => (response.ok ? response.json() : { assets: [] }))
          .then((data: { assets?: Asset[] }) => data.assets ?? [])
      )
    )
      .then((lists) => setAssets(lists.flat().filter((asset) => asset.mime.startsWith("image/"))))
      .catch(() => setError("Bibliotheque d'images inaccessible."));
  }, [tab, assets, shop]);

  const choose = () => {
    if (chosen) onChoose(chosen);
  };

  const cells =
    tab === "icones"
      ? icons
      : (assets ?? []).map((asset) => ({ ref: asset.url, svg: null, src: asset.url }) as IconMarkup);

  const body = (
    <>
      {tab === "icones" ? (
        <Input
          type="search"
          aria-label="Chercher une icône"
          placeholder="Chercher : chaise, bureau, armoire, truck…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {/* Hauteur bornee : soixante icones defilent dans la boite au lieu de l'agrandir. */}
      <div className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1 overflow-y-auto p-0.5">
        {cells.map((icon) => (
          <Toggle
            key={icon.ref}
            variant="outline"
            // Le Toggle ramene tout SVG a 1rem : ici l'icone suit la taille d'IconView.
            className="hover:border-primary data-[state=on]:border-primary data-[state=on]:text-primary data-[state=on]:ring-primary aspect-square h-auto w-full p-1 data-[state=on]:ring-1 [&_svg:not([class*='size-'])]:size-full"
            pressed={chosen?.ref === icon.ref || (!chosen && initial === icon.ref)}
            onPressedChange={() => setChosen(icon)}
            onDoubleClick={() => onChoose(icon)}
            title={icon.ref.replace(/^lucide:/, "")}
          >
            <IconView icon={icon} size={28} />
          </Toggle>
        ))}
        {tab === "images" && assets !== null && assets.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-sm">
            Aucune image dans la bibliothèque. En téléverser depuis l&apos;onglet Images.
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {imagesOnly ? (
          <div className="grid gap-3">{body}</div>
        ) : (
          <Tabs value={tab} onValueChange={(value) => setTab(value as "icones" | "images")}>
            <TabsList variant="line">
              <TabsTrigger value="icones">Icônes</TabsTrigger>
              <TabsTrigger value="images">Mes images</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="grid gap-3 pt-2">
              {body}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button type="button" onClick={choose} disabled={busy}>
            {busy ? "…" : "Choisir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
