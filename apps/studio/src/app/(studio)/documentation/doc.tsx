import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@guillxume/ui/components/alert";
import { Heading } from "@guillxume/ui/components/heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@guillxume/ui/components/table";
import SectionHead from "@/components/SectionHead";

/**
 * Les briques de la page Documentation : un vocabulaire de mise en forme court,
 * pour que les chapitres se lisent comme du texte et non comme du balisage.
 *
 * Composants serveur, sans etat : la documentation est un document, elle ne
 * fait rien. Tout vient du design system partage ; rien n'est dessine ici.
 */

/**
 * Typographie francaise : espace insecable avant « : ; ! ? » et a l'interieur
 * des guillemets, pour qu'un retour a la ligne ne laisse jamais un deux-points
 * seul en debut de ligne. Appliquee a tout le texte d'un chapitre, sauf au code
 * (tokens, CSS), qui se copie tel quel.
 */
const NBSP = "\u00a0";

function typographie(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return node.replace(/ ([:;!?»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
  }
  if (Array.isArray(node)) return Children.map(node, typographie);
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode; rows?: ReactNode[][] }>;
    if (element.type === Code || element.type === "pre" || element.type === "code") return node;
    const props: { children?: ReactNode; rows?: ReactNode[][] } = {};
    if (element.props.children !== undefined) props.children = typographie(element.props.children);
    // Les cellules d'un DocTable sont une prop, pas des enfants.
    if (element.type === DocTable && element.props.rows) {
      props.rows = element.props.rows.map((row) => row.map((cell) => typographie(cell)));
    }
    return Object.keys(props).length > 0 ? cloneElement(element, props) : node;
  }
  return node;
}

/** Un chapitre : un titre numerote, une ancre pour le sommaire. */
export function Chapter({ id, no, title, children }: { id: string; no: string; title: string; children: ReactNode }) {
  return (
    // scroll-mt : l'ancre ne doit pas laisser le titre sous le bord haut.
    <section id={id} aria-labelledby={`${id}-titre`} className="scroll-mt-6">
      <div id={`${id}-titre`}>
        <SectionHead no={no} title={title} />
      </div>
      {/* flex et non grid : la colonne implicite d'une grille prend la largeur
          minimale de son contenu le plus large (un tableau), et la page debordait
          de 76 px sur un telephone. */}
      <div className="flex min-w-0 flex-col gap-4">{typographie(children)}</div>
    </section>
  );
}

/** Une sous-partie de chapitre. */
export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex min-w-0 flex-col gap-3">
      <Heading as="h3" size="base">
        {title}
      </Heading>
      {children}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="m-0 max-w-[72ch] text-[15px] leading-7">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex max-w-[72ch] min-w-0 list-disc flex-col gap-1.5 pl-5 text-[15px] leading-7">{children}</ul>;
}

/** Une marche a suivre : etapes numerotees, dans l'ordre. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="m-0 flex max-w-[72ch] min-w-0 list-none flex-col gap-2.5 p-0 text-[15px] leading-7 [counter-reset:etape]">
      {children}
    </ol>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return (
    <li className="relative min-w-0 pl-9 [counter-increment:etape] before:absolute before:top-0.5 before:left-0 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:border before:text-xs before:font-semibold before:tabular-nums before:content-[counter(etape)]">
      {children}
    </li>
  );
}

/** Un libelle tel qu'il apparait a l'ecran : bouton, onglet, champ. */
export function Ui({ children }: { children: ReactNode }) {
  return <strong className="font-semibold">«{NBSP}{children}{NBSP}»</strong>;
}

/** Un token, une cle, une URL : ce qu'on tape ou copie tel quel. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em] break-words">{children}</code>;
}

/** Une touche du clavier — meme dessin que le Kbd du design system. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground shadow-border/50 inline-flex min-w-5 items-center justify-center rounded border px-1.5 py-0.5 font-sans text-xs leading-none shadow-[0_1px_0_1px]">
      {children}
    </kbd>
  );
}

/** Un encadre : a savoir (info), attention (warning), bonne pratique (success). */
export function Note({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warning" | "success";
  title?: string;
  children: ReactNode;
}) {
  return (
    <Alert variant={kind} className="max-w-[72ch]">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>
        <div className="grid gap-2 text-[14px] leading-6">{children}</div>
      </AlertDescription>
    </Alert>
  );
}

/** Un tableau simple : en-tetes, puis des lignes de cellules. */
export function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <Table className="text-[14px]">
        <TableHeader>
          <TableRow>
            {head.map((cell) => (
              <TableHead key={cell}>{cell}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, column) => (
                <TableCell key={column} className="align-top whitespace-normal">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
