"use client";

import { AppHeader } from "@guillxume/ui/components/app-header";
import { AppSidebar, type AppNavItem } from "@guillxume/ui/components/app-sidebar";
import { Icon } from "@guillxume/ui/components/icon";
import { SidebarHeader, SidebarInset, SidebarProvider } from "@guillxume/ui/components/sidebar";
import { UserMenu } from "@guillxume/ui/components/user-menu";
import {
  Activity,
  BookOpen,
  FileStack,
  FileText,
  Images,
  ListTree,
  type LucideIcon,
  MessageSquare,
  Settings,
  Upload,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { seDeconnecter } from "@/lib/deconnexion";
import type { SectionKey } from "@/lib/sections";

/**
 * LE CADRE DU STUDIO : barre laterale, en-tete et menu utilisateur du design
 * system partage, comme dans les autres outils internes.
 *
 * Le serveur decide de ce que la personne voit (sections filtrees par role,
 * compteurs) ; ce composant ne fait qu'afficher. Les icones sont choisies ICI
 * et non par le serveur : une fonction ne traverse pas la frontiere serveur /
 * client.
 */

/** Ce que le layout serveur transmet d'une section : des donnees, rien d'executable. */
export type ShellSection = { key: SectionKey; href: string; label: string };

const ICONES: Record<SectionKey, LucideIcon> = {
  templates: FileText,
  regles: ListTree,
  import: Upload,
  images: Images,
  consultation: FileStack,
  journal: Activity,
  documentation: BookOpen,
  retours: MessageSquare,
  admin: Settings,
};

/** Rangees en bas de la barre : ce qui ne sert pas a produire des fiches. */
const SECONDAIRES: readonly SectionKey[] = ["documentation", "retours", "admin"];

export default function StudioShell({
  sections,
  user,
  counters,
  sidebarOpen,
  children,
}: {
  sections: ShellSection[];
  user: { name: string; detail: string };
  counters: { templates: number; published: number; shops: number } | null;
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const item = (section: ShellSection): AppNavItem => ({
    title: section.label,
    href: section.href,
    icon: ICONES[section.key],
  });
  const nav = {
    main: sections.filter((s) => !SECONDAIRES.includes(s.key)).map(item),
    secondary: sections.filter((s) => SECONDAIRES.includes(s.key)).map(item),
  };

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        nav={nav}
        header={
          <SidebarHeader className="p-4">
            <Link href="/" className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
              <span className="font-mono text-sm font-semibold tracking-[0.16em] uppercase">Datasheet Studio</span>
              <span className="text-muted-foreground text-xs">Fiches techniques PDF</span>
            </Link>
          </SidebarHeader>
        }
        pathname={pathname}
        search=""
        linkComponent={Link}
        onMobileNavigate={(href) => router.push(href)}
        labels={{
          mainGroup: "Studio",
          secondaryGroup: "Suivi",
          sidebarTitle: "Navigation",
          sidebarDescription: "Sections du Studio",
          toggleSidebar: "Afficher ou masquer la navigation",
          mobileNavBackToNavigation: "Retour à la navigation",
          mobileNavBackToItem: (title) => `Retour à ${title}`,
        }}
      />
      <SidebarInset>
        <AppHeader
          labels={{ toggleSidebar: "Afficher ou masquer la navigation" }}
          actions={
            <UserMenu
              trigger={<Icon icon={UserRound} size="sm" />}
              user={user}
              onSignOut={seDeconnecter}
              labels={{
                menu: "Menu utilisateur",
                appearance: "Apparence",
                light: "Clair",
                dark: "Sombre",
                system: "Système",
                signOut: "Sortir",
              }}
            />
          }
        >
          {counters ? (
            <dl className="text-muted-foreground flex gap-4 text-xs">
              <Compteur label="Templates" valeur={counters.templates} />
              <Compteur label="Publiés" valeur={counters.published} />
              <Compteur label="Boutiques" valeur={counters.shops} />
            </dl>
          ) : null}
        </AppHeader>
        <div className="flex-1 px-4 py-6 md:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Compteur({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="text-foreground font-mono font-medium tabular-nums">{String(valeur).padStart(2, "0")}</dd>
    </div>
  );
}
