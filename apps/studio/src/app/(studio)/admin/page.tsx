import { isFeedbackActive } from "@/lib/feedbackSettings";
import { requirePage } from "@/lib/guard";
import { mailTransport } from "@/lib/mailer";
import { listShopsForAdmin } from "@/lib/shopsAdmin";
import { can, ROLE_LABELS } from "@/lib/roles";
import {
  currentSuperadmin,
  listUsers,
  purgeLoginAttemptsSiNecessaire,
  readAudit,
  readLoginFailures,
} from "@/lib/users";
import CourrielStatus from "./CourrielStatus";
import RetoursToggle from "./RetoursToggle";
import StudioHead from "@/components/StudioHead";
import SectionHead from "@/components/SectionHead";
import { Badge } from "@guillxume/ui/components/badge";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Button } from "@guillxume/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@guillxume/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";

export const dynamic = "force-dynamic";

/**
 * Accueil de l'administration.
 *
 * TROIS CHOSES ET RIEN D'AUTRE : ou aller, ce qui n'est pas configure, et qui a
 * fait quoi. Le journal des actions est ici plutot que sur sa propre page parce
 * qu'il ne se consulte jamais pour lui-meme — on y va apres avoir constate
 * qu'un template a disparu ou qu'une cle ne marche plus, c'est-a-dire en
 * passant par cette page.
 */

const ACTIONS: Record<string, string> = {
  "compte.invite": "a invité",
  "compte.reinvite": "a réinvité",
  "compte.role-change": "a changé le rôle de",
  "compte.desactive": "a désactivé",
  "compte.reactive": "a réactivé",
  "compte.supprime": "a supprimé le compte",
  "compte.mot-de-passe-defini": "a défini son mot de passe",
  "compte.verrouille": "a été verrouillé après dix échecs :",
  "super.transfere": "a transmis le rôle de super-administrateur à",
  "compte.reinitialisation-demandee": "a demandé une réinitialisation pour",
  "boutique.creee": "a créé la boutique",
  "boutique.configuree": "a configuré la boutique",
  "boutique.cle-tournee": "a fait tourner la clé de",
  "boutique.desactivee": "a désactivé la boutique",
  "boutique.reactivee": "a réactivé la boutique",
  "courriel.test": "a envoyé un courriel de test à",
  "template.supprime": "a supprimé le template",
  "template.cree": "a créé le template",
  "template.duplique": "a dupliqué un template vers",
  "template.publie": "a publié le template",
  "composant.cree": "a créé le composant",
  "composant.publie": "a publié le composant",
  "image.televersee": "a téléversé l’image",
  "image.supprimee": "a supprimé l’image",
  "regles.creee": "a créé une règle pour la boutique",
  "regles.supprimee": "a supprimé une règle de la boutique",
  "regles.defaut": "a changé le template par défaut de",
  "consultation.categorie-masquee": "a masqué de la consultation, pour la boutique",
  "consultation.categorie-affichee": "a réaffiché dans la consultation, pour la boutique",
  "consultation.fiche-masquee": "a masqué des fiches de la consultation, pour la boutique",
  "consultation.fiche-affichee": "a réaffiché des fiches dans la consultation, pour la boutique",
  "composant.applique": "a appliqué aux en-têtes ou pieds de page le composant",
  "retours.active": "a activé les retours",
  "retours.desactive": "a désactivé les retours",
  "retour.envoye": "a envoyé un retour",
};

/** Code en ligne : une cle, un chemin, une variable d'environnement. */
const CODE = "bg-muted px-1 font-mono text-xs";

export default async function AdminPage() {
  const moi = await requirePage("admin:users");

  // Purge opportuniste de la table des tentatives : voir src/lib/users.ts.
  purgeLoginAttemptsSiNecessaire();

  const [users, shops, entries, echecs, superadmin, retoursActifs] = await Promise.all([
    listUsers(),
    listShopsForAdmin(),
    readAudit(60),
    readLoginFailures(24),
    currentSuperadmin(),
    isFeedbackActive(),
  ]);

  const attente = users.filter((user) => user.active && !user.has_password).length;
  const sansCle = shops.filter((shop) => shop.active && shop.api_key_last_used_at === null).length;
  const transport = mailTransport();

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Administration" />

      {/*
        LE COURRIEL A SA PROPRE TUILE, en tete de page. Ce n'est pas un detail
        d'affichage : quand il n'est pas configure, chaque ouverture de compte
        demande a un administrateur de transmettre un lien a la main. C'est la
        premiere chose a regler sur une instance neuve, donc la premiere qu'on
        doit voir.
      */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle as="h2">Courriel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {transport === "log" ? (
            <p>
              <BadgeStatus status="amber">non configuré</BadgeStatus> <code className={CODE}>MAIL_TRANSPORT</code>{" "}
              vaut <code className={CODE}>log</code>{" "}: les invitations ne partent pas, leur lien
              s&apos;affiche à l&apos;écran pour être transmis à la main. Ça marche, mais ça ne passe
              pas l&apos;échelle. Les variables à poser sont dans{" "}
              <code className={CODE}>docs/comptes-et-roles.md</code>{" "}§5.
            </p>
          ) : (
            <p>
              Relais SMTP configuré. Les deux contrôles ci-dessous ne disent pas la même chose :
              l&apos;un ouvre la connexion, l&apos;autre éprouve l&apos;adresse d&apos;expédition.
            </p>
          )}
          <CourrielStatus transport={transport} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Comptes</CardTitle>
            <CardDescription>
              {users.filter((user) => user.active).length} actif(s)
              {attente > 0 ? `, ${attente} invitation(s) en attente` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/*
              L'ABSENCE DE SUPER-ADMINISTRATEUR EST SIGNALEE. C'est un etat
              possible — la migration 007 ne promeut personne si aucun compte n'est
              active — et il est invisible autrement : tout fonctionne, sauf que
              plus personne ne peut accorder le role d'administrateur.
            */}
            <p className="text-muted-foreground text-sm">
              {superadmin === null ? (
                <>
                  <BadgeStatus status="amber">aucun super-administrateur</BadgeStatus>{" "}Personne
                  ne peut accorder le rôle d&apos;administrateur. Le désigner avec{" "}
                  <code className={CODE}>pnpm superadmin courriel</code>.
                </>
              ) : (
                <>
                  {ROLE_LABELS.superadmin} : <strong className="text-foreground">{superadmin.email}</strong>
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/admin/comptes">Gérer les comptes</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Boutiques</CardTitle>
            <CardDescription>
              {shops.filter((shop) => shop.active).length} active(s)
              {sansCle > 0 ? `, ${sansCle} dont la clé n'a jamais servi` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/admin/boutiques">Clés API et réglages</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Retours</CardTitle>
          </CardHeader>
          <CardContent>
            {can(moi.role, "admin:superuser") ? (
              <RetoursToggle active={retoursActifs} />
            ) : (
              <p className="text-muted-foreground text-sm">
                {retoursActifs ? (
                  <BadgeStatus status="green">activés</BadgeStatus>
                ) : (
                  <BadgeStatus status="amber">désactivés</BadgeStatus>
                )}{" "}
                Seul le super-administrateur peut changer ce réglage.
              </p>
            )}
          </CardContent>
        </Card>

        {/*
          TENTATIVES ECHOUEES — la tuile qui manquait.
          `recordLoginFailure` incrementait un compteur sur le compte et ne
          laissait AUCUNE trace : quatre cents tentatives dans la nuit sur six
          comptes ne se voyaient nulle part. Sur une URL publique, c'est la
          premiere chose qu'un administrateur doit pouvoir regarder.
        */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Tentatives échouées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {echecs.total === 0 ? (
              <p>Aucune sur les 24 dernières heures.</p>
            ) : (
              <p>
                <strong className="tabular-nums">{echecs.total}</strong> sur 24 h, depuis {echecs.ips}{" "}
                adresse(s) IP, sur {echecs.comptes} identifiant(s).
                {echecs.derniere ? ` Dernière : ${new Date(echecs.derniere).toLocaleString("fr-FR")}.` : ""}
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              Un chiffre à trois ou quatre zéros venu de quelques IP, c'est un robot : les tentatives
              sont plafonnées par Traefik et chaque compte se verrouille au dixième échec. Un chiffre
              bas et dispersé, c'est l'équipe qui se trompe de mot de passe.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Brancher un back-office</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p>
              Ajouter un bouton « Fiche technique » dans Medusa ou un PIM, à l&apos;unité et en masse.
            </p>
            <p className="text-muted-foreground text-sm">
              La marche à suivre, avec le code à coller : <code className={CODE}>docs/bouton-back-office.md</code>.
            </p>
          </CardContent>
        </Card>
      </div>

      <SectionHead title="Journal des actions" />
      <p className="text-muted-foreground mb-4">
        Qui a ouvert un compte, changé un rôle, fait tourner une clé, supprimé un template. Le
        journal des <em>rendus</em>, lui, est{" "}
        <a href="/journal" className="text-primary underline underline-offset-4">
          ailleurs
        </a>{" "}
        : celui-ci ne parle que des personnes.
      </p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune action enregistrée pour l&apos;instant.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quand</TableHead>
              <TableHead>Qui</TableHead>
              <TableHead>Quoi</TableHead>
              <TableHead>Sur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="tabular-nums">{new Date(entry.created_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell>{entry.actor_email ?? <Badge variant="outline">système</Badge>}</TableCell>
                <TableCell>{ACTIONS[entry.action] ?? entry.action}</TableCell>
                <TableCell className="whitespace-normal">
                  <code className={CODE}>{entry.target ?? "—"}</code>
                  {entry.detail ? (
                    <span className="text-muted-foreground text-sm">
                      {" "}
                      {Object.entries(entry.detail)
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join(" ")}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
