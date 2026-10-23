"use client";

import { useEffect } from "react";
import { createUsePuck } from "@puckeditor/core";
import { undoDecision } from "@/lib/undoHotkeys";

/**
 * Annuler / retablir au clavier sur TOUTES les dispositions — voir
 * src/lib/undoHotkeys.ts pour le defaut de Puck que cela corrige (Ctrl+Z sans
 * effet en AZERTY, Ctrl+W qui annule).
 *
 * Monte dans `overrides.puck` (EditorClient.tsx), donc dans le contexte de Puck,
 * pour toute la duree de l'editeur.
 *
 * EN PHASE DE CAPTURE, SUR `window` : Puck ecoute `keydown` sur `document`, en
 * phase de bouillonnement. Passer avant lui est ce qui permet de l'empecher
 * d'agir sur une touche qu'il lirait de travers.
 */

const usePuckStore = createUsePuck();

export default function EditorHotkeys() {
  const back = usePuckStore((s) => s.history.back);
  const forward = usePuckStore((s) => s.history.forward);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const decision = undoDecision(event);
      if (decision === null) return;

      event.stopPropagation();
      if (decision === "block") return;

      // Comme Puck : le raccourci de l'editeur l'emporte sur l'annulation propre
      // au champ de saisie, que l'historique de Puck couvre deja.
      event.preventDefault();
      if (decision === "back") back();
      else forward();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [back, forward]);

  return null;
}
