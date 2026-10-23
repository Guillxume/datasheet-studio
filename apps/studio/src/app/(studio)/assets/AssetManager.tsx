"use client";

import { Badge } from "@guillxume/ui/components/badge";
import { Button } from "@guillxume/ui/components/button";
import { Icon } from "@guillxume/ui/components/icon";
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
import { cn } from "@guillxume/ui/lib/utils";
import { Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { UPLOAD_ACCEPT } from "@/lib/assetUpload";

type Asset = { key: string; scope: string; mime: string; bytes: number; url: string };
type Shop = { slug: string; name: string };

/**
 * Bibliotheque d'images du Studio : pictos de badges, logos, icones.
 *
 * Les templates referencent ces images par leur URL RELATIVE (/assets/...) ;
 * le moteur de rendu la rend absolue vers le reseau interne au moment du rendu.
 * Un integrateur n'a donc qu'a copier l'URL affichee ici dans le champ du bloc.
 *
 * `canWrite` retire le televersement et la suppression pour un importateur. La
 * lecture lui reste, et elle lui sert : quand un bloc sort vide d'un apercu,
 * c'est ici qu'on verifie que le picto attendu existe bien sous cette cle.
 */
export default function AssetManager({ shops, canWrite }: { shops: Shop[]; canWrite: boolean }) {
  const [scope, setScope] = useState("shared");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (target: string) => {
    const response = await fetch(`/api/editor/assets?scope=${encodeURIComponent(target)}`);
    const data = await response.json().catch(() => ({ assets: [] }));
    setAssets(Array.isArray(data.assets) ? data.assets : []);
  }, []);

  useEffect(() => {
    /*
     * Faux positif de `react-hooks/set-state-in-effect`, verifie sur un cas
     * minimal : la regle suit l'appel dans `load` et y voit `setAssets`, sans
     * modeliser les deux `await` qui le precedent. Le setState arrive donc sur
     * une micro-tache ulterieure, jamais pendant le rendu de l'effet — la
     * cascade que la regle previent ne peut pas se produire ici.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(scope).catch(() => setStatus("Chargement impossible."));
  }, [scope, load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setStatus(null);
    let failures = 0;

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("scope", scope);
      form.append("file", file);

      const response = await fetch("/api/editor/assets", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        ++failures;
        setStatus(`${file.name} : ${data.error ?? `HTTP ${response.status}`}`);
      }
    }

    await load(scope);
    setBusy(false);
    if (failures === 0) {
      setStatus(`${files.length} fichier(s) téléversé(s).`);
    }
  }

  async function remove(key: string) {
    setBusy(true);
    await fetch(`/api/editor/assets?scope=${encodeURIComponent(scope)}&key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    await load(scope);
    setBusy(false);
    setStatus(`${key} supprimé.`);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="assets-portee">Portée</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="assets-portee" className="min-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Bibliothèque commune</SelectItem>
              {shops.map((shop) => (
                <SelectItem key={shop.slug} value={shop.slug}>{shop.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canWrite ? (
          /* Choisir puis envoyer aussitot : pas d'InputFile (qui garde le
             fichier en attente), un bouton qui porte le champ fichier. */
          <Button
            asChild
            variant="outline"
            className={cn(
              "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
              busy && "pointer-events-none opacity-50"
            )}
          >
            <label>
              <Icon icon={Upload} size="sm" />
              Téléverser
              <input
                type="file"
                multiple
                // Images ET polices : une police se televerse ici avant d'etre
                // declaree dans la feuille de style du template.
                accept={UPLOAD_ACCEPT}
                disabled={busy}
                className="sr-only"
                onChange={(event) => upload(event.target.files)}
              />
            </label>
          </Button>
        ) : null}
      </div>

      {status ? (
        <p role="status" className="text-muted-foreground mb-2 text-sm">
          {status}
        </p>
      ) : null}

      <p className="text-muted-foreground mb-4 text-sm">
        {canWrite
          ? "La clé est dérivée du nom de fichier. Re-téléverser sous la même clé remplace l'image partout où elle est utilisée, sans rouvrir les templates."
          : "Consultation seule : votre rôle ne permet pas de téléverser ni de supprimer une image."}
      </p>

      {assets.length === 0 ? (
        <p className="text-muted-foreground">Aucune image pour cette portée.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aperçu</TableHead>
              <TableHead>Clé</TableHead>
              <TableHead>URL à copier dans un bloc</TableHead>
              <TableHead className="text-right">Poids</TableHead>
              {canWrite ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.key}>
                <TableCell>
                  {/* <img> et non next/image : l'apercu affiche une image
                      deja stockee par nous, servie telle quelle par
                      /assets/[scope]/[key]. La passer par l'optimiseur de Next
                      ajouterait une indirection sans gain a 2,2rem de haut. */}
                  {asset.mime.startsWith("font/") ? (
                    // Une police n'a pas d'apercu en <img> : la case vide se
                    // lisait comme une image cassee.
                    <Badge variant="outline">police</Badge>
                  ) : (
                    <img src={asset.url} alt="" className="h-[2.2rem] w-auto" />
                  )}
                </TableCell>
                <TableCell><code className="font-mono text-xs">{asset.key}</code></TableCell>
                <TableCell><code className="font-mono text-xs select-all">{asset.url}</code></TableCell>
                <TableCell className="text-right tabular-nums">{Math.max(1, Math.round(asset.bytes / 1024))} Ko</TableCell>
                {canWrite ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      color="destructive"
                      size="sm"
                      onClick={() => remove(asset.key)}
                      disabled={busy}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
