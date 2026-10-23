import type { RenderData } from "./payload";
import { DEFAULT_SAMPLE_PROFILE, type SampleProfileId } from "./sampleProfiles";

/**
 * Jeux de donnees d'exemple pour l'apercu de l'editeur.
 *
 * EMBARQUES DANS LE CODE, pas lus depuis fixtures/ : le build `output: standalone`
 * ne copie pas les fichiers hors du graphe de modules, un fichier de fixture
 * serait donc introuvable en production.
 *
 * Le catalogue des profils et la raison d'etre de chacun vivent dans
 * src/lib/sampleProfiles.ts, consommable cote navigateur.
 *
 * Le contenu est accentue : c'est du contenu imprime, pas un libelle d'editeur, et
 * un texte accentue n'occupe pas la meme place qu'un texte sans accents.
 */

/** Placeholder vectoriel : aucune dependance, aucun octet a televerser. */
function placeholder(label: string, w = 800, h = 600): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="100%" height="100%" fill="#eef1f5"/>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#c3ccd8" stroke-width="2"/>
<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
 font-family="Arial, sans-serif" font-size="${Math.round(h / 12)}" fill="#8a97a8">${label}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * Un visuel de details COMPLET, legendes comprises.
 *
 * Distinct de `placeholder`, qui ne rend qu'un cartouche gris : celui-ci imite
 * ce que la boutique enverra reellement — un produit detoure au centre, ses
 * libelles de part et d'autre et leurs traits de rappel, le tout DANS l'image.
 * C'est ce qui permet a l'editeur de montrer la vraie hauteur et la vraie
 * densite de cette section.
 *
 * LE FORMAT EST CELUI DES FICHES FAITES A LA MAIN — large et peu haut, 880 x 380,
 * soit 2,3 pour 1. Un visuel plus carre se retrouverait bride par le plafond de
 * hauteur du template et n'occuperait que la moitie de la largeur, ce qui
 * donnerait dans l'editeur une section deux fois plus etroite qu'en realite.
 *
 * LA SILHOUETTE CENTRALE EST PARAMETREE parce qu'elle change tout a la lecture :
 * un vestiaire est etroit et haut, un bureau large et bas. Garder la meme pour
 * les trois familles redonnerait le defaut que ces profils corrigent — juger la
 * mise en page d'une fiche sur le contenu d'une autre.
 *
 * @param gauche  libelles de la colonne de gauche
 * @param droite  libelles de la colonne de droite
 * @param largeur largeur de la silhouette, en unites du viewBox (880 de large)
 */
function visuelDetaille(gauche: string[], droite: string[], largeur = 90): string {
  const centre = 440;
  const produitGauche = centre - largeur / 2;
  const produitDroite = centre + largeur / 2;

  const legende = (texte: string, y: number, aGauche: boolean): string => {
    const xTexte = aGauche ? produitGauche - 105 : produitDroite + 105;
    const x1 = aGauche ? produitGauche - 95 : produitDroite + 95;
    const x2 = aGauche ? produitGauche : produitDroite;
    return (
      `<text x="${xTexte}" y="${y + 4}" text-anchor="${aGauche ? "end" : "start"}"` +
      ` font-family="Arial, sans-serif" font-size="13" fill="#1a1a1a">${texte}</text>` +
      `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#1a1a1a" stroke-width="1"/>`
    );
  };

  // Les libelles se repartissent sur la hauteur utile, quel que soit leur
  // nombre : deux legendes ne doivent pas se tasser en haut de l'image.
  const pas = (cote: string[], index: number) => 70 + index * (240 / Math.max(1, cote.length - 1 || 1));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="380" viewBox="0 0 880 380">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<rect x="${produitGauche}" y="20" width="${largeur}" height="340" rx="4"` +
    ` fill="#eef1f5" stroke="#c3ccd8" stroke-width="2"/>` +
    gauche.map((texte, index) => legende(texte, pas(gauche, index), true)).join("") +
    droite.map((texte, index) => legende(texte, pas(droite, index), false)).join("") +
    `<text x="${centre}" y="195" text-anchor="middle" font-family="Arial, sans-serif"` +
    ` font-size="15" fill="#8a97a8" transform="rotate(-90 ${centre} 195)">VISUEL DÉTAILLÉ</text>` +
    `</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * Une TEXTURE d'attribut, comme PrestaShop en sert depuis img/co/<id>.jpg.
 *
 * Aucun autre profil n'en produit, et c'est un angle mort : une pastille en
 * image ne se rend pas comme un aplat — elle peut deborder, se deformer ou ne
 * pas se centrer. Les decors bois des fiches de bureaux en dependent
 * entierement.
 */
function texture(clair: string, fonce: string): string {
  const veines = Array.from({ length: 7 }, (_, index) => {
    const y = 6 + index * 9;
    return `<path d="M0 ${y} Q16 ${y - 3} 32 ${y} T64 ${y}" stroke="${fonce}" stroke-width="1.6" fill="none" opacity="0.55"/>`;
  }).join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${clair}"/>${veines}</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

type ShopOverride = {
  name?: string;
  colors?: { primary?: string; secondary?: string };
};

/**
 * Les collections de choix, vides.
 *
 * Reunies en une constante parce que quatre profils sur cinq n'en ont aucune :
 * un transpalette ne se decline ni en coloris ni en fermeture. Les recopier
 * cinq fois laisserait croire que chaque profil a decide quelque chose a leur
 * sujet, alors qu'il s'agit du meme « sans objet ».
 */
const AUCUN_CHOIX = {
  finishes: [],
  accessories: [],
  detail_image: null,
} satisfies Partial<RenderData>;

function baseShop(shop?: ShopOverride, logo: string | undefined = placeholder("LOGO", 400, 120)) {
  return {
    name: shop?.name ?? "Boutique de démonstration",
    url: "https://exemple.test",
    logo,
    colors: {
      primary: shop?.colors?.primary ?? "#0b5ea8",
      secondary: shop?.colors?.secondary ?? "#33404d",
    },
    company: {
      address: "1 Example Street, Springfield",
      phone: "+33 1 00 00 00 00",
      email: "contact@exemple.test",
    },
  };
}

const TYPIQUE_DESCRIPTION =
  "<h3>Présentation</h3><p>Ce transpalette <strong>2500 kg</strong> a été conçu pour la manutention intensive de charges palettisées. Sa pompe hydraulique offre trois positions de commande : <em>montée</em>, <em>neutre</em> et <em>descente</em>.</p>" +
  "<ul><li>Châssis mécano-soudé épaisseur 8 mm</li><li>Roues directrices en polyuréthane</li><li>Galets tandem en nylon</li><li>Descente amortie à vitesse contrôlée</li></ul>" +
  "<h3>Caractéristiques du châssis</h3><table><thead><tr><th>Élément</th><th>Matériau</th><th>Traitement</th></tr></thead><tbody>" +
  "<tr><td>Châssis</td><td>Acier S235</td><td>Peinture époxy</td></tr>" +
  "<tr><td>Fourches</td><td>Acier S355</td><td>Peinture époxy</td></tr>" +
  "<tr><td>Vérin</td><td>Acier chromé</td><td>Chromage dur</td></tr></tbody></table>" +
  '<p style="text-align:justify">La conception du timon permet une prise en main confortable et un rayon de braquage réduit, adapté aux allées étroites. L\'ensemble est garanti trois ans pièces et main d\'œuvre.</p>';

/**
 * Le profil dense n'est pas une exageration gratuite : il reproduit ce qu'on
 * trouve reellement dans un catalogue PrestaShop nourri par plusieurs
 * fournisseurs — libelles a rallonge, unites collees dans la valeur, et surtout
 * plusieurs valeurs sous un meme nom de caracteristique, ce que le back-office
 * autorise et que les fournisseurs utilisent.
 */
const DENSE_FEATURES = [
  { name: "Capacité de charge nominale", value: "2500 kg", abbreviation: "Q" },
  { name: "Capacité de charge résiduelle à 1200 mm", value: "1800 kg", abbreviation: "Qr" },
  { name: "Longueur des fourches", value: "1150 mm", abbreviation: "L" },
  { name: "Largeur hors fourches", value: "540 mm", abbreviation: "B" },
  { name: "Largeur d'une fourche", value: "160 mm", abbreviation: "e" },
  { name: "Hauteur de levée", value: "200 mm", abbreviation: "H" },
  { name: "Hauteur minimale d'entrée", value: "85 mm", abbreviation: "h" },
  { name: "Hauteur du timon en position de conduite", value: "1220 mm", abbreviation: "hT" },
  { name: "Réglage", value: "Hauteur de timon sur 3 crans", abbreviation: null },
  { name: "Réglage", value: "Vitesse de descente par molette graduée", abbreviation: null },
  { name: "Réglage", value: "Précharge du ressort de rappel", abbreviation: null },
  { name: "Roues directrices", value: "Polyuréthane 200 x 50 mm", abbreviation: "D" },
  { name: "Galets", value: "Nylon tandem 74 x 70 mm", abbreviation: "d" },
  { name: "Galets", value: "Polyuréthane tandem 82 x 70 mm (option)", abbreviation: "d2" },
  { name: "Empattement", value: "1310 mm", abbreviation: "y" },
  { name: "Rayon de braquage", value: "1420 mm", abbreviation: "Wa" },
  { name: "Largeur d'allée pour palette 800 x 1200 en long", value: "1850 mm", abbreviation: "Ast" },
  { name: "Effort au timon en traction, charge nominale", value: "310 N", abbreviation: null },
  { name: "Nombre de coups de pompe pour la levée complète", value: "13", abbreviation: null },
  { name: "Poids net", value: "78 kg", abbreviation: null },
  { name: "Poids brut emballé", value: "84 kg", abbreviation: null },
  { name: "Dimensions du colis", value: "1200 x 560 x 320 mm", abbreviation: null },
  { name: "Dimensions du colis", value: "Sur palette perdue 1200 x 800 mm", abbreviation: null },
  { name: "Matériau du châssis", value: "Acier S235 mécano-soudé, épaisseur 8 mm", abbreviation: null },
  { name: "Finition", value: "Peinture époxy polymérisée au four, RAL 2004", abbreviation: null },
  { name: "Type de pompe hydraulique", value: "Triple fonction, montée / neutre / descente", abbreviation: null },
  { name: "Soupape de surcharge", value: "Tarée à 110 % de la charge nominale", abbreviation: null },
  { name: "Température d'utilisation", value: "-10 °C à +40 °C", abbreviation: null },
  { name: "Norme de conformité", value: "EN ISO 3691-5", abbreviation: null },
  { name: "Norme de conformité", value: "Directive Machines 2006/42/CE", abbreviation: null },
  { name: "Garantie", value: "3 ans pièces et main d'œuvre", abbreviation: null },
  { name: "Délai de mise à disposition", value: "Sous 48 h ouvrées depuis notre entrepôt de Springfield", abbreviation: null },
  { name: "Référence fournisseur", value: "BF-2500L-PU-TANDEM", abbreviation: null },
  { name: "Pays de fabrication", value: "Union européenne", abbreviation: null },
];

function denseDescription(): string {
  const paragraph =
    "<p style=\"text-align:justify\">La conception mécano-soudée du châssis, associée à une pompe hydraulique à triple fonction, garantit une durée de vie supérieure en usage intensif. Les galets tandem répartissent la charge sur quatre points de contact, ce qui préserve les sols industriels et réduit l'effort de traction dans les allées étroites. Le timon, réglable sur trois crans, s'adapte à la taille de l'opérateur.</p>";

  return (
    "<h3>Présentation générale</h3>" +
    paragraph +
    "<ul><li>Châssis mécano-soudé épaisseur 8 mm, peinture époxy cuite au four</li>" +
    "<li>Roues directrices en polyuréthane 200 x 50 mm sur roulements étanches</li>" +
    "<li>Galets tandem en nylon, montés sur axes trempés</li>" +
    "<li>Descente amortie à vitesse contrôlée, réglable par molette graduée</li>" +
    "<li>Soupape de surcharge tarée en usine à 110 % de la charge nominale</li>" +
    "<li>Timon réglable sur trois positions de conduite</li></ul>" +
    "<h3>Domaines d'emploi</h3>" +
    paragraph +
    "<h3>Entretien</h3>" +
    "<table><thead><tr><th>Opération</th><th>Périodicité</th><th>Intervenant</th></tr></thead><tbody>" +
    "<tr><td>Contrôle du niveau d'huile hydraulique</td><td>Trimestriel</td><td>Opérateur</td></tr>" +
    "<tr><td>Graissage des axes de galets</td><td>Semestriel</td><td>Opérateur</td></tr>" +
    "<tr><td>Vérification de la soupape de surcharge</td><td>Annuel</td><td>Technicien agréé</td></tr>" +
    "<tr><td>Contrôle réglementaire de l'appareil de levage</td><td>Annuel</td><td>Organisme agréé</td></tr>" +
    "</tbody></table>" +
    paragraph
  );
}

/**
 * @param profile le cas a eprouver. Voir SAMPLE_PROFILES.
 */
export function buildSampleData(
  shop?: ShopOverride,
  profile: SampleProfileId = DEFAULT_SAMPLE_PROFILE
): RenderData {
  if (profile === "dense") {
    return {
      shop: baseShop(shop),
      product: {
        id: 4271,
        // Un nom de cette longueur est courant des que le fournisseur concatene
        // la designation, la capacite et les options dans un seul champ.
        name: "Transpalette manuel à fourches longues 2500 kg — roues polyuréthane, galets tandem, descente amortie, timon réglable trois positions",
        sku: "TPM-2500-L-PU-TANDEM-AMORTI",
        gtin: "3701234567890",
        mpn: "BF-2500L-PU-TANDEM",
        url: "https://exemple.test/transpalette-manuel-2500-kg-fourches-longues-roues-polyurethane-galets-tandem",
        brand: "Liftmax",
        category_path: ["Manutention", "Transpalettes", "Transpalettes manuels", "Fourches longues"],
        price: { amount: "1489.00", currency: "EUR", tax_included: false },
        description_short:
          "Transpalette manuel robuste à fourches longues, conçu pour un usage intensif en entrepôt. Châssis mécano-soudé, pompe hydraulique à triple fonction, galets tandem et descente amortie à vitesse contrôlée pour la manutention de charges fragiles.",
        description_html: denseDescription(),
      },
      features: DENSE_FEATURES,
      images: Array.from({ length: 10 }, (_, index) =>
        index === 0
          ? { src: placeholder("VUE PRINCIPALE"), legend: "Vue trois quarts" }
          : { src: placeholder(`DÉTAIL ${index}`, 400, 400), legend: `Détail ${index}` }
      ),
      schema_image: { src: placeholder("SCHÉMA COTÉ", 700, 500) },
      badges: ["ce", "tuv", "carsat", "bureau-veritas", "garantie:3-ans", "made-in-eu", "stock"],
      qr_code: { src: placeholder("QR", 200, 200) },
      ...AUCUN_CHOIX,
      custom: {},
    };
  }

  if (profile === "vestiaire") {
    return {
      shop: baseShop(shop),
      product: {
        id: 7714,
        name: "Vestiaire biplace 30 cm",
        sku: "VEST-BI-30",
        gtin: "3705554443332",
        mpn: null,
        url: "https://exemple.test/vestiaire-biplace-30-cm",
        brand: null,
        category_path: ["Mobilier", "Vestiaires", "Vestiaires monobloc"],
        price: { amount: "289.00", currency: "EUR", tax_included: false },
        description_short:
          "Vestiaire monobloc deux cases superposées, tôle d'acier finition époxy, ouïes d'aération haute et basse.",
        description_html: null,
      },
      features: [
        { name: "Dimensions hors tout (cm)", value: "H180 x L31,5 x P50", abbreviation: null },
        { name: "Dimensions hors tout (cm)", value: "H180 x L60 x P50 (2 colonnes)", abbreviation: null },
        { name: "Dimensions intérieures (cm)", value: "H83,5 x L31", abbreviation: null },
        { name: "Coloris structure", value: "Gris (RAL 7035)", abbreviation: null },
        { name: "Coloris porte", value: "Bleu (RAL 5010)", abbreviation: null },
        { name: "Matériau de la structure", value: "Tôle d'acier finition époxy 7/10ème", abbreviation: null },
        { name: "Renforts de porte", value: "2", abbreviation: null },
        { name: "Aérations", value: "Haute et basse", abbreviation: null },
        { name: "Porte étiquette", value: "Oui", abbreviation: null },
      ],
      images: [
        { src: placeholder("MISE EN SITUATION"), legend: "Vestiaire en situation" },
        { src: placeholder("VUE DE FACE", 400, 600), legend: "Vue de face" },
      ],
      schema_image: { src: placeholder("SCHÉMA COTÉ", 700, 500) },
      /**
       * Les badges alimentent « Informations principales » — pas une collection
       * a part. C'est la demonstration que la zone se compose sans qu'aucune
       * plateforme ait un champ de plus a remplir : le module PrestaShop les
       * produit deja, et le collecteur Medusa les tire des tags.
       */
      /**
       * LES CLES SONT CELLES QUE LE CATALOGUE PRODUIT VRAIMENT.
       *
       * Le module suffixe la regle avec la VALEUR de la caracteristique : la
       * boutique nomme la sienne « Garantie (ans) » et y range « 3 », d'ou
       * « garantie:3 » et non « garantie:3-ans ». Un exemple qui emettrait
       * l'ancienne forme ferait mentir l'apercu de l'editeur — il montrerait
       * des pictos que le vrai payload n'allume pas.
       */
      badges: ["matiere:tole-d-acier", "montage:livre-monte", "montage:a-monter", "garantie:10"],
      qr_code: null,
      finishes: [
        {
          label: "Coloris des portes",
          // Sans `color` : le rapprochement se fait par libelle, sur le bloc.
          // C'est le cas Medusa, ou la valeur d'option ne porte pas de couleur.
          options: [{ label: "Bleu", color: "#2b4ea2" }, { label: "Gris", color: "#c9ccd1" }],
          note: null,
        },
        {
          label: "Fermeture",
          /**
           * LES LIBELLES SONT CEUX DU CATALOGUE, pas ceux des fiches imprimees.
           * L'export des valeurs d'attributs (22/09/2026) donne « A code » et
           * « A code electronique », sans accent ; c'est le template qui
           * imprime « Serrure à code électronique ». Mettre ici les libelles
           * jolis rendrait l'apercu faussement rassurant : il montrerait des
           * pictos que le vrai payload ne declencherait pas.
           */
          /**
           * TROIS FERMETURES SUR LES QUATRE DOCUMENTEES, et l'ecart est
           * volontaire. Le template en decrit quatre ; ce produit n'en propose
           * que trois. Si le filtrage cessait de fonctionner, l'apercu
           * afficherait « A code » — une option que ce vestiaire n'a pas — et
           * le defaut se verrait a l'ecran au lieu d'attendre une reclamation
           * client.
           */
          options: [
            { label: "Clés" },
            { label: "Cadenas" },
            { label: "A code electronique" },
          ],
          note: "Pour vestiaire 2 portes uniquement",
        },
      ],
      accessories: [
        {
          name: "Coiffe inclinée",
          image: placeholder("COIFFE", 500, 400),
          description:
            "La coiffe inclinée pour vestiaire monobloc empêche le dépôt d'objets sur le vestiaire et facilite son entretien, notamment dans les environnements soumis à des règles d'hygiène strictes.",
          features: [
            { name: "Largeur", value: "80 cm" },
            { name: "Hauteur", value: "20 cm" },
            { name: "Matériau", value: "tôle d'acier finition époxy 8/10ème" },
            { name: "Coloris", value: "gris clair (RAL 7035)" },
          ],
        },
        {
          name: "Pieds métal ou inox",
          image: placeholder("PIEDS", 500, 400),
          description:
            "Les pieds de vestiaire surélèvent le vestiaire et facilitent le nettoyage du sol. Robustes et résistants, ils protègent également le mobilier de l'humidité.",
          features: [
            { name: "Hauteur", value: "10 cm" },
            { name: "Matériau", value: "métal / acier inoxydable" },
            { name: "Quantité", value: "4" },
          ],
        },
        {
          name: "Socle banc fixe",
          image: placeholder("SOCLE FIXE", 500, 400),
          description:
            "Le socle banc fixe permet de combiner vestiaire et assise en un seul ensemble. Il possède 3 lattes au niveau de l'assise et des embouts réglables en plastique au niveau des pieds.",
          features: [
            { name: "Largeur", value: "80 / 120 cm" },
            { name: "Profondeur", value: "85 cm" },
            { name: "Hauteur", value: "41 cm" },
          ],
        },
        {
          // Sans description ni caracteristiques : la rangee de la page 1 doit
          // rester correcte quand la fiche detaillee n'est pas renseignee.
          name: "Socle banc rétractable",
          image: placeholder("SOCLE RÉTRACTABLE", 500, 400),
          features: [],
        },
      ],
      detail_image: {
        src: visuelDetaille(
          ["Tringle avec crochets", "Perforation arrière", "Renfort de porte"],
          ["Porte étiquette", "Ouïes d'aération", "Serrure en applique"],
          90
        ),
      },
      custom: {},
    };
  }

  if (profile === "siege") {
    return {
      shop: baseShop(shop),
      product: {
        id: 8120,
        name: "Fauteuil de Bureau Mistral",
        sku: "FB-MISTRAL",
        gtin: "3705551112223",
        mpn: null,
        url: "https://exemple.test/fauteuil-de-bureau-mistral",
        brand: null,
        category_path: ["Mobilier", "Sièges", "Fauteuils de bureau"],
        price: { amount: "129.00", currency: "EUR", tax_included: false },
        description_short:
          "Fauteuil de bureau à dossier en résille respirante, mécanisme basculant et réglage de la hauteur d'assise par vérin à gaz.",
        description_html: null,
      },
      features: [
        { name: "Dimensions hors tout (cm)", value: "L. 45 x P. 48 x H. 87-97", abbreviation: null },
        { name: "Hauteur dossier (cm)", value: "45", abbreviation: null },
        { name: "Largeur assise (cm)", value: "45", abbreviation: null },
        { name: "Poids (kg)", value: "10", abbreviation: null },
        { name: "Charge maximale (kg)", value: "110", abbreviation: null },
        { name: "Réglages", value: "Système anti-retour de sécurité", abbreviation: null },
        { name: "Réglages", value: "Hauteur d'assise", abbreviation: null },
        { name: "Réglages", value: "Tension de basculement réglable", abbreviation: null },
        { name: "Accoudoirs", value: "Fixes en nylon", abbreviation: null },
        { name: "Type de vérins", value: "À gaz", abbreviation: null },
      ],
      images: [
        { src: placeholder("MISE EN SITUATION"), legend: "Fauteuil en situation" },
        { src: placeholder("VUE DE TROIS QUARTS", 500, 500), legend: "Vue trois quarts" },
      ],
      schema_image: { src: placeholder("SCHÉMA COTÉ", 700, 400) },
      /**
       * LES DEUX MARQUES DE CERTIFICATION SONT ICI, et nulle part ailleurs.
       * Ce sont les seuls medias EN COULEUR du bandeau, au milieu de pictos au
       * trait : leur coherence visuelle a 11 mm ne se juge qu'au rendu, et
       * aucun autre profil ne les declenchait. La fiche Light-up les porte.
       */
      /**
       * LES BADGES DE LA FICHE OXXY JUNIOR, dans les cles du catalogue.
       *
       * Le profil emettait « mecanisme:basculant » et « usage:journalier » :
       * des cles que le module ne produit pas. Le nom de la caracteristique
       * entre dans la cle — « Type de Mécanisme » donne « type-de-mecanisme: ».
       */
      badges: [
        "type-de-mecanisme:synchrone",
        "type-d-usage:intensif-8",
        "normes:feu-en1021-1-et-en1021-2",
        "normes:norme-ergonomique-en1335",
        "normes:certification-mobelfakta",
        "normes:certification-blue-angel",
        "montage:livre-monte",
        "garantie:3",
      ],
      qr_code: null,
      /**
       * TROIS GROUPES D'UNE SEULE VALEUR, la ou le vestiaire en declare deux
       * dont un de quatre. C'est ce que le panneau de choix doit savoir rendre
       * sans se disloquer : trois titres alignes, une pastille sous chacun.
       */
      finishes: [
        { label: "Dossier", options: [{ label: "Noir", color: "#1a1a1a" }], note: null },
        { label: "Assise", options: [{ label: "Noir", color: "#1a1a1a" }], note: null },
        { label: "Piètement", options: [{ label: "Noir", color: "#1a1a1a" }], note: null },
      ],
      accessories: [
        {
          name: "Accoudoirs 1D",
          image: placeholder("ACCOUDOIRS 1D", 400, 300),
          description: "Accoudoirs réglables en hauteur.",
          features: [{ name: "Réglage", value: "hauteur" }],
        },
        {
          name: "Accoudoirs 2D",
          image: placeholder("ACCOUDOIRS 2D", 400, 300),
          description: "Accoudoirs réglables en hauteur et en largeur.",
          features: [{ name: "Réglage", value: "hauteur et largeur" }],
        },
      ],
      detail_image: {
        src: visuelDetaille(
          ["Dossier en résille respirante", "Accoudoirs fixes", "Vérin à gaz"],
          ["Système anti-retour", "Mécanisme basculant", "Piètement 5 branches"],
          150
        ),
      },
      custom: {},
    };
  }

  if (profile === "bureau") {
    return {
      shop: baseShop(shop),
      product: {
        id: 9440,
        name: "Bureau droit SIERRA",
        sku: "BUR-SIERRA-140",
        gtin: "3705559998887",
        mpn: null,
        url: "https://exemple.test/bureau-droit-sierra",
        brand: null,
        category_path: ["Mobilier", "Bureaux et tables", "Bureaux droits"],
        price: { amount: "349.00", currency: "EUR", tax_included: false },
        description_short: "* 2 prises USB A.",
        description_html: null,
      },
      features: [
        { name: "Dimensions hors tout (cm)", value: "L 120 x P 80 x H 74", abbreviation: null },
        { name: "Dimensions hors tout (cm)", value: "L 140 x P 80 x H 74", abbreviation: null },
        { name: "Dimensions hors tout (cm)", value: "L 160 x P 80 x H 74", abbreviation: null },
        { name: "Épaisseur plateau (cm)", value: "2,5", abbreviation: null },
        { name: "Densité (kg/m3)", value: "<680", abbreviation: null },
        { name: "Matière plateau", value: "Panneaux de particules haute densité", abbreviation: null },
        { name: "Revêtement", value: "Anti-rayures, anti-traces", abbreviation: null },
        { name: "Structure piètement", value: "En tôle d'acier recouvert de peinture époxy", abbreviation: null },
        { name: "Assemblage", value: "Par inserts métalliques", abbreviation: null },
        { name: "Colisage", value: "5 pcs", abbreviation: null },
      ],
      images: [
        { src: placeholder("MISE EN SITUATION"), legend: "Bureau en situation" },
        { src: placeholder("VUE DE TROIS QUARTS", 600, 400), legend: "Vue trois quarts" },
      ],
      schema_image: { src: placeholder("SCHÉMA COTÉ", 800, 400) },
      badges: ["pietement-robuste", "acv", "montage:livre-en-kit", "garantie:10"],
      qr_code: null,
      /**
       * LE SEUL PROFIL QUI PORTE DES TEXTURES. Les decors bois n'ont pas de code
       * hexadecimal — un bois n'est pas un aplat — et PrestaShop les sert en
       * image depuis img/co/<id>.jpg. Sans ce profil, rien dans l'editeur ne
       * montrerait comment une pastille en image se rend : elle peut deborder,
       * se deformer ou ne pas se centrer.
       */
      finishes: [
        {
          label: "Plateau",
          options: [
            { label: "Chêne clair", image: texture("#d9bb8a", "#b8955f") },
            { label: "Blanc", color: "#ffffff" },
            { label: "Hêtre", image: texture("#e6d3b3", "#c4a87c") },
          ],
          note: null,
        },
        /**
         * AUCUNE COULEUR ENVOYEE, et c'est l'etat REEL du catalogue : le groupe
         * « Piètement » est en boutons radio, or PrestaShop n'offre le champ
         * couleur que pour un groupe de type couleur. Ses valeurs arrivent donc
         * nues, et c'est la correspondance du template qui les fait exister.
         *
         * Envoyer ici des couleurs que la boutique n'a pas rendrait l'apercu
         * faussement rassurant : il montrerait des pastilles qu'un vrai payload
         * ne declencherait pas.
         */
        {
          label: "Piètement",
          options: [
            { label: "Noir" },
            { label: "Blanc" },
            { label: "Alu" },
            { label: "Bois Chêne" },
            { label: "Bois Frêne" },
          ],
          note: null,
        },
      ],
      accessories: [
        { name: "Flap", image: placeholder("FLAP", 400, 300), features: [] },
        { name: "Goulotte", image: placeholder("GOULOTTE", 400, 300), features: [] },
        { name: "Voile de fond", image: placeholder("VOILE DE FOND", 400, 300), features: [] },
        { name: "2 ports USB", image: placeholder("2 PORTS USB", 400, 300), features: [] },
      ],
      detail_image: {
        src: visuelDetaille(
          ["Revêtement anti-rayures"],
          ["Passe-câbles intégré", "Vérins réglables"],
          // 300 ET NON 420 : a 420, la colonne de gauche ne faisait plus que
          // 125 unites et « Revêtement anti-rayures » sortait du cadre, tronque
          // en « vêtement anti-rayures ». Constate au rendu.
          300
        ),
      },
      custom: {},
    };
  }

  if (profile === "minimal") {
    return {
      shop: baseShop(shop),
      product: {
        id: 118,
        name: "Diable pliant 200 kg",
        sku: "DP-200",
        gtin: null,
        mpn: null,
        url: "https://exemple.test/diable-pliant-200-kg",
        brand: null,
        category_path: ["Manutention"],
        price: { amount: "59.00", currency: "EUR", tax_included: false },
        description_short: "Diable pliant à dossier rabattable.",
        // Aucune description longue : un bloc de texte riche se videra, et c'est
        // exactement ce qu'il faut voir avant de publier.
        description_html: null,
      },
      features: [
        { name: "Capacité de charge", value: "200 kg", abbreviation: null },
        { name: "Poids net", value: "6 kg", abbreviation: null },
      ],
      images: [{ src: placeholder("VUE PRINCIPALE"), legend: "Vue de face" }],
      schema_image: null,
      badges: [],
      qr_code: null,
      ...AUCUN_CHOIX,
      custom: {},
    };
  }

  if (profile === "sans-medias") {
    return {
      shop: baseShop(shop, undefined),
      product: {
        id: 9302,
        name: "Chariot de service inox 3 plateaux",
        sku: "CS-INOX-3P",
        gtin: "3709876543210",
        mpn: null,
        url: "https://exemple.test/chariot-de-service-inox-3-plateaux",
        brand: "Liftmax",
        category_path: ["Manutention", "Chariots de service"],
        price: { amount: "249.00", currency: "EUR", tax_included: false },
        description_short:
          "Chariot de service tout inox, trois plateaux emboutis, roulettes pivotantes dont deux à frein.",
        description_html:
          "<p>Chariot entièrement réalisé en acier inoxydable <strong>AISI 304</strong>, adapté aux environnements agroalimentaires et hospitaliers.</p><ul><li>Trois plateaux emboutis à bords relevés</li><li>Quatre roulettes pivotantes, deux à frein</li></ul>",
      },
      features: [
        { name: "Capacité de charge par plateau", value: "50 kg", abbreviation: null },
        { name: "Dimensions des plateaux", value: "900 x 500 mm", abbreviation: null },
        { name: "Hauteur totale", value: "960 mm", abbreviation: "H" },
        { name: "Matériau", value: "Acier inoxydable AISI 304", abbreviation: null },
        { name: "Diamètre des roulettes", value: "125 mm", abbreviation: "D" },
      ],
      // Aucune image, aucun schema, aucun logo : le cas d'un produit fraichement
      // importe dont les visuels ne sont pas encore rattaches.
      images: [],
      schema_image: null,
      badges: ["ce"],
      qr_code: null,
      ...AUCUN_CHOIX,
      custom: {},
    };
  }

  return {
    shop: baseShop(shop),
    product: {
      id: 4271,
      name: "Transpalette manuel 2500 kg fourches longues",
      sku: "TPM-2500-L",
      gtin: "3701234567890",
      mpn: "BF-2500L",
      url: "https://exemple.test/transpalette-manuel-2500-kg",
      brand: "Liftmax",
      category_path: ["Manutention", "Transpalettes", "Transpalettes manuels"],
      price: { amount: "489.00", currency: "EUR", tax_included: false },
      description_short:
        "Transpalette manuel robuste à fourches longues, conçu pour un usage intensif en entrepôt. Châssis mécano-soudé et pompe hydraulique à triple fonction.",
      description_html: TYPIQUE_DESCRIPTION,
    },
    features: [
      { name: "Capacité de charge", value: "2500 kg", abbreviation: "Q" },
      { name: "Longueur des fourches", value: "1150 mm", abbreviation: "L" },
      { name: "Largeur hors fourches", value: "540 mm", abbreviation: "B" },
      { name: "Hauteur de levée", value: "200 mm", abbreviation: "H" },
      { name: "Hauteur mini d'entrée", value: "85 mm", abbreviation: "h" },
      { name: "Roues directrices", value: "Polyuréthane 200 x 50 mm", abbreviation: "D" },
      { name: "Galets", value: "Nylon tandem 74 x 70 mm", abbreviation: "d" },
      { name: "Poids net", value: "78 kg", abbreviation: null },
      { name: "Norme de conformité", value: "EN ISO 3691-5", abbreviation: null },
    ],
    images: [
      { src: placeholder("VUE PRINCIPALE"), legend: "Vue trois quarts" },
      { src: placeholder("DÉTAIL 1", 400, 400), legend: "Détail du timon" },
      { src: placeholder("DÉTAIL 2", 400, 400), legend: "Galets tandem" },
      { src: placeholder("DÉTAIL 3", 400, 400), legend: "Pompe hydraulique" },
      { src: placeholder("DÉTAIL 4", 400, 400), legend: "Plaque de charge" },
    ],
    schema_image: { src: placeholder("SCHÉMA COTÉ", 700, 500) },
    badges: ["ce", "tuv", "carsat", "bureau-veritas", "garantie:3-ans"],
    qr_code: { src: placeholder("QR", 200, 200) },
    ...AUCUN_CHOIX,
    custom: {},
  };
}
