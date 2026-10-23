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
import { assignableRoles, can, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/roles";
import Dialog from "@/components/Dialog";

export type UserView = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  has_password: boolean;
  last_login_at: string | null;
  created_at: string;
};

type Body = Record<string, unknown>;

/**
 * Gestion des comptes.
 *
 * L'ETAT VIENT DU SERVEUR AU PREMIER RENDU, puis chaque action rejoue la liste
 * complete (`recharger`). Pour une table qui compte quelques dizaines de lignes,
 * cela vaut mieux qu'une mise a jour optimiste locale : il n'y a qu'une source de
 * verite, et les regles que le serveur applique — dernier administrateur,
 * suppression refusee — sont donc toujours refletees, meme celles que cette page
 * ne connait pas.
 *
 * LE LIEN D'ACTIVATION S'AFFICHE QUAND LE COURRIEL N'EST PAS PARTI, et
 * seulement dans ce cas. C'est la sortie de secours d'une instance sans relais
 * SMTP — sans elle, ouvrir un compte deviendrait impossible et l'on retournerait
 * au mot de passe partage.
 */
export default function ComptesClient({
  initial,
  moi,
}: {
  initial: UserView[];
  /** Qui regarde. Decide de ce qui est affichable — le serveur, de ce qui est permis. */
  moi: { id: string; role: Role };
}) {
  const jeSuisSuper = can(moi.role, "admin:superuser");

  // La regle vit dans src/lib/roles.ts : elle sert aussi a l'API.
  const proposables = assignableRoles(moi.role);
  const [users, setUsers] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("importer");

  // Une seule boite pour les deux actions destructrices de cette page : voir
  // le <Dialog> pose en bas du rendu.
  const [confirmation, setConfirmation] = useState<
    { kind: "transferer-super" | "supprimer"; user: UserView } | null
  >(null);

  async function call(body: Body, key: string): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      await recharger();
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function recharger() {
    const response = await fetch("/api/admin/users");
    const data = await response.json().catch(() => ({}));
    if (data.ok) setUsers(data.users as UserView[]);
  }

  function afterInvite(email: string, data: Record<string, unknown> | null) {
    if (!data) return;
    const mail = data.mail as { delivered: boolean; transport: string; error?: string } | undefined;
    if (typeof data.link === "string") {
      setLink({ email, url: data.link });
      setNotice(
        mail?.transport === "log"
          ? "Aucun relais SMTP configuré (MAIL_TRANSPORT). Transmettre ce lien vous-même."
          : `Envoi impossible (${mail?.error ?? "cause inconnue"}). Transmettre ce lien vous-même.`
      );
    } else {
      setLink(null);
      setNotice(`Invitation envoyée à ${email}.`);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant={open ? "outline" : "solid"} onClick={() => setOpen((value) => !value)}>
          {open ? "Fermer" : "Inviter quelqu'un"}
        </Button>
      </div>

      {open ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle as="h2">Inviter quelqu&apos;un</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Adresse de courriel</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="prenom.nom@exemple.fr"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-nom">Nom affiché</Label>
                <Input
                  id="invite-nom"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Prénom Nom"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invite-role">Rôle</Label>
              {/*
                `proposables` ET NON `ROLES` : le formulaire offrait « admin » et
                « superadmin » a tout administrateur. Ce n'etait pas qu'un menu qui
                mentait — l'API les acceptait (voir api/admin/users/route.ts).
              */}
              <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                <SelectTrigger id="invite-role" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {proposables.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">{ROLE_DESCRIPTIONS[role]}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={busy !== null || email === "" || name === ""}
                onClick={async () => {
                  const data = await call({ action: "inviter", email, name, role }, "inviter");
                  if (data) {
                    afterInvite(email, data);
                    setEmail("");
                    setName("");
                    setOpen(false);
                  }
                }}
              >
                Envoyer l&apos;invitation
              </Button>
            </div>

            <p className="text-muted-foreground text-sm">
              Le compte est créé sans mot de passe : il ne devient utilisable qu&apos;une fois le lien
              d&apos;activation suivi. Le lien vaut sept jours et ne sert qu&apos;une fois.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {notice ? <p className="text-muted-foreground mb-4 text-sm">{notice}</p> : null}
      {link ? (
        <Alert variant="warning" className="mb-4">
          <Icon icon={KeyRound} size="sm" />
          <AlertTitle>
            <h2>Lien d&apos;activation pour {link.email}</h2>
          </AlertTitle>
          <AlertDescription>
            <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs break-all select-all">
              {link.url}
            </code>
            <p>
              À transmettre par un canal de confiance. Il expire, ne sert qu&apos;une fois, et émettre
              une nouvelle invitation l&apos;invalide.
            </p>
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
            <TableHead>Courriel</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>État</TableHead>
            <TableHead>Dernière connexion</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className={user.active ? undefined : "opacity-[0.55]"}>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                <code className="font-mono text-xs">{user.email}</code>
              </TableCell>
              <TableCell>
                {/*
                  UN LIBELLE FIXE DES QUE LE ROLE N'EST PAS PROPOSABLE, et non
                  pour le seul super-administrateur.

                  C'EST LA QUE SE TENAIT UN DEFAUT LIVRE. Le selecteur recevait
                  `value={user.role}` alors que « admin » etait absent de ses
                  options pour qui n'est pas super-administrateur : ne trouvant
                  pas sa valeur, le navigateur affichait LA PREMIERE OPTION. Un
                  administrateur s'affichait donc « Editeur » — sur l'ecran meme
                  qui gere les permissions, et sans que rien ne le signale.

                  Griser le champ ne suffisait pas : il ne faut pas confier une
                  valeur a un selecteur incapable de la representer.
                */}
                {proposables.includes(user.role) ? (
                  <Select
                    value={user.role}
                    disabled={busy !== null}
                    onValueChange={(value) => call({ action: "role", id: user.id, role: value }, user.id)}
                  >
                    <SelectTrigger size="sm" aria-label={`Rôle de ${user.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {proposables.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ROLE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                )}
              </TableCell>
              <TableCell>
                {!user.active ? (
                  <Badge variant="outline">désactivé</Badge>
                ) : user.has_password ? (
                  <BadgeStatus status="green">actif</BadgeStatus>
                ) : (
                  <BadgeStatus status="amber">invitation en attente</BadgeStatus>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {user.last_login_at ? new Date(user.last_login_at).toLocaleString("fr-FR") : "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!user.has_password && user.active && (jeSuisSuper || user.role !== "admin") ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={async () =>
                        afterInvite(user.email, await call({ action: "reinviter", id: user.id }, user.id))
                      }
                    >
                      Réinviter
                    </Button>
                  ) : null}

                  {user.role === "superadmin" ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy !== null || (!jeSuisSuper && user.role === "admin")}
                      onClick={() => call({ action: "actif", id: user.id, active: !user.active }, user.id)}
                    >
                      {user.active ? "Désactiver" : "Réactiver"}
                    </Button>
                  )}

                  {/*
                    TRANSMETTRE LE ROLE. Visible du seul super-administrateur, et
                    seulement vers un compte ACTIVE — confier le role le plus
                    puissant du Studio a quelqu'un qui n'a jamais suivi son lien
                    reviendrait a le confier a qui intercepte ce lien.
                  */}
                  {jeSuisSuper && user.id !== moi.id && user.active && user.has_password ? (
                    <Button
                      type="button"
                      variant="outline"
                      color="destructive"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setConfirmation({ kind: "transferer-super", user })}
                    >
                      Transmettre le rôle
                    </Button>
                  ) : null}

                  {/*
                    Supprimer n'apparait que pour un compte JAMAIS ACTIVE — le
                    serveur applique la meme regle (deleteNeverUsedUser). Un
                    compte qui a servi se desactive : ses traces dans le journal
                    des actions doivent rester lisibles.
                  */}
                  {!user.has_password && user.last_login_at === null && (jeSuisSuper || user.role !== "admin") ? (
                    <Button
                      type="button"
                      variant="outline"
                      color="destructive"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setConfirmation({ kind: "supprimer", user })}
                    >
                      Supprimer
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {jeSuisSuper ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Vous êtes <strong>super-administrateur</strong>{" "}: le seul à pouvoir accorder ou retirer le
          rôle d&apos;administrateur, et le seul à pouvoir transmettre ce rôle. Votre compte ne peut
          être ni supprimé ni désactivé — la seule sortie est la transmission, ce qui garantit
          qu&apos;il y a toujours quelqu&apos;un qui répond de l&apos;instance.
        </p>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          Gérer un compte <strong>administrateur</strong>{" "}revient au super-administrateur. Les
          actions correspondantes sont grisées ici, et refusées par le serveur — ce n&apos;est pas
          un oubli.
        </p>
      )}

      <p className="text-muted-foreground mt-2 text-sm">
        Un compte déjà activé ne se supprime pas : il se désactive. Ses traces dans le journal des
        actions doivent rester lisibles, et une désactivation ferme ses sessions immédiatement.
      </p>

      {confirmation ? (
        <Dialog
          destructive
          title={
            confirmation.kind === "transferer-super"
              ? "Transmettre le rôle de super-administrateur"
              : "Supprimer le compte"
          }
          confirmLabel={confirmation.kind === "transferer-super" ? "Transmettre" : "Supprimer"}
          busy={busy === confirmation.user.id}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            const cible = confirmation;
            await call({ action: cible.kind, id: cible.user.id }, cible.user.id);
            setConfirmation(null);
          }}
        >
          {confirmation.kind === "transferer-super" ? (
            <>
              Transmettre le rôle à <strong>{confirmation.user.email}</strong> ? Vous redeviendrez
              administrateur immédiatement, et vous ne pourrez pas revenir en arrière vous-même :
              seul le nouveau titulaire pourra vous le rendre.
            </>
          ) : (
            <>
              Supprimer définitivement le compte <strong>{confirmation.user.email}</strong>
              {" "}? Ce compte n&apos;a jamais été activé : rien n&apos;est perdu dans le journal
              des actions.
            </>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
