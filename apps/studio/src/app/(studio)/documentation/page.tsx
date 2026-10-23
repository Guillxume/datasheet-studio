import { requirePage } from "@/lib/guard";
import StudioHead from "@/components/StudioHead";
import { Key } from "./doc";
import { Accueil, Bienvenue, Images, PriseEnMain } from "./chapitres-demarrer";
import { Blocs, Composer, Donnees, Editeur } from "./chapitres-composer";
import {
  Bandeaux,
  Composants,
  FeuilleDeStyle,
  Import,
  MiseEnPage,
  Pieges,
  Publier,
  Regles,
  Suivi,
} from "./chapitres-publier";

/**
 * Documentation du Studio, pour l'equipe qui compose les templates, televerse
 * les pictos et importe les catalogues.
 *
 * DANS LE STUDIO ET NON DANS docs/ : docs/ s'adresse a qui developpe et heberge
 * le Studio ; cette page, a qui s'en sert. Elle est la ou se pose la question,
 * a un clic du menu, et elle suit les deploiements — une documentation a part
 * decrirait vite des ecrans qui n'existent plus.
 *
 * Tous les roles sauf le commercial (docs:read) : elle decrit des ecrans qu'il
 * ne voit pas.
 *
 * Une seule page, et non une par chapitre : on y cherche avec Ctrl+F, et le
 * sommaire suffit a s'y deplacer.
 */

export const metadata = { title: "Documentation — Datasheet Studio" };

const CHAPITRES = [
  { id: "bienvenue", no: "01", title: "Le Studio en une minute" },
  { id: "prise-en-main", no: "02", title: "Prise en main" },
  { id: "images", no: "03", title: "La bibliothèque d'images" },
  { id: "templates", no: "04", title: "Templates et composants" },
  { id: "editeur", no: "05", title: "Le tour de l'éditeur" },
  { id: "composer", no: "06", title: "Composer une fiche" },
  { id: "blocs", no: "07", title: "Les blocs" },
  { id: "donnees", no: "08", title: "Les données du produit" },
  { id: "mise-en-page", no: "09", title: "Mise en page et pagination" },
  { id: "en-tete-pied", no: "10", title: "En-tête et pied de page" },
  { id: "feuille-de-style", no: "11", title: "Feuille de style et polices" },
  { id: "composants", no: "12", title: "Les composants" },
  { id: "publier", no: "13", title: "Vérifier, puis publier" },
  { id: "regles", no: "14", title: "Règles" },
  { id: "import", no: "15", title: "Importer un catalogue" },
  { id: "suivi", no: "16", title: "Consultation, book et journal" },
  { id: "pieges", no: "17", title: "Pièges et aide-mémoire" },
] as const;

function Sommaire({ className }: { className?: string }) {
  return (
    <nav aria-label="Sommaire" className={className}>
      <p className="text-muted-foreground m-0 mb-2 text-xs font-semibold tracking-wider uppercase">Sommaire</p>
      <ol className="m-0 grid list-none gap-0.5 p-0 text-sm">
        {CHAPITRES.map((chapitre) => (
          <li key={chapitre.id}>
            <a
              href={`#${chapitre.id}`}
              className="hover:bg-foreground/[0.06] text-foreground/90 hover:text-foreground flex gap-2 rounded-md px-2 py-1 no-underline"
            >
              <span className="text-muted-foreground font-mono text-xs tabular-nums leading-5">{chapitre.no}</span>
              <span>{chapitre.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default async function DocumentationPage() {
  await requirePage("docs:read");

  return (
    <main className="mx-auto w-full max-w-6xl">
      <StudioHead title="Documentation" />

      <p className="text-muted-foreground m-0 mb-6 max-w-[72ch] text-[15px] leading-7">
        Le mode d’emploi du Studio, pour qui compose les templates, téléverse les pictos et importe les
        catalogues. À lire dans l’ordre la première fois ; ensuite, le sommaire et la recherche du navigateur
        (<Key>Ctrl</Key> + <Key>F</Key>, ou <Key>⌘</Key> + <Key>F</Key>) suffisent.
      </p>

      {/* Sur un ecran etroit, le sommaire precede le texte ; sur un grand, il le
          suit en marge, fixe pendant la lecture. */}
      <Sommaire className="bg-card mb-8 rounded-lg border p-3 lg:hidden" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="flex min-w-0 flex-col gap-10">
          <Bienvenue />
          <PriseEnMain />
          <Images />
          <Accueil />
          <Editeur />
          <Composer />
          <Blocs />
          <Donnees />
          <MiseEnPage />
          <Bandeaux />
          <FeuilleDeStyle />
          <Composants />
          <Publier />
          <Regles />
          <Import />
          <Suivi />
          <Pieges />
        </article>

        <Sommaire className="sticky top-6 hidden max-h-[calc(100vh-3rem)] self-start overflow-y-auto lg:block" />
      </div>
    </main>
  );
}
