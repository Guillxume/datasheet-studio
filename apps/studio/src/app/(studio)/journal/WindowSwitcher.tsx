import { Button } from "@guillxume/ui/components/button";

/**
 * Fenetres de temps d'un tableau de bord — des LIENS et non des boutons :
 * chaque fenetre est une URL, donc partageable, rechargeable et navigable par
 * l'historique du navigateur. Un Button `asChild` ne prete au lien que son
 * allure : plein pour la fenetre courante, au trait pour les autres.
 */
export default function WindowSwitcher({
  options,
  value,
}: {
  options: readonly { value: number; label: string; href: string }[];
  value: number;
}) {
  return (
    <nav aria-label="Fenêtre de temps" className="mb-8 flex flex-wrap gap-1">
      {options.map((option) => {
        const current = option.value === value;
        return (
          <Button key={option.value} asChild variant={current ? "solid" : "outline"} size="sm">
            <a href={option.href} aria-current={current ? "page" : undefined}>
              {option.label}
            </a>
          </Button>
        );
      })}
    </nav>
  );
}
