"use client";

import { Alert, AlertDescription, AlertTitle } from "@guillxume/ui/components/alert";
import { Badge } from "@guillxume/ui/components/badge";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import { CircleAlert, KeyRound } from "lucide-react";
import { useState } from "react";
import type { BackofficeKind, ShopAdminRow, ShopSettings } from "@/lib/shopsAdmin";
import Dialog from "@/components/Dialog";

type Body = Record<string, unknown>;

const BACKOFFICES = [
  { value: "prestashop", label: "PrestaShop (module acmedatasheet)" },
  { value: "medusa", label: "Medusa (widget d'administration)" },
  { value: "pim", label: "PIM / ERP (collecteur API)" },
  { value: "autre", label: "Autre" },
] as const;

/**
 * Boutiques : identite, cle API, back-office d'origine.
 *
 * UNE LIGNE SE DEPLIE EN FORMULAIRE plutot que d'ouvrir une page par boutique.
 * Le parc en compte une poignee, et l'operation la plus frequente — comparer
 * deux sites, recopier une couleur — se fait sur la liste, pas dans une fiche.
 *
 * LA CLE API NE S'AFFICHE JAMAIS, sauf a l'instant ou elle est emise. La base
 * n'en garde que le sha256 : ce n'est pas une precaution d'affichage, c'est
 * qu'il n'y a rien a afficher. Ce que la liste montre a la place — prefixe, date
 * d'emission, date de dernier usage — est ce qui permet de repondre a la seule
 * question qu'on se pose vraiment : « puis-je la faire tourner sans rien
 * casser ? »
 */
export default function BoutiquesClient({ initial }: { initial: ShopAdminRow[] }) {
  const [shops, setShops] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ slug: string; key: string } | null>(null);
  const [confirmingRotation, setConfirmingRotation] = useState(false);

  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  async function call(body: Body): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/shops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const list = await fetch("/api/admin/shops").then((r) => r.json());
      if (list.ok) setShops(list.shops as ShopAdminRow[]);

      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant={creating ? "outline" : "solid"} onClick={() => setCreating((value) => !value)}>
          {creating ? "Fermer" : "Nouvelle boutique"}
        </Button>
      </div>

      {creating ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle as="h2">Nouvelle boutique</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="boutique-slug">Slug</Label>
                <Input
                  id="boutique-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="contoso-equipment"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="boutique-nom">Nom affiché</Label>
                <Input
                  id="boutique-nom"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Espace Équipement"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={busy || slug === "" || name === ""}
                onClick={async () => {
                  const data = await call({ action: "creer", slug, name });
                  if (data && typeof data.key === "string") {
                    setIssued({ slug, key: data.key });
                    setSlug("");
                    setName("");
                    setCreating(false);
                  }
                }}
              >
                Créer et émettre la clé
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Le slug identifie la boutique dans les URL et la portée des templates. Il ne se change
              pas ensuite.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {issued ? (
        <Alert variant="warning" className="mb-4">
          <Icon icon={KeyRound} size="sm" />
          <AlertTitle>
            <h2>Clé API de {issued.slug}</h2>
          </AlertTitle>
          <AlertDescription>
            <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs break-all select-all">
              {issued.key}
            </code>
            <p>
              <strong>Affichée une seule fois.</strong>{" "}À reporter dans la configuration du module
              ou du connecteur. La base n&apos;en garde que l&apos;empreinte : elle est irrécupérable.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setIssued(null)}>
              J&apos;ai copié la clé
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <Icon icon={CircleAlert} size="sm" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="text-right">Templates</TableHead>
            <TableHead>Clé API</TableHead>
            <TableHead>État</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shops.map((shop) => (
            <TableRow key={shop.id} className={shop.active ? undefined : "opacity-[0.55]"}>
              <TableCell>{shop.name}</TableCell>
              <TableCell>
                <span className="text-muted-foreground font-mono text-xs">{shop.slug}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{shop.templates}</TableCell>
              <TableCell>
                <div className="grid gap-0.5">
                  <code className="font-mono text-xs">sk_{shop.api_key_prefix}…</code>
                  <span className="text-muted-foreground text-xs">
                    {shop.api_key_last_used_at
                      ? `vue le ${new Date(shop.api_key_last_used_at).toLocaleDateString("fr-FR")}`
                      : "jamais utilisée"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {shop.active ? (
                  <BadgeStatus status="green">active</BadgeStatus>
                ) : (
                  <Badge variant="outline">inactive</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpenId(openId === shop.id ? null : shop.id);
                      // Changer de ligne ferme aussi une boite de rotation
                      // restee ouverte : sinon elle reapparaitrait au prochain
                      // « Configurer », pour la MAUVAISE boutique.
                      setConfirmingRotation(false);
                    }}
                  >
                    {openId === shop.id ? "Fermer" : "Configurer"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => call({ action: "actif", id: shop.id, active: !shop.active })}
                  >
                    {shop.active ? "Désactiver" : "Réactiver"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {openId !== null ? (
        <Reglages
          key={openId}
          shop={shops.find((row) => row.id === openId)!}
          busy={busy}
          onSave={(patch) => call({ action: "configurer", id: openId, ...patch })}
          onRotate={() => setConfirmingRotation(true)}
        />
      ) : null}

      {confirmingRotation && openId !== null ? (
        <Dialog
          destructive
          title="Faire tourner la clé"
          confirmLabel="Faire tourner"
          busy={busy}
          onCancel={() => setConfirmingRotation(false)}
          onConfirm={async () => {
            const shop = shops.find((row) => row.id === openId)!;
            const data = await call({ action: "rotation", id: openId });
            setConfirmingRotation(false);
            if (data && typeof data.key === "string") {
              setIssued({ slug: shop.slug, key: data.key });
            }
          }}
        >
          Faire tourner la clé de <strong>{shops.find((row) => row.id === openId)?.name}</strong>
          {" "}? L&apos;ancienne cesse de fonctionner <strong>immédiatement</strong>
          {" "}: tout module ou collecteur qui l&apos;utilise tombera en 401 jusqu&apos;à ce que la
          nouvelle y soit reportée.
        </Dialog>
      ) : null}
    </>
  );
}

/**
 * Formulaire de reglages d'une boutique.
 *
 * L'etat local part d'une COPIE des reglages recus. Le composant est remonte a
 * chaque changement de boutique grace a `key={openId}` cote parent — sans quoi
 * ouvrir une seconde boutique afficherait les champs de la premiere, defaut
 * classique des formulaires initialises depuis une propriete.
 */
function Reglages({
  shop,
  busy,
  onSave,
  onRotate,
}: {
  shop: ShopAdminRow;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onRotate: () => void;
}) {
  const [name, setName] = useState(shop.name);
  const [settings, setSettings] = useState<ShopSettings>(shop.settings);
  const [webhookUrl, setWebhookUrl] = useState(shop.webhook_url ?? "");

  const set = (patch: Partial<ShopSettings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle as="h2">{shop.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ id="reglage-nom" label="Nom affiché" value={name} onChange={setName} />

          <Champ
            id="reglage-url"
            label="URL de la boutique"
            value={settings.url ?? ""}
            onChange={(value) => set({ url: value })}
            placeholder="https://www.contoso-equipment.example"
          />

          <Champ
            id="reglage-logo"
            label="Clé de l'asset logo"
            value={settings.logo ?? ""}
            onChange={(value) => set({ logo: value })}
            placeholder="logo-contoso-equipment"
          />

          <Champ
            id="reglage-couleur-1"
            label="Couleur principale"
            value={settings.colors?.primary ?? ""}
            onChange={(value) => set({ colors: { ...settings.colors, primary: value } })}
            placeholder="#0b5ea8"
          />

          <Champ
            id="reglage-couleur-2"
            label="Couleur secondaire"
            value={settings.colors?.secondary ?? ""}
            onChange={(value) => set({ colors: { ...settings.colors, secondary: value } })}
            placeholder="#33404d"
          />

          <Champ
            id="reglage-adresse"
            label="Adresse"
            value={settings.company?.address ?? ""}
            onChange={(value) => set({ company: { ...settings.company, address: value } })}
          />

          <Champ
            id="reglage-telephone"
            label="Téléphone"
            value={settings.company?.phone ?? ""}
            onChange={(value) => set({ company: { ...settings.company, phone: value } })}
          />

          <Champ
            id="reglage-courriel"
            label="Courriel de contact"
            value={settings.company?.email ?? ""}
            onChange={(value) => set({ company: { ...settings.company, email: value } })}
          />

          <Champ
            id="reglage-mentions"
            label="Mentions légales"
            value={settings.company?.legal ?? ""}
            onChange={(value) => set({ company: { ...settings.company, legal: value } })}
          />

          <div className="grid gap-2">
            <Label htmlFor="reglage-backoffice">Back-office d&apos;origine</Label>
            {/* Radix refuse une option de valeur "" : « Non precise » passe par
                une sentinelle, convertie en `undefined` comme avant. */}
            <Select
              value={settings.backoffice?.kind || AUCUN}
              onValueChange={(value) =>
                set({
                  backoffice: {
                    ...settings.backoffice,
                    kind: (value === AUCUN ? undefined : value) as BackofficeKind | undefined,
                  },
                })
              }
            >
              <SelectTrigger id="reglage-backoffice" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Non précisé</SelectItem>
                {BACKOFFICES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Champ
            id="reglage-backoffice-url"
            label="URL du back-office"
            value={settings.backoffice?.url ?? ""}
            onChange={(value) => set({ backoffice: { ...settings.backoffice, url: value } })}
            placeholder="https://admin.exemple.fr"
          />

          {/* L'ERP est multi-entites : un devis n'est cherche que dans celles-ci,
              toutes a la fois. Vide, les books de la boutique ne proposent que le
              PDF televerse. */}
          <Champ
            id="reglage-erp-entite"
            label="Entités ERP (Dolibarr), pour les devis des books"
            value={settings.erp?.entity ?? ""}
            onChange={(value) => set({ erp: { ...settings.erp, entity: value } })}
            placeholder="ex. 4, 9, 12"
          />

          <Champ
            id="reglage-webhook"
            label="URL de notification (webhook sortant)"
            value={webhookUrl}
            onChange={setWebhookUrl}
            placeholder="https://www.exemple.fr/module/acmedatasheet/hook"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={busy} onClick={() => onSave({ name, settings, webhookUrl })}>
            Enregistrer
          </Button>
          <Button type="button" variant="outline" color="destructive" disabled={busy} onClick={onRotate}>
            Faire tourner la clé API
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Ces champs alimentent le bloc <code className="bg-muted px-1 font-mono text-xs">shop</code>{" "}
          du payload de rendu — le même que celui décrit dans la documentation d&apos;intégration. Ce
          qui est saisi ici part tel quel dans la fiche, et préalimente la page d&apos;import.
        </p>
      </CardContent>
    </Card>
  );
}

/** Sentinelle du back-office « Non precise » : un SelectItem ne peut pas valoir "". */
const AUCUN = "__aucun__";

/** Un champ texte libelle du formulaire de reglages. */
function Champ({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}
