"use client";

import { Button } from "@guillxume/ui/components/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  Dialog as DialogRoot,
  DialogTitle,
} from "@guillxume/ui/components/dialog";
import type { ReactNode } from "react";

/**
 * Boite de dialogue — remplace `window.confirm()` aux endroits qui doivent
 * DIRE CE QUI VA ETRE DETRUIT, avec des chiffres : `window.confirm` ne peut
 * afficher qu'une seule ligne de texte brut, et coupe la mise en forme.
 *
 * Construite sur le Dialog du design system partage (Radix) : piege du focus,
 * Echap et clic a l'exterieur annulent. Montee par l'appelant quand elle doit
 * s'afficher (`{ouvert && <Dialog … />}`), elle est donc toujours ouverte.
 *
 * ELLE NE DEMANDE QU'UNE CHOSE. Une boite qui pose deux questions est un
 * formulaire, et un formulaire va dans une page — pas dans une couche qui
 * interrompt.
 *
 * L'ACTION DESTRUCTRICE N'EST JAMAIS EN APLAT : bouton a contour rouge, jamais
 * un fond rouge — un aplat reste dans l'oeil bien apres avoir ete lu, et c'est
 * precisement l'effet qu'on ne veut pas sur le bouton qu'on presente le moins
 * souvent.
 *
 * LE FOCUS PAR DEFAUT EST SUR « ANNULER » : la boite doit se fermer sans rien
 * casser quand on appuie sur Entree par reflexe.
 */
export default function Dialog({
  title,
  children,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm">{children}</div>
        <DialogFooter>
          <Button type="button" variant="outline" autoFocus onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "outline" : "solid"}
            color={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
