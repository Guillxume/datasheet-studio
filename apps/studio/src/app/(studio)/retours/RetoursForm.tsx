"use client";

import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@guillxume/ui/components/card";
import { Icon } from "@guillxume/ui/components/icon";
import { Label } from "@guillxume/ui/components/label";
import { Textarea } from "@guillxume/ui/components/textarea";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

const MAX = 2000;

/**
 * Le nom et l'adresse de la personne ne se saisissent pas : ils viennent de sa
 * session (voir requireApi("feedback:send") cote route), exactement comme le
 * courriel de test de /admin n'accepte pas de destinataire libre — un champ
 * libre ferait porter a n'importe qui l'identite jointe au retour.
 */
export default function RetoursForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState<{ delivre: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/retours", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setEnvoye({ delivre: data.delivre === true });
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (envoye) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Retour envoyé
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p>Merci — il a bien été transmis.</p>
          {!envoye.delivre ? (
            <p className="text-muted-foreground text-sm">
              Le courriel n&apos;a pas pu être remis à l&apos;instant, mais rien n&apos;est perdu : le
              retour reste dans le journal des actions, sur /admin.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEnvoye(null)}>
              Envoyer un autre retour
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="retour-message">Votre retour</Label>
            <Textarea
              id="retour-message"
              // field-sizing du Textarea : `rows` ne suffit plus a donner la hauteur de depart.
              className="min-h-40"
              rows={8}
              required
              maxLength={MAX}
              autoFocus
              placeholder="Ce qui fonctionne, ce qui manque, ce qui bloque…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="text-muted-foreground text-sm">{MAX - message.length} caractère(s) restant(s).</p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <Icon icon={CircleAlert} size="sm" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || message.trim() === ""}>
              {busy ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
