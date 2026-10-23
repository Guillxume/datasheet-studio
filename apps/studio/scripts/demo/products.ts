/**
 * Catalogue de demonstration : une boutique et quatre produits INVENTES.
 *
 * Les illustrations de images/ sont dessinees pour la demonstration (voir
 * scripts/demo-samples.ts, qui les joint au rendu en multipart). Aucune donnee
 * ni aucun visuel ne vient d'une boutique reelle.
 */

export type DemoSample = {
  /** Slug du template de bibliotheque qui rend ce produit. */
  template: string;
  /** Fichiers de images/ joints au rendu, par cle d'asset (`asset://<cle>`). */
  assets: Record<string, string>;
  data: Record<string, unknown>;
};

const SITE = "https://contoso-equipment.example";

export const SHOP = {
  name: "Contoso Equipment",
  url: SITE,
  logo: "asset://logo",
  colors: { primary: "#0b5ea8", secondary: "#33404d" },
  company: {
    address: "1 Example Street, 51000 Springfield",
    phone: "+33 1 00 00 00 00",
    email: "contact@contoso-equipment.example",
  },
};

const page = (slug: string) => ({
  url: `${SITE}/${slug}`,
  datasheet_url: `${SITE}/fiche-technique/${slug}.pdf`,
});

export const SAMPLES: DemoSample[] = [
  {
    template: "fiche-produit-simple",
    assets: {
      logo: "logo.svg",
      "img-0": "shelving.svg",
      "img-1": "shelving-detail.svg",
      schema: "shelving-schema.svg",
    },
    data: {
      shop: SHOP,
      product: {
        id: 1001,
        name: "Rayonnage métallique 5 niveaux",
        sku: "CE-RAY-1809",
        supplier_skus: ["FR-1809-G"],
        brand: "Contoso Pro",
        category_path: ["Stockage", "Rayonnages"],
        ...page("rayonnage-metallique-5-niveaux"),
        price: { amount: "149,00", currency: "EUR", tax_included: false },
        description_short:
          "Rayonnage galvanisé à monter sans outil : cinq tablettes réglables tous les 25 mm, 150 kg par niveau.",
        description_html:
          "<p>Montants perforés et tablettes à emboîter : le rayonnage se monte <strong>sans boulon</strong> en une dizaine de minutes.</p><ul><li>Tablettes réglables au pas de 25 mm</li><li>Acier galvanisé, adapté aux locaux humides</li><li>Patins de protection du sol fournis</li></ul>",
      },
      features: [
        { name: "Hauteur", value: "1800 mm", abbreviation: "H" },
        { name: "Largeur", value: "900 mm", abbreviation: "L" },
        { name: "Profondeur", value: "400 mm", abbreviation: "P" },
        { name: "Nombre de niveaux", value: "5" },
        { name: "Charge par niveau", value: "150 kg" },
        { name: "Charge totale", value: "750 kg" },
        { name: "Finition", value: "Acier galvanisé" },
        { name: "Poids net", value: "32 kg" },
      ],
      images: [
        { src: "asset://img-0", legend: "Rayonnage chargé" },
        { src: "asset://img-1", legend: "Tablette emboîtée dans le montant" },
      ],
      schema_image: { src: "asset://schema" },
      badges: ["garantie:5", "montage:a-monter"],
      finishes: [
        {
          label: "Finition",
          options: [
            { label: "Galvanisé", color: "#b8c0c8" },
            { label: "Bleu", color: "#2b5ca8", note: "RAL 5010" },
          ],
        },
      ],
    },
  },
  {
    template: "fiche-produit-simple",
    assets: {
      logo: "logo.svg",
      "img-0": "locker-blue.svg",
      "img-1": "locker-grey.svg",
      schema: "locker-schema.svg",
    },
    data: {
      shop: SHOP,
      product: {
        id: 1002,
        name: "Vestiaire industrie 2 cases",
        sku: "CE-VES-2C",
        brand: "Contoso Pro",
        category_path: ["Vestiaires", "Vestiaires industrie"],
        ...page("vestiaire-industrie-2-cases"),
        price: { amount: "289,00", currency: "EUR", tax_included: false },
        description_short:
          "Vestiaire monobloc en tôle d'acier, deux cases avec penderie, tablette et aérations haute et basse.",
        description_html:
          "<p>Livré <strong>monté</strong>, prêt à poser. Chaque case comporte une tablette chapelière, une tringle et deux crochets.</p><ul><li>Portes renforcées, ouverture à 110°</li><li>Porte-étiquette numéroté</li><li>Socle de 100 mm pour le nettoyage des sols</li></ul>",
      },
      features: [
        { name: "Hauteur", value: "1800 mm", abbreviation: "H" },
        { name: "Largeur", value: "600 mm", abbreviation: "L" },
        { name: "Largeur d'une case", value: "300 mm", abbreviation: "l" },
        { name: "Profondeur", value: "500 mm", abbreviation: "P" },
        { name: "Matière", value: "Tôle d'acier 7/10ᵉ, peinture époxy" },
        { name: "Poids net", value: "38 kg" },
      ],
      images: [
        { src: "asset://img-0", legend: "Portes bleues" },
        { src: "asset://img-1", legend: "Portes grises" },
      ],
      schema_image: { src: "asset://schema" },
      badges: ["garantie:10", "montage:livre-monte"],
      finishes: [
        {
          label: "Coloris des portes",
          options: [
            { label: "Bleu", color: "#2b5ca8", note: "RAL 5010" },
            { label: "Gris clair", color: "#d7d7d7", note: "RAL 7035" },
            { label: "Rouge", color: "#c1121c", note: "RAL 3020" },
            { label: "Vert", color: "#57a639", note: "RAL 6018" },
          ],
        },
        {
          label: "Fermeture",
          options: [{ label: "Serrure à clés" }, { label: "Moraillon cadenas" }],
        },
      ],
    },
  },
  {
    template: "fiche-paysage",
    assets: {
      logo: "logo.svg",
      "img-0": "workbench.svg",
      schema: "workbench-schema.svg",
    },
    data: {
      shop: SHOP,
      product: {
        id: 1003,
        name: "Établi d'atelier 1500 mm avec tiroir",
        sku: "CE-ETA-1500",
        brand: "Contoso Pro",
        category_path: ["Atelier", "Établis"],
        ...page("etabli-atelier-1500-tiroir"),
        price: { amount: "419,00", currency: "EUR", tax_included: false },
        description_short:
          "Plateau en hêtre multiplis de 40 mm sur piètement acier, tiroir sur glissières et étagère basse.",
        description_html:
          "<p>Un établi pensé pour l'atelier de maintenance : le plateau en <strong>hêtre multiplis</strong> encaisse les chocs, le piètement soudé reste stable sous 500 kg.</p>",
      },
      features: [
        { name: "Longueur", value: "1500 mm", abbreviation: "L" },
        { name: "Profondeur", value: "750 mm", abbreviation: "P" },
        { name: "Hauteur", value: "900 mm", abbreviation: "H" },
        { name: "Plateau", value: "Hêtre multiplis 40 mm" },
        { name: "Charge admissible", value: "500 kg" },
        { name: "Tiroir", value: "1, sur glissières à billes" },
        { name: "Poids net", value: "64 kg" },
      ],
      images: [{ src: "asset://img-0", legend: "Établi avec étau" }],
      schema_image: { src: "asset://schema" },
      badges: ["garantie:3"],
    },
  },
  {
    template: "fiche-technique-01",
    assets: {
      logo: "logo.svg",
      "img-0": "pallet-truck.svg",
      "img-1": "pallet-truck-detail.svg",
      schema: "pallet-truck-schema.svg",
    },
    data: {
      shop: SHOP,
      product: {
        id: 1004,
        name: "Transpalette manuel 2500 kg",
        sku: "CE-TPM-2500",
        brand: "Contoso Pro",
        category_path: ["Manutention", "Transpalettes"],
        ...page("transpalette-manuel-2500-kg"),
        price: { amount: "359,00", currency: "EUR", tax_included: false },
        description_short:
          "Transpalette robuste pour l'entrepôt : pompe hydraulique à trois positions et galets tandem.",
        description_html:
          "<h3>Présentation</h3><p>Ce transpalette <strong>2500 kg</strong> manutentionne les charges palettisées au quotidien. Sa pompe offre trois positions : <em>montée</em>, <em>neutre</em> et <em>descente</em>.</p><ul><li>Châssis mécano-soudé</li><li>Roues directrices en polyuréthane</li><li>Galets tandem en nylon</li><li>Descente à vitesse contrôlée</li></ul>",
      },
      features: [
        { name: "Capacité de charge", value: "2500 kg", abbreviation: "Q" },
        { name: "Longueur des fourches", value: "1150 mm", abbreviation: "L" },
        { name: "Largeur hors fourches", value: "540 mm", abbreviation: "B" },
        { name: "Hauteur mini d'entrée", value: "85 mm", abbreviation: "h" },
        { name: "Hauteur de levée", value: "200 mm" },
        { name: "Roues directrices", value: "Polyuréthane 200 × 50 mm" },
        { name: "Poids net", value: "72 kg" },
      ],
      images: [
        { src: "asset://img-0", legend: "Vue de profil" },
        { src: "asset://img-1", legend: "Galets tandem" },
      ],
      schema_image: { src: "asset://schema" },
      badges: ["garantie:2"],
    },
  },
];
