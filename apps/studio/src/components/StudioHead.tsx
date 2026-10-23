import SectionHead from "@/components/SectionHead";

/**
 * LE TITRE DE TOUTE PAGE DU STUDIO : le seul <h1> de la page.
 *
 * Le cadre (barre laterale, en-tete, menu utilisateur) vient du layout du
 * groupe (studio) ; ce composant ne pose plus que le titre. Il reste present
 * dans chaque page (verifie par sections.test.ts) : c'est lui que lisent les
 * lecteurs d'ecran et les parcours e2e pour savoir ou l'on est.
 */
export default function StudioHead({
  title,
  aside,
}: {
  title: string;
  /** Un decompte pousse a droite du titre de page. Jamais une action. */
  aside?: string;
}) {
  return <SectionHead as="h1" title={title} aside={aside} />;
}
