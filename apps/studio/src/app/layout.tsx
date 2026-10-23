import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SettingsProvider } from "@guillxume/ui/components/settings-provider";
import { Toaster } from "@guillxume/ui/components/sonner";
import { TooltipProvider } from "@guillxume/ui/components/tooltip";
import "./globals.css";
import { SETTINGS_STORAGE_KEY, THEME_PREPAINT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Datasheet Studio",
  description: "Composition et rendu des fiches techniques PDF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * suppressHydrationWarning sur <html> : le script de pre-peinture modifie
     * cet element AVANT que React ne l'hydrate. Sans cet attribut, React signale
     * un ecart entre le HTML rendu par le serveur et celui trouve dans le
     * document — un ecart qui est ici voulu et qui ne concerne que <html>.
     */
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/*
          La clef et le script viennent de src/lib/theme.ts, un module SANS
          directive « use client ». Ce detail est le correctif d'un defaut
          livre : importee d'un module client, la clef valait `undefined` cote
          serveur et le script lisait `localStorage.getItem(undefined)`. Ni tsc
          ni next build ne le signalaient.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT_SCRIPT }} />
      </head>
      <body>
        <SettingsProvider storageKey={SETTINGS_STORAGE_KEY}>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
