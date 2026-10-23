"use client";

import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@guillxume/ui/components/card";
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
import { CircleAlert } from "lucide-react";
import { useId, useState } from "react";

type Template = { slug: string; scope: string; name: string };
type Shop = { slug: string; name: string };

/**
 * Creation et duplication de templates.
 *
 * La duplication est ce qui rend la mutualisation du parc praticable : partir du
 * modele commun, puis le faire diverger pour un site sans toucher aux autres.
 *
 * `canWrite` MASQUE, il ne protege pas : la route /api/editor/template revalide
 * la permission a chaque action. Ce qu'il apporte est ailleurs — un importateur
 * ne doit pas voir « Nouveau template » et decouvrir en cliquant que ce n'est
 * pas pour lui.
 *
 * Les identifiants des champs passent par useId : l'accueil monte cette barre
 * deux fois (templates, composants).
 */
export default function TemplateActions({
  canWrite,
  shops,
  templates,
  kind = "template",
}: {
  canWrite: boolean;
  shops: Shop[];
  templates: Template[];
  /** « component » : la meme barre, pour les composants reutilisables. */
  kind?: "template" | "component";
}) {
  const noun = kind === "component" ? "composant" : "template";
  const [mode, setMode] = useState<"none" | "create" | "duplicate">("none");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [scope, setScope] = useState("shared");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState(templates[0] ? `${templates[0].scope}|${templates[0].slug}` : "");

  const id = useId();

  async function submit() {
    setBusy(true);
    setError(null);

    const body =
      mode === "create"
        ? { action: "create", scope, slug, name, kind }
        : (() => {
            const [sourceScope, sourceSlug] = source.split("|");
            return {
              action: "duplicate",
              scope: sourceScope,
              slug: sourceSlug,
              targetScope: scope,
              targetSlug: slug,
              name,
            };
          })();

    try {
      const response = await fetch("/api/editor/template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      window.location.href = `/editor/${encodeURIComponent(scope)}/${encodeURIComponent(slug)}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  if (mode === "none") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canWrite ? (
          <>
            {/* Plein pour les templates seulement : c'est l'action principale de l'accueil. */}
            <Button
              type="button"
              variant={kind === "template" ? "solid" : "outline"}
              size="sm"
              onClick={() => setMode("create")}
            >
              Nouveau {noun}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode("duplicate")}
              disabled={templates.length === 0}
            >
              Dupliquer un {noun}
            </Button>
          </>
        ) : null}
        {kind === "template" ? (
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/import">Importer un catalogue</a>
            </Button>
            <Button asChild variant="link" size="sm">
              <a href="/assets">Bibliothèque d&apos;images</a>
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle as="h2" className="text-lg">
          {mode === "create" ? `Nouveau ${noun}` : `Dupliquer un ${noun}`}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        {mode === "duplicate" ? (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-source`}>{kind === "component" ? "Composant source" : "Template source"}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id={`${id}-source`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={`${template.scope}|${template.slug}`} value={`${template.scope}|${template.slug}`}>
                    {template.name} ({template.scope === "shared" ? "bibliothèque" : template.scope})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor={`${id}-scope`}>Portée</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id={`${id}-scope`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Bibliothèque commune (tous les sites)</SelectItem>
              {shops.map((shop) => (
                <SelectItem key={shop.slug} value={shop.slug}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-slug`}>Slug</Label>
          <Input
            id={`${id}-slug`}
            className="font-mono"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={kind === "component" ? "pied-de-page" : "fiche-technique-02"}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Nom affiché</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "component" ? "Pied de page" : "Fiche technique 02"}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <Icon icon={CircleAlert} size="sm" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={submit} disabled={busy || slug === "" || name === ""}>
            {mode === "create" ? "Créer et éditer" : "Dupliquer et éditer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMode("none");
              setError(null);
            }}
            disabled={busy}
          >
            Annuler
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Un template propre à une boutique masque un template de bibliothèque de même slug : c&apos;est
          ainsi qu&apos;un site surcharge le modèle commun sans renommer, ni affecter les autres.
        </p>
      </CardContent>
    </Card>
  );
}
