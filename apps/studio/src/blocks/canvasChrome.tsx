import type { CSSProperties, ReactNode } from "react";

/**
 * Chassis du canvas de l'editeur : la page telle qu'elle sera imprimee.
 *
 * POURQUOI CE FICHIER EXISTE. Le canvas ne portait aucune geometrie. Puck etant
 * monte avec `iframe: { enabled: false }`, il force la largeur du canvas a
 * `100%` et ignore purement et simplement les `viewports` declares — verifie
 * dans son code : la largeur du viewport n'est appliquee que lorsque l'iframe est
 * active, et les controles de viewport ne sont meme pas rendus. Le canvas faisait
 * donc la largeur de la fenetre du navigateur. Un bloc reglé sur « 90 mm » ou
 * « 100 % du conteneur » n'avait aucun rapport de taille avec la page A4 du PDF,
 * et le seul repere de pagination — des lignes tous les `contentMm` — se calait
 * sur cette largeur arbitraire.
 *
 * Ici, la geometrie est exprimee en MILLIMETRES. Le navigateur et le Chromium de
 * Gotenberg convertissent tous deux 1 mm en 96/25,4 px : une surface de 210 mm de
 * large dans le canvas fait donc exactement la largeur d'une page A4 du PDF, et
 * les hauteurs mesurees a l'ecran sont celles de l'impression.
 *
 * AUCUN HOOK ICI. Ce module est importe par le registry, lui-meme importe par le
 * chemin de rendu serveur, qui charge sa propre instance de React — voir
 * src/lib/render.tsx. Ces composants ne sont jamais rendus dans un PDF (ils
 * exigent `puck.isEditing`), mais ils doivent rester traversables.
 */

const mm = (value: number): string => `${value}mm`;

/**
 * Zone de contenu d'une page — la MEME dans le canvas et dans le PDF.
 *
 * Tout vient de variables CSS posees par la racine (voir son `render` dans
 * registry.tsx) : le bloc `Page` n'a pas acces aux reglages de la racine, et une
 * variable traverse la ou une prop ne passe pas. Les valeurs de repli sont les
 * defauts de la racine, pour qu'une page rendue hors de son contexte reste
 * lisible plutot que collapse.
 */
export const pageContentStyle: CSSProperties = {
  paddingLeft: "var(--ds-pad-left, 12mm)",
  paddingRight: "var(--ds-pad-right, 12mm)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ds-block-gap, 4mm)",
  position: "relative",
  minHeight: "var(--ds-page-content, 243mm)",
};

/**
 * Nombre de rubans de debordement poses d'avance PAR PAGE. Les inutiles sont
 * rognes. Douze : une page qui deborde de plus de douze feuilles n'a plus
 * besoin d'etre comptee, elle a besoin d'etre refaite — et ces rubans sont
 * desormais multiplies par le nombre de pages du document.
 */
const MAX_PAGE_MARKERS = 12;

export type CanvasMeta = {
  /** Zone en cours d'edition. Transmise par <Puck metadata>. */
  zone?: string;
  /** Hauteur reservee a la zone repetee en cours d'edition. */
  reservedMm?: number;
  /** Geometrie de page, lue sur la racine du CORPS meme en editant un bandeau. */
  pageWidth?: number;
  pageHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  /** Un arbre vide de ce cote signifie une bande reservee pour rien. */
  hasHeader?: boolean;
  hasFooter?: boolean;
  /**
   * En-tete et pied REELS, deja rendus, a afficher sur chaque surface de page.
   *
   * Fournis par l'editeur via `<Puck metadata>` : le registry ne sait pas lire
   * les arbres des zones repetees, et surtout il ne peut pas le faire — il est
   * partage avec le chemin PDF, ou ces bandeaux sont dessines par Chromium et
   * non par le document. Quand ils sont absents, la page retombe sur la bande
   * hachuree legendee.
   */
  headerNode?: ReactNode;
  footerNode?: ReactNode;
};

/**
 * Feuille de la page : largeur exacte, ombre portee, fond blanc.
 *
 * Le fond blanc est necessaire au-dela de l'esthetique : le canvas de l'editeur
 * herite sinon du theme sombre de l'application, alors que le PDF s'imprime sur
 * du blanc. Une couleur de texte claire choisie sur fond sombre sortirait
 * illisible.
 */
function PageSheet({ pageWidth, children }: { pageWidth: number; children: ReactNode }) {
  return (
    <div className="ds-canvas-shell">
      <div className="ds-page-sheet" style={{ width: mm(pageWidth) }}>
        {/*
          Sonde de mesure : 100 mm de haut, hors flux, invisible.

          La barre de mesure a besoin du nombre de pixels par millimetre pour
          traduire une hauteur mesuree en millimetres. Le deduire de 96/25,4
          serait juste... jusqu'au premier facteur de zoom applique a la surface.
          Mesurer une reference connue donne la valeur reelle quel que soit le
          zoom, et sans que la barre ait a connaitre son existence.
        */}
        <div aria-hidden="true" className="ds-mm-probe" data-mm-probe="100" />
        {children}
      </div>
    </div>
  );
}

/**
 * Bande reservee a une zone repetee, telle que la voit le corps du document.
 *
 * Elle ne fait pas partie du flux du corps : Chromium y dessine header.html ou
 * footer.html, sur CHAQUE page. Deux representations, selon ce que l'editeur a
 * pu fournir :
 *
 *   - le bandeau REEL, quand `node` est fourni — c'est ce que la page montrera
 *     a l'impression, aux memes marges papier que le document ;
 *   - a defaut, une bande hachuree legendee, qui evite au moins la lecture
 *     fausse la plus naturelle : croire que le bandeau n'apparait qu'en haut de
 *     la premiere page.
 *
 * Dans les deux cas la bande est INERTE : ces zones s'editent dans leurs propres
 * onglets, et un clic ici ne doit pas donner l'illusion du contraire.
 */
function ReservedBand({
  side,
  heightMm,
  filled,
  node,
  marginLeft,
  marginRight,
}: {
  side: "top" | "bottom";
  heightMm: number;
  filled: boolean;
  node?: ReactNode;
  marginLeft: number;
  marginRight: number;
}) {
  if (heightMm <= 0) return <></>;

  const label = side === "top" ? "en-tête" : "pied de page";

  if (node) {
    return (
      <div
        className="ds-band ds-band-live"
        style={{ height: mm(heightMm), paddingLeft: mm(marginLeft), paddingRight: mm(marginRight) }}
      >
        {/* `overflow: hidden` en CSS : ce qui depasse la bande est masque par
            Chromium a l'impression, la surface doit en faire autant. */}
        <div className="ds-band-live-inner">{node}</div>
        <span className="ds-band-tag">{label} — répété sur chaque page</span>
      </div>
    );
  }

  return (
    <div className="ds-band" style={{ height: mm(heightMm) }}>
      <span className="ds-band-label">
        {filled
          ? `${heightMm} mm réservés à l'${label}, répété sur chaque page`
          : `${heightMm} mm réservés à l'${label} — mais cette zone est vide : autant de place perdue sur chaque page`}
      </span>
    </div>
  );
}

/**
 * Reperes de DEBORDEMENT, poses tous les `contentMm` dans la zone de contenu.
 *
 * Depuis que les pages sont explicites, ces rubans ne comptent plus les pages :
 * ils signalent qu'une page composee dans le studio ne tiendra PAS sur une
 * feuille. Chromium continuera de paginer — rien n'est perdu — mais la feuille
 * suivante n'est pas la page suivante du studio, et la numerotation se decale a
 * partir de la.
 *
 * Le nombre de rubans n'est pas connu au rendu : on en pose MAX_PAGE_MARKERS
 * d'avance dans un calque `overflow: hidden` dont la hauteur est celle du
 * contenu. Les rubans au-dela du contenu sont rognes, ce qui donne le bon compte
 * sans mesurer quoi que ce soit — donc sans hook, et sans desynchronisation
 * possible entre la mesure et l'affichage.
 */
function OverflowMarkers({ contentMm }: { contentMm: number }) {
  return (
    <div className="ds-page-markers" aria-hidden="true">
      {Array.from({ length: MAX_PAGE_MARKERS }, (_, index) => {
        const feuilles = index + 1;
        return (
          <div
            key={feuilles}
            className="ds-page-marker ds-page-overflow"
            style={{ top: mm(contentMm * feuilles) }}
          >
            <span className="ds-page-marker-label">
              débordement : cette page prendra {feuilles + 1}{" "}feuilles à l&apos;impression
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * UNE page du corps, a l'echelle : bandeaux compris, marges papier comprises.
 *
 * Rendue par le bloc `Page` (voir registry.tsx), donc autant de fois qu'il y a
 * de pages. Toute la geometrie arrive par `meta` (<Puck metadata>) SAUF le
 * retrait du contenu et l'espacement entre blocs, qui sont des reglages de la
 * RACINE : ceux-la descendent par variables CSS posees par `BodyCanvas`, ce qui
 * les met a jour a la frappe, sans avoir a les faire transiter par les props
 * d'un bloc qui ne les connait pas.
 */
export function PageCanvas({
  meta,
  inactif,
  children,
}: {
  meta: CanvasMeta;
  /** Page conditionnelle dont le champ teste est vide pour le profil affiche. */
  inactif: boolean;
  children: ReactNode;
}) {
  const pageWidth = meta.pageWidth ?? 210;
  const pageHeight = meta.pageHeight ?? 297;
  const marginTop = meta.marginTop ?? 32;
  const marginBottom = meta.marginBottom ?? 22;
  const marginLeft = meta.marginLeft ?? 0;
  const marginRight = meta.marginRight ?? 0;
  // Hauteur utile d'une feuille. MEME FORMULE que le chemin PDF.
  const contentMm = Math.max(20, pageHeight - marginTop - marginBottom);

  return (
    <PageSheet pageWidth={pageWidth}>
      {/*
        Le RANG de la page est un compteur CSS (voir .ds-page-no dans editor.css)
        et non une prop : un bloc ne connait pas sa position, et la faire
        transiter par <Puck metadata> l'aurait fait retarder d'un tour de boucle
        de mesure a chaque ajout ou suppression de page.
      */}
      <span className={inactif ? "ds-page-no ds-page-no-off" : "ds-page-no"}>
        {inactif ? " — non imprimée pour ce profil" : ""}
      </span>

      <ReservedBand
        side="top"
        heightMm={marginTop}
        filled={meta.hasHeader === true}
        node={meta.headerNode}
        marginLeft={marginLeft}
        marginRight={marginRight}
      />

      {/* Marges papier : elles s'appliquent a toute la page, bandeaux compris. */}
      <div style={{ paddingLeft: mm(marginLeft), paddingRight: mm(marginRight) }}>
        <div
          className="ds-canvas-content"
          data-content-mm={contentMm}
          style={pageContentStyle}
        >
          <OverflowMarkers contentMm={contentMm} />
          {children}
        </div>
      </div>

      <ReservedBand
        side="bottom"
        heightMm={marginBottom}
        filled={meta.hasFooter === true}
        node={meta.footerNode}
        marginLeft={marginLeft}
        marginRight={marginRight}
      />
    </PageSheet>
  );
}

/**
 * Canvas du corps : la PILE des pages, et rien d'autre.
 *
 * Il ne dessine plus de feuille lui-meme — chaque bloc `Page` dessine la sienne.
 * Son role est de porter les reglages de la racine qui s'appliquent DANS chaque
 * page (retrait du contenu, espacement entre blocs) sous forme de variables CSS,
 * et de poser le bouton d'ajout sous la derniere page.
 */
export function BodyCanvas({
  pageWidth,
  style,
  children,
}: {
  pageWidth: number;
  /** Variables CSS de la racine, transmises telles quelles aux pages. */
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="ds-canvas-stack" style={style}>
      {children}
      <AddPageButton width={pageWidth} />
    </div>
  );
}

/**
 * « Ajouter une page » — sous la feuille, la ou l'on regarde quand on constate
 * qu'il manque de la place.
 *
 * Ce composant vit dans le registry, donc sur le chemin PDF aussi : il ne peut
 * PAS utiliser de hook. Il emet un evenement DOM, que le pont de
 * previewConfig.tsx transforme en dispatch Puck — meme mecanisme que les
 * boutons Dupliquer/Supprimer des etiquettes de conteneur.
 *
 * `onClickCapture` et non `onClick` : Puck arrete la propagation du clic autour
 * de chaque bloc du canvas, et React delegue ses gestionnaires a la racine. Voir
 * le commentaire de `ContainerTag` dans registry.tsx, ou c'est mesure.
 */
function AddPageButton({ width }: { width: number }) {
  return (
    <div className="ds-add-page" style={{ width: mm(width) }}>
      <button
        type="button"
        className="ds-add-page-btn"
        onClickCapture={(event) => {
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("ds:add-page"));
        }}
        title="Ajoute une page vide à la fin du document. Elle se compose comme la première."
      >
        <span aria-hidden="true">+</span> Ajouter une page
      </button>
    </div>
  );
}

/**
 * Canvas d'une zone repetee : le bandeau a sa largeur et a sa hauteur reelles.
 *
 * La bande etait deja materialisee par un cadre, mais sur la largeur du canvas —
 * donc sur celle de la fenetre. Un bandeau compose « bord a bord » y paraissait
 * juste et sortait tronque. Ici la surface est celle de la page, marges papier
 * comprises, et ce qui depasse la limite est hachure : Chromium le masque sans
 * rien signaler.
 */
export function MarginBoxCanvas({
  meta,
  children,
}: {
  meta: CanvasMeta;
  children: ReactNode;
}) {
  const pageWidth = meta.pageWidth ?? 210;
  const marginLeft = meta.marginLeft ?? 0;
  const marginRight = meta.marginRight ?? 0;
  const reserved = meta.reservedMm ?? 0;
  const isFooter = meta.zone === "footer";

  // Un rappel du corps de la fiche, pour situer le bandeau sur la page. Une
  // hauteur symbolique suffit : ce n'est pas ce qu'on edite ici.
  const bodyHint = (
    <div className="ds-page-rest" style={{ height: mm(28) }}>
      <span>corps de la fiche — édité dans l&apos;onglet « Corps »</span>
    </div>
  );

  return (
    <PageSheet pageWidth={pageWidth}>
      {isFooter ? bodyHint : null}

      <div style={{ paddingLeft: mm(marginLeft), paddingRight: mm(marginRight) }}>
        <div
          className="ds-marginbox-canvas"
          data-reserved-mm={reserved}
          style={{ position: "relative", minHeight: mm(Math.max(reserved, 6)) }}
        >
          {children}

          {reserved > 0 ? (
            <>
              {/* Limite de la bande : au-dela, Chromium masque. */}
              <div
                aria-hidden="true"
                className="ds-marginbox-limit"
                style={{ top: mm(reserved) }}
              >
                <span>{reserved} mm — limite de la bande</span>
              </div>
              {/* N'a de hauteur que si le contenu depasse. */}
              <div
                aria-hidden="true"
                className="ds-marginbox-overflow"
                style={{ top: mm(reserved) }}
              >
                <span>masqué à l&apos;impression</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {isFooter ? null : bodyHint}
    </PageSheet>
  );
}
