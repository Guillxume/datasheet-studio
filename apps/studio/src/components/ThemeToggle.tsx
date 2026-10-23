"use client";

import { Button } from "@guillxume/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@guillxume/ui/components/dropdown-menu";
import { Icon } from "@guillxume/ui/components/icon";
import { useSettings } from "@guillxume/ui/hooks/use-settings";
import { Monitor, Moon, Sun } from "lucide-react";

/**
 * Bascule clair / sombre / systeme, pour l'editeur : il occupe tout l'ecran
 * sans le menu utilisateur du cadre. Ailleurs, c'est ce menu qui la porte.
 * Le choix est celui du SettingsProvider, partage avec le reste du Studio.
 */
const CHOIX = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useSettings();
  const actuel = CHOIX.find((choix) => choix.value === theme) ?? CHOIX[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Thème : ${actuel.label}`}>
          <Icon icon={actuel.icon} size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
          {CHOIX.map((choix) => (
            <DropdownMenuRadioItem key={choix.value} value={choix.value}>
              <Icon icon={choix.icon} size="sm" />
              {choix.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
