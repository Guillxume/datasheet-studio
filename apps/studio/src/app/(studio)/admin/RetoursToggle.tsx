"use client";

import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Label } from "@guillxume/ui/components/label";
import { Switch } from "@guillxume/ui/components/switch";
import { useState } from "react";

/**
 * Bascule de la page /retours : un interrupteur, mais pas muet — l'etat est
 * ecrit en toutes lettres juste dessous (« activés » / « désactivés »),
 * coherent avec « actif/desactive » ailleurs sur cette page (comptes, boutiques).
 *
 * LE SWITCH DU PACKAGE BASCULE SON ETAT INTERNE AU CLIC, avant la reponse du
 * serveur, et ne se resynchronise que si `checked` change. Si l'appel echoue
 * (ou si le serveur renvoie l'etat d'avant), `checked` ne bouge pas : on le
 * remonte alors (`key`) pour qu'il affiche de nouveau l'etat reel.
 */
export default function RetoursToggle({ active: initial }: { active: boolean }) {
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resync, setResync] = useState(0);

  async function basculer() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/retours", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      if ((data.active === true) === active) setResync((n) => n + 1);
      setActive(data.active === true);
    } catch (cause) {
      setResync((n) => n + 1);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Switch
          key={resync}
          id="retours-actifs"
          checked={active}
          disabled={busy}
          aria-busy={busy}
          onCheckedChange={basculer}
        />
        <Label htmlFor="retours-actifs">Page /retours ouverte</Label>
      </div>
      <p className="text-muted-foreground text-sm">
        {active ? (
          <>
            <BadgeStatus status="green">activés</BadgeStatus> Toute personne connectée peut écrire
            au super-administrateur depuis <code className="bg-muted px-1 font-mono text-xs">/retours</code>.
          </>
        ) : (
          <>
            <BadgeStatus status="amber">désactivés</BadgeStatus>{" "}
            La page <code className="bg-muted px-1 font-mono text-xs">/retours</code>{" "}
            n&apos;est accessible à personne pour l&apos;instant.
          </>
        )}
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
