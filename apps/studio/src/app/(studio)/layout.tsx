import { cookies } from "next/headers";
import type { ReactNode } from "react";
import StudioShell from "@/components/StudioShell";
import { isFeedbackActive } from "@/lib/feedbackSettings";
import { requirePage } from "@/lib/guard";
import { studioCounters } from "@/lib/repository";
import { ROLE_LABELS } from "@/lib/roles";
import { sectionsFor } from "@/lib/sections";

/**
 * Le cadre des pages connectees. Il ne remplace pas le controle d'acces de
 * chaque page (requirePage(capacite) y reste) : il exige seulement une
 * session, pour savoir quoi montrer dans la barre laterale.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const user = await requirePage();
  const [counters, feedbackActive, store] = await Promise.all([studioCounters(), isFeedbackActive(), cookies()]);

  const sections = sectionsFor(user.role)
    .filter((section) => section.key !== "retours" || feedbackActive)
    .map(({ key, href, label }) => ({ key, href, label }));

  return (
    <StudioShell
      sections={sections}
      user={{ name: user.name, detail: `${user.email} · ${ROLE_LABELS[user.role]}` }}
      counters={counters}
      // Meme cookie que celui ecrit par le SidebarProvider : la barre s'affiche
      // d'emblee dans l'etat laisse, sans s'ouvrir puis se replier.
      sidebarOpen={store.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </StudioShell>
  );
}
