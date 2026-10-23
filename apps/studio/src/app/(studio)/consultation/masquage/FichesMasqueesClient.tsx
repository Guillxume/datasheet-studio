"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@guillxume/ui/components/button";
import type { HiddenDatasheet } from "@/lib/datasheetsStore";

/**
 * Les fiches masquees une a une (migration 015), avec « Reafficher ». On les
 * masque depuis la consultation, ligne par ligne ou par selection ; on les
 * reaffiche ici, puisqu'une fiche masquee n'apparait plus dans la consultation.
 */
export default function FichesMasqueesClient({ shop, fiches }: { shop: string; fiches: HiddenDatasheet[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reafficher(productKeys: string[], label: string) {
    setBusy(label);
    setError(null);
    try {
      // Par paquets : l'API plafonne un appel a une selection (200 produits).
      for (let start = 0; start < productKeys.length; start += 200) {
        const response = await fetch("/api/consultation/fiches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ boutique: shop, products: productKeys.slice(start, start + 200), hidden: false }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      router.refresh();
    } catch (cause) {
      setError(`${label} : ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(null);
    }
  }

  if (fiches.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune fiche masquée. Pour en masquer une : bouton <strong>Masquer</strong> sur sa ligne, dans la
        consultation, ou <strong>Masquer ces fiches</strong> après en avoir coché plusieurs.
      </p>
    );
  }

  return (
    <section className="grid gap-3">
      {error ? (
        <p role="alert" className="text-destructive m-0 text-sm">
          {error}
        </p>
      ) : null}
      <ul className="m-0 list-none rounded-lg border p-0">
        {fiches.map((fiche) => {
          const label = fiche.productName ?? fiche.productKey;
          return (
            <li key={fiche.productKey} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <code className="text-muted-foreground font-mono text-xs">{fiche.productId ?? fiche.productKey}</code>
                <span className="font-medium">{label}</span>
                {fiche.categoryPath.length > 0 ? (
                  <span className="text-muted-foreground text-xs">{fiche.categoryPath.join(" › ")}</span>
                ) : null}
                {fiche.productName === null ? (
                  <span className="text-muted-foreground text-xs">plus présente dans l&apos;index</span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => reafficher([fiche.productKey], label)}
              >
                Réafficher
              </Button>
            </li>
          );
        })}
      </ul>
      {fiches.length > 1 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => reafficher(fiches.map((fiche) => fiche.productKey), "Tout réafficher")}
          >
            Tout réafficher
          </Button>
        </div>
      ) : null}
    </section>
  );
}
