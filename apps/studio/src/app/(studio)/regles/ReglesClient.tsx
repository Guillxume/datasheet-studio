"use client";

import SectionHead from "@/components/SectionHead";
import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent } from "@guillxume/ui/components/card";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guillxume/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Rule = {
  id: string;
  category: string[] | null;
  category_any: string[] | null;
  ref_pattern: string | null;
  brand: string | null;
  template_slug: string;
  note: string | null;
};

type Resolution = { slug: string; by: "explicite" | "regle" | "defaut" } | null;
type Shop = { slug: string; name: string };
type Template = { slug: string; scope: string; name: string; published: number | null };

/**
 * Regles de template par categorie.
 *
 * LE BOUTON « ESSAYER » EST LE COEUR DE CETTE PAGE, pas un ajout. Un jeu de
 * regles se verifie autrement en lancant un lot et en ouvrant des PDF au hasard.
 * Ici on tape un fil d'ariane et on lit immediatement le template retenu ET la
 * raison — regle ou defaut. C'est aussi le seul moyen de constater qu'une regle
 * ne correspond plus apres qu'une categorie a ete renommee en back-office : le
 * resultat passe de « regle » a « defaut » sans qu'aucune erreur ne soit levee
 * nulle part.
 */
export default function ReglesClient({
  shops,
  templates,
}: {
  shops: Shop[];
  templates: Template[];
}) {
  const [shop, setShop] = useState(shops[0]?.slug ?? "");
  const [rules, setRules] = useState<Rule[]>([]);
  const [defaut, setDefaut] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState("");
  const [categoryAny, setCategoryAny] = useState("");
  const [refPattern, setRefPattern] = useState("");
  const [brand, setBrand] = useState("");
  const [slug, setSlug] = useState("");

  const [essai, setEssai] = useState("");
  const [essaiMarque, setEssaiMarque] = useState("");
  const [essaiRef, setEssaiRef] = useState("");
  const [resolution, setResolution] = useState<{ valeur: Resolution } | null>(null);

  // Les templates proposables : ceux de la boutique et ceux de la bibliotheque,
  // comme en production — et seulement ceux qui ont une version publiee, un
  // template non publie n'etant servi a personne.
  const proposables = templates.filter(
    (row) => (row.scope === "shared" || row.scope === shop) && row.published !== null
  );

  const charger = useCallback(async (cible: string) => {
    if (cible === "") return;
    const response = await fetch(`/api/editor/rules?shop=${encodeURIComponent(cible)}`);
    const data = await response.json().catch(() => ({}));
    if (data.ok) {
      setRules(data.rules as Rule[]);
      setDefaut(data.default ?? "");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger(shop).catch(() => setError("Chargement impossible."));
  }, [shop, charger]);

  async function appeler(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/editor/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, shop }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const criteres = (rule: Rule): string => {
    const parts: string[] = [];
    if (rule.category) parts.push(`sous ${rule.category.join(" > ")}`);
    if (rule.category_any) parts.push(`dans l'une de ${rule.category_any.join(", ")}`);
    if (rule.brand) parts.push(`marque ${rule.brand}`);
    if (rule.ref_pattern) parts.push(`référence /${rule.ref_pattern}/`);
    return parts.join(" et ");
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="regles-boutique">Boutique</Label>
          <Select value={shop} onValueChange={setShop}>
            <SelectTrigger id="regles-boutique" className="min-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shops.map((row) => (
                <SelectItem key={row.slug} value={row.slug}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="regles-defaut">Template par défaut</Label>
          {/* Radix refuse une option de valeur "" : « Aucun » passe par une
              sentinelle, convertie en "" (etat) puis null (API) comme avant. */}
          <Select
            value={defaut === "" ? AUCUN : defaut}
            disabled={busy}
            onValueChange={async (choix) => {
              const valeur = choix === AUCUN ? "" : choix;
              setDefaut(valeur);
              await appeler({ action: "defaut", template_slug: valeur === "" ? null : valeur });
            }}
          >
            <SelectTrigger id="regles-defaut" className="min-w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUN}>Aucun — « auto » échouera hors de toute règle</SelectItem>
              {proposables.map((row) => (
                <SelectItem key={`${row.scope}|${row.slug}`} value={row.slug}>
                  {row.name} ({row.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <Icon icon={CircleAlert} size="sm" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {defaut === "" ? (
        <p className="text-muted-foreground mb-4 text-sm">
          <BadgeStatus status="amber">sans défaut</BadgeStatus> Un produit qui ne correspond à aucune
          règle fera échouer <code className={CODE}>template: &quot;auto&quot;</code>{" "}en 409.
          C&apos;est un état valable — il refuse plutôt que de rendre une fiche au mauvais modèle —
          mais il faut l&apos;avoir choisi.
        </p>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <SectionHead title="Essayer un produit" />
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="essai-fil">Fil d&apos;Ariane</Label>
            <Input
              id="essai-fil"
              value={essai}
              onChange={(event) => setEssai(event.target.value)}
              placeholder="Manutention > Transpalettes"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="essai-marque">Marque (facultatif)</Label>
              <Input id="essai-marque" value={essaiMarque} onChange={(event) => setEssaiMarque(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="essai-ref">Référence (facultatif)</Label>
              <Input id="essai-ref" value={essaiRef} onChange={(event) => setEssaiRef(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                const data = await appeler({
                  action: "essayer",
                  category: essai,
                  brand: essaiMarque,
                  ref: essaiRef,
                });
                if (data) setResolution({ valeur: (data.resolution ?? null) as Resolution });
              }}
            >
              Quel template ?
            </Button>
          </div>

          {resolution !== null ? (
            resolution.valeur === null ? (
              <Alert variant="destructive">
                <Icon icon={CircleAlert} size="sm" />
                <AlertDescription>
                  <p>
                    Aucune règle ne correspond, et cette boutique n&apos;a pas de template par défaut :
                    <code className={CODE}> auto</code> répondrait 409 pour ce produit.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="flex flex-wrap items-center gap-2">
                <code className={CODE}>{resolution.valeur.slug}</code>{" "}
                {resolution.valeur.by === "regle" ? (
                  <BadgeStatus status="green">par une règle</BadgeStatus>
                ) : (
                  <BadgeStatus status="amber">par défaut — aucune règle n&apos;a correspondu</BadgeStatus>
                )}
              </p>
            )
          ) : null}

          <p className="text-muted-foreground text-sm">
            Les accents et la casse sont ignorés. Le fil d&apos;Ariane se saisit du plus général au
            plus précis, séparé par <code className={CODE}>&gt;</code>{" "}— c&apos;est ce que le
            payload transporte dans <code className={CODE}>product.category_path</code>.
          </p>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <SectionHead title="Règles" />
      {rules.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune règle : tous les produits reçoivent le template par défaut.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quand</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="whitespace-normal">{criteres(rule)}</TableCell>
                <TableCell>
                  <code className="font-mono text-xs">{rule.template_slug}</code>
                  {proposables.some((row) => row.slug === rule.template_slug) ? null : (
                    <>
                      {" "}
                      {/* Une regle qui designe un template supprime ou non publie
                          echoue au rendu, pas ici : le signaler dans la liste est
                          le seul endroit ou on peut encore le corriger a temps. */}
                      <BadgeStatus status="amber">introuvable ou non publié</BadgeStatus>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-normal">{rule.note ?? ""}</TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    color="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      appeler({ action: "supprimer", id: rule.id }).then(() => charger(shop))
                    }
                  >
                    Supprimer
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SectionHead title="Ajouter une règle" />
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="regle-categorie">Sous la catégorie (préfixe du fil d&apos;Ariane)</Label>
            <Input
              id="regle-categorie"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Manutention > Transpalettes"
            />
            <p className="text-muted-foreground text-sm">
              Attrape la catégorie <strong>et tous ses descendants</strong>. Plus le préfixe est
              profond, plus la règle est spécifique : <code className={CODE}>Manutention &gt; Transpalettes</code>{" "}
              bat <code className={CODE}>Manutention</code>, qui bat le défaut. Aucun ordre à maintenir.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="regle-categories">
              Où dans l&apos;une de ces catégories (sans notion d&apos;ordre)
            </Label>
            <Input
              id="regle-categories"
              value={categoryAny}
              onChange={(event) => setCategoryAny(event.target.value)}
              placeholder="Poufs > Repose-pieds"
            />
            <p className="text-muted-foreground text-sm">
              Pour les sources qui ne donnent pas un vrai fil d&apos;Ariane. Un export PrestaShop liste
              toutes les catégories associées dans un ordre qui n&apos;est pas hiérarchique —{" "}
              <code className={CODE}>Promo, Bureaux, Gammes…</code>{" "}commence par une catégorie
              transversale, et aucune règle de préfixe ne peut alors s&apos;appliquer.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="regle-marque">Marque</Label>
              <Input id="regle-marque" value={brand} onChange={(event) => setBrand(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="regle-reference">Référence (expression régulière)</Label>
              <Input
                id="regle-reference"
                value={refPattern}
                onChange={(event) => setRefPattern(event.target.value)}
                placeholder="^RAY-"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="regle-template">Template à servir</Label>
            {/* « Choisir… » n'est pas une option mais l'invite du selecteur :
                Radix l'affiche tant que la valeur vaut "". */}
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger id="regle-template" className="w-full sm:w-96">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {proposables.map((row) => (
                  <SelectItem key={`${row.scope}|${row.slug}`} value={row.slug}>
                    {row.name} ({row.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={
                busy ||
                slug === "" ||
                (category === "" && categoryAny === "" && brand === "" && refPattern === "")
              }
              onClick={async () => {
                const ok = await appeler({
                  action: "creer",
                  category,
                  category_any: categoryAny,
                  ref_pattern: refPattern,
                  brand,
                  template_slug: slug,
                });
                if (ok) {
                  setCategory("");
                  setCategoryAny("");
                  setBrand("");
                  setRefPattern("");
                  setSlug("");
                  await charger(shop);
                }
              }}
            >
              Ajouter
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Une règle à plusieurs critères bat une règle à un seul : « marque Liftmax sous Levage »
            l&apos;emporte sur « sous Levage ».
          </p>
        </CardContent>
      </Card>
    </>
  );
}

/** Sentinelle de « Aucun » template par defaut : un SelectItem ne peut pas valoir "". */
const AUCUN = "__aucun__";

/** Code en ligne : un slug, un chemin de payload. */
const CODE = "bg-muted px-1 font-mono text-xs";
