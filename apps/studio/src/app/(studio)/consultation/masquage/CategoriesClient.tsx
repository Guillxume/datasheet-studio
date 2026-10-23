"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@guillxume/ui/components/badge";
import { Switch } from "@guillxume/ui/components/switch";
import { cn } from "@guillxume/ui/lib/utils";
import type { CategoryNode } from "@/lib/datasheetsStore";

/**
 * L'arbre des categories d'une boutique, une ligne par niveau, avec son
 * interrupteur « Masquee ». Chaque bascule part tout de suite (pas de bouton
 * d'enregistrement) : c'est un reglage, et la page se recharge sur l'etat
 * serveur, qui fait foi.
 */
export default function CategoriesClient({ shop, nodes }: { shop: string; nodes: CategoryNode[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hiddenRoots = nodes.filter((node) => node.hidden);
  const hiddenCount = nodes
    .filter((node) => node.hidden && !node.hiddenByParent)
    .reduce((total, node) => total + node.count, 0);

  async function toggle(node: CategoryNode, hidden: boolean) {
    const key = node.path.join(" > ");
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/consultation/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boutique: shop, path: node.path, hidden }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      router.refresh();
    } catch (cause) {
      setError(`${key} : ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4">
      <p className="m-0 text-sm" role="status">
        {hiddenRoots.length === 0 ? (
          "Aucune catégorie masquée : toutes les fiches sont visibles."
        ) : (
          <>
            <strong>
              {hiddenRoots.length} catégorie{hiddenRoots.length > 1 ? "s" : ""} masquée
              {hiddenRoots.length > 1 ? "s" : ""}
            </strong>{" "}
            — {hiddenCount} fiche{hiddenCount > 1 ? "s" : ""} retirée{hiddenCount > 1 ? "s" : ""} de la consultation.
          </>
        )}
      </p>

      {error ? (
        <p role="alert" className="text-destructive m-0 text-sm">
          {error}
        </p>
      ) : null}

      <ul className="m-0 list-none rounded-lg border p-0">
        {nodes.map((node) => {
          const key = node.path.join(" > ");
          const id = `cat-${key}`;
          const depth = node.path.length - 1;
          return (
            <li
              key={key}
              className={cn(
                "flex items-center gap-3 border-b py-2 pr-3 last:border-b-0",
                (node.hidden || node.hiddenByParent) && "bg-muted/50"
              )}
              // Le retrait dit le niveau, comme dans le fil d'Ariane de la boutique.
              style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
            >
              <label htmlFor={id} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span
                  className={cn(
                    depth === 0 ? "font-semibold" : "font-normal",
                    (node.hidden || node.hiddenByParent) && "text-muted-foreground line-through"
                  )}
                >
                  {node.path[node.path.length - 1]}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {node.count} fiche{node.count > 1 ? "s" : ""}
                </span>
                {node.count === 0 && node.hidden ? (
                  <Badge variant="outline">plus aucune fiche</Badge>
                ) : null}
                {node.hiddenByParent ? (
                  <span className="text-muted-foreground text-xs">masquée avec la catégorie parente</span>
                ) : null}
              </label>
              <Switch
                id={id}
                checked={node.hidden || node.hiddenByParent}
                // Masquee par son parent : c'est le parent qu'on reaffiche.
                disabled={busy !== null || node.hiddenByParent}
                onCheckedChange={(value) => toggle(node, value)}
                aria-label={`Masquer « ${key} »`}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
