"use client";

import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@guillxume/ui/components/card";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

/**
 * Demande de reinitialisation.
 *
 * LA REPONSE EST TOUJOURS LA MEME, adresse connue ou non — la route s'en charge,
 * et ce composant se garde bien de la nuancer. Un message different selon le cas
 * ferait de ce formulaire un annuaire des comptes du parc.
 */
export default function OubliForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "oubli", email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setSent(data.message ?? "Demande enregistrée.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (sent !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Demande enregistrée
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p>{sent}</p>
          <p className="text-muted-foreground text-sm">
            Le lien est valable deux heures.{" "}
            <a className="text-primary underline underline-offset-4" href="/connexion">
              Retour à la connexion
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="oubli-email">Adresse de courriel</Label>
            <Input
              id="oubli-email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <Icon icon={CircleAlert} size="sm" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || email === ""}>
              {busy ? "Envoi…" : "Envoyer le lien"}
            </Button>
            <Button asChild variant="link">
              <a href="/connexion">Retour</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
