import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Le cadre des pages sans session (connexion, activation, mot de passe
 * oublie) : le nom du Studio et le formulaire au centre. Pas de barre
 * laterale — il n'y a aucune section ou aller.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-semibold tracking-[0.16em] uppercase">Datasheet Studio</span>
          <span className="text-muted-foreground text-xs">Composition et rendu des fiches techniques PDF</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">{children}</main>
    </div>
  );
}
