"use client";

import { Button } from "@guillxume/ui/components/button";
import { cn } from "@guillxume/ui/lib/utils";

/**
 * Choisir un fichier : un bouton qui est un <label>, le champ fichier en
 * sr-only — il reste atteignable au clavier, et l'anneau de focus passe sur le
 * bouton. Partage par les reglages du book (images des pages dessinees) et le
 * generateur (devis du client).
 *
 * Le champ est vide apres chaque choix : choisir deux fois le MEME fichier doit
 * redeclencher `onFile` — c'est ce qu'on fait apres l'avoir corrige sur le disque.
 */
export default function UploadButton({
  label,
  accept,
  busy = false,
  onFile,
}: {
  label: string;
  accept: string;
  busy?: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(
        "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
        busy && "pointer-events-none opacity-50",
      )}
    >
      <label aria-disabled={busy || undefined}>
        {label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
    </Button>
  );
}
