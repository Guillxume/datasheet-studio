"use client";

import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { BadgeStatus } from "@guillxume/ui/components/badge-status";
import { Button } from "@guillxume/ui/components/button";
import { Icon } from "@guillxume/ui/components/icon";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

type Diagnostic = { cause: string; regarder?: string; brut: string };

type Resultat =
  | { genre: "verification"; joignable: boolean; transport: string; diagnostic?: Diagnostic }
  | { genre: "test"; delivre: boolean; destinataire: string; transport: string; diagnostic?: Diagnostic };

/**
 * Eprouver le relais de courriel, depuis la page d'administration.
 *
 * DEUX BOUTONS, PARCE QUE LES DEUX CONTROLES NE DISENT PAS LA MEME CHOSE.
 * « Verifier » ouvre la connexion et s'authentifie sans envoyer : il isole la
 * moitie basse du probleme (hote, port, TLS, identifiants). « Envoyer un test »
 * fait partir un vrai message : c'est le seul qui couvre l'adresse d'expedition
 * et le routage — un relais peut nous authentifier puis refuser notre MAIL_FROM.
 *
 * Le diagnostic affiche porte la cause EN FRANCAIS, le champ a regarder, et le
 * message SMTP d'origine — ce dernier parce que c'est lui qu'on colle dans un
 * ticket au fournisseur du relais.
 */
export default function CourrielStatus({ transport }: { transport: "smtp" | "log" }) {
  const [busy, setBusy] = useState<"verifier" | "test" | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function appeler(action: "verifier" | "test") {
    setBusy(action);
    setError(null);
    setResultat(null);

    try {
      const response = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setResultat(
        action === "verifier"
          ? {
              genre: "verification",
              joignable: data.joignable === true,
              transport: String(data.transport),
              diagnostic: data.diagnostic,
            }
          : {
              genre: "test",
              delivre: data.delivre === true,
              destinataire: String(data.destinataire),
              transport: String(data.transport),
              diagnostic: data.diagnostic,
            }
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => appeler("verifier")}
        >
          {busy === "verifier" ? "Vérification…" : "Vérifier le relais"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => appeler("test")}
        >
          {busy === "test" ? "Envoi…" : "M'envoyer un courriel de test"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {resultat?.genre === "verification" ? (
        resultat.joignable ? (
          <p className="text-muted-foreground text-sm">
            <BadgeStatus status="green">relais joignable</BadgeStatus>{" "}Connexion, TLS et
            authentification acceptés. Il reste à éprouver l&apos;adresse d&apos;expédition :
            envoyer un test.
          </p>
        ) : (
          <Panne diagnostic={resultat.diagnostic} />
        )
      ) : null}

      {resultat?.genre === "test" ? (
        resultat.delivre ? (
          <p className="text-muted-foreground text-sm">
            <BadgeStatus status="green">envoyé</BadgeStatus> Message remis au relais, à destination
            de <code className={CODE}>{resultat.destinataire}</code>.{" "}
            {/* « Remis au relais » et non « recu » : ce qui se passe ensuite —
                filtre antispam, boite pleine — nous echappe, et le dire evite de
                chercher une panne de configuration qui n'existe pas. */}
            S&apos;il n&apos;arrive pas, regarder les indésirables et les journaux du relais : de
            notre côté, il est parti.
          </p>
        ) : (
          <Panne diagnostic={resultat.diagnostic} />
        )
      ) : null}

      {transport === "log" && resultat === null ? (
        <p className="text-muted-foreground text-sm">
          En mode <code className={CODE}>log</code>, « Vérifier » dira simplement que rien
          n&apos;est envoyé. Les deux boutons ne servent qu&apos;une fois{" "}
          <code className={CODE}>MAIL_TRANSPORT=smtp</code> pose.
        </p>
      ) : null}
    </>
  );
}

/** Code en ligne : un champ, une adresse. */
const CODE = "bg-muted px-1 font-mono text-xs";

/**
 * Le diagnostic d'une panne. Le message SMTP brut reste affiche en entier et
 * selectionnable : c'est lui qu'on colle dans un ticket au fournisseur.
 */
function Panne({ diagnostic }: { diagnostic?: Diagnostic }) {
  if (!diagnostic) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Échec, sans détail.
      </p>
    );
  }

  return (
    <Alert variant="destructive">
      <Icon icon={CircleAlert} size="sm" />
      <AlertDescription>
        <p className="font-medium">{diagnostic.cause}</p>
        {diagnostic.regarder ? (
          <p>
            À regarder dans le <code className={CODE}>.env</code> :{" "}
            <code className={CODE}>{diagnostic.regarder}</code>
          </p>
        ) : null}
        <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs break-all select-all">
          {diagnostic.brut}
        </code>
        <p>
          Le message d&apos;origine ci-dessus est ce qu&apos;il faut transmettre au fournisseur du
          relais si la cause n&apos;est pas de notre côté.
        </p>
      </AlertDescription>
    </Alert>
  );
}
