"use client";

import { Alert, AlertDescription } from "@guillxume/ui/components/alert";
import { Button } from "@guillxume/ui/components/button";
import { Card, CardContent } from "@guillxume/ui/components/card";
import { Icon } from "@guillxume/ui/components/icon";
import { Input } from "@guillxume/ui/components/input";
import { Label } from "@guillxume/ui/components/label";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

/**
 * Formulaire de connexion.
 *
 * UN <form> ET UN submit, pas deux champs et un bouton `onClick` : c'est ce qui
 * fait fonctionner la touche Entree, le remplissage automatique des
 * gestionnaires de mots de passe (qui cherchent un formulaire, pas des champs
 * isoles) et l'annonce du contexte par les lecteurs d'ecran.
 *
 * `window.location.assign` PLUTOT QUE le routeur : apres connexion, tout le
 * contenu deja rendu est perime — la barre de session, la liste des templates,
 * les onglets ouverts a ce role. Un rechargement complet est ici la reponse
 * juste, pas un raccourci.
 */
export default function ConnexionForm({ suite }: { suite: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ action: "connexion", email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      window.location.assign(suite);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  /*
   * Pas de titre dans la carte : le <h1> de la page dit « Connexion », et deux
   * fois le meme mot a deux rangs de titre differents brouille le plan du
   * document au lieu de le poser.
   */
  return (
    <Card>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="connexion-email">Adresse de courriel</Label>
            <Input
              id="connexion-email"
              type="email"
              name="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="connexion-password">Mot de passe</Label>
            <Input
              id="connexion-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <Icon icon={CircleAlert} size="sm" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || email === "" || password === ""}>
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
            <Button asChild variant="link">
              <a href="/mot-de-passe-oublie">Mot de passe oublié</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
