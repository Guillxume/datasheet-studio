"use client";

import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@guillxume/ui/components/card";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

/**
 * Choix du mot de passe, a l'arrivee sur un lien d'invitation ou de
 * reinitialisation.
 *
 * DEUX CHAMPS ET UNE COMPARAISON A L'ECRAN. La confirmation n'est pas envoyee au
 * serveur : ce qu'elle attrape — une faute de frappe dans un champ masque — se
 * voit ici et nulle part ailleurs, et la verifier deux fois ne l'attrape pas
 * mieux.
 *
 * La contrainte de longueur est affichee AVANT la saisie, pas apres l'echec.
 * L'annoncer au moment du refus est la facon la plus sure de faire recommencer
 * quelqu'un trois fois.
 */
export default function ActivationForm({ token, invitation }: { token: string; invitation: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const ready = password.length >= MIN_PASSWORD_LENGTH && confirmation === password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activation", token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      // La session est ouverte par la route : on entre directement dans l'outil.
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="text-lg">
          {invitation ? "Choisir votre mot de passe" : "Nouveau mot de passe"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="activation-password">Mot de passe ({MIN_PASSWORD_LENGTH} caractères minimum)</Label>
            <Input
              id="activation-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="activation-confirmation">Confirmation</Label>
            <Input
              id="activation-confirmation"
              type="password"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>

          {/* Controles en direct, sans role="alert" : le premier change a chaque
              frappe, et un lecteur d'ecran le relirait a chaque caractere. */}
          {tooShort ? (
            <p className="text-destructive text-sm">Encore {MIN_PASSWORD_LENGTH - password.length} caractère(s).</p>
          ) : null}
          {mismatch ? <p className="text-destructive text-sm">Les deux saisies diffèrent.</p> : null}
          {error ? (
            <Alert variant="destructive">
              <Icon icon={CircleAlert} size="sm" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !ready}>
              {busy ? "Enregistrement…" : "Enregistrer et entrer"}
            </Button>
          </div>

          <p className="text-muted-foreground text-sm">
            Une phrase de passe longue vaut mieux qu&apos;un mot court compliqué : c&apos;est la longueur
            qui résiste, pas les caractères exotiques.
          </p>
          <p className="text-muted-foreground text-sm">
            {/*
              ANNONCER LE CONTROLE AVANT LA SAISIE, et dire comment il fonctionne.
              Sans ca, l'enregistrement met deux a trois secondes sans raison
              apparente, et un refus se lit comme une accusation — « mon mot de passe
              est mauvais ? » — alors qu'il peut etre excellent et simplement avoir
              servi ailleurs.
            */}
            Le mot de passe est confronté aux fuites de données connues. Il ne quitte pas le serveur :
            seuls les cinq premiers caractères de son empreinte sont envoyés, ce qui ne permet pas de
            l&apos;identifier.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
