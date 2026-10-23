"use client";

import type { FormEvent } from "react";
import { Button } from "@guillxume/ui/components/button";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import { DEFAULT_SORT, SORTS, type SortKey } from "@/lib/datasheets";

/**
 * Choix de la boutique et recherche — un formulaire GET, pour que la liste
 * filtree reste une URL qu'on partage et qu'on recharge.
 *
 * LES LISTES SONT DES Select RADIX NOMMES : dans un <form>, Radix rend a cote
 * du bouton un <select> natif cache, porteur du `name` et de la valeur
 * courante. C'est lui que le navigateur soumet, et lui que omitDefaults
 * desactive (namedItem("tri") le renvoie : c'est un HTMLSelectElement).
 *
 * UNE RECHERCHE VIDE NE VA PAS DANS L'URL. Un formulaire GET envoie tous ses
 * champs, vides compris : « ?boutique=acme-prod&q= » se lit comme une
 * recherche de rien. Desactiver le champ vide juste avant l'envoi le retire de
 * la requete. Meme regle pour le tri par defaut : l'URL ne dit que ce qui a
 * ete choisi.
 */
export default function FiltersForm({
  shops,
  current,
  query,
  sort,
}: {
  shops: { slug: string; name: string }[];
  current: string | null;
  query: string;
  sort: SortKey;
}) {
  const omitDefaults = (event: FormEvent<HTMLFormElement>) => {
    const elements = event.currentTarget.elements;
    const search = elements.namedItem("q");
    if (search instanceof HTMLInputElement && search.value.trim() === "") search.disabled = true;
    const order = elements.namedItem("tri");
    if (order instanceof HTMLSelectElement && order.value === DEFAULT_SORT) order.disabled = true;
  };

  return (
    <form method="get" action="/consultation" className="mb-6 flex flex-wrap items-end gap-3" onSubmit={omitDefaults}>
      <div className="grid gap-2">
        <Label htmlFor="consultation-boutique">Boutique</Label>
        {/* Aucune boutique choisie : pas de valeur, le texte d'attente s'affiche
            et `required` bloque l'envoi (le <select> cache reste vide). */}
        <Select name="boutique" defaultValue={current ?? undefined} required>
          <SelectTrigger id="consultation-boutique" className="min-w-48">
            <SelectValue placeholder="Choisir une boutique" />
          </SelectTrigger>
          <SelectContent>
            {shops.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="consultation-recherche">Rechercher</Label>
        <Input
          id="consultation-recherche"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Nom, id, référence ou réf. fournisseur"
          className="min-w-72"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="consultation-tri">Trier par</Label>
        <Select name="tri" defaultValue={sort}>
          <SelectTrigger id="consultation-tri" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Afficher</Button>
    </form>
  );
}
