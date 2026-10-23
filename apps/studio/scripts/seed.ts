import { createHash, randomBytes } from "node:crypto";
import { connect } from "./_env";

/**
 * Amorce de developpement.
 *
 * Cree une boutique de test et un template de bibliotheque reproduisant la
 * mise en page du template 01 de l'ancien generateur PDF du module PrestaShop
 * (titre centre, visuel principal a gauche / accroche + vignettes a droite,
 * schema cote face au tableau de caracteristiques, description en dessous).
 *
 * Idempotent : relancer ne cree pas de doublon et ne regenere pas la cle.
 *
 * DEMO_API_KEY (facultatif) fixe la cle de la boutique a sa creation, au lieu
 * d'en tirer une au hasard : c'est ce qui rend copiable l'exemple `curl` de la
 * demonstration (docker-compose.yml a la racine). Une cle connue de tous, donc
 * pour une instance locale uniquement.
 */

const SHOP_SLUG = "contoso-equipment";
const SHOP_NAME = "Contoso Equipment";
const API_KEY = /^sk_([0-9a-f]{12})_[A-Za-z0-9_-]{16,}$/;
const TEMPLATE_SLUG = "fiche-technique-01";

let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;

const node = (type: string, props: Record<string, unknown>) => ({
  type,
  props: { id: id(type.toLowerCase()), ...props },
});

const body = {
  root: { props: { padding: 12 } },
  zones: {},
  content: [
    node("Heading", {
      text: "{{product.name}}",
      level: "h1",
      size: 20,
      align: "center",
      color: "var(--color-primary)",
      uppercase: true,
    }),
    node("Columns", {
      ratio: "1fr 1fr",
      gap: 6,
      align: "start",
      left: [node("ImageGallery", { source: "{{images}}", skip: 0, limit: 1, columns: 1, gap: 0, border: false })],
      right: [
        node("Text", { content: "{{product.description_short}}", size: 10, align: "left", bold: false }),
        node("Spacer", { height: 3 }),
        node("ImageGallery", { source: "{{images}}", skip: 1, limit: 4, columns: 4, gap: 2, border: false }),
      ],
    }),
    node("Spacer", { height: 5 }),
    node("Columns", {
      ratio: "1fr 1fr",
      gap: 6,
      align: "start",
      left: [node("SchemaImage", { source: "{{schema_image.src}}", width: 100, align: "center" })],
      right: [
        node("FeatureTable", {
          source: "{{features}}",
          heading: "",
          nameHeader: "Caracteristique",
          valueHeader: "Valeur",
          showHeader: false,
          showAbbreviation: true,
          striped: true,
          size: 9,
        }),
      ],
    }),
    node("Spacer", { height: 5 }),
    node("BadgeRow", { source: "{{badges}}", height: 14, gap: 4, align: "center", mapping: [] }),
    node("Divider", { thickness: 1, color: "var(--color-primary)", margin: 4 }),
    node("Heading", {
      text: "Description",
      level: "h2",
      size: 12,
      align: "left",
      color: "var(--color-primary)",
      uppercase: false,
    }),
    node("RichText", { html: "{{product.description_html}}", size: 9, columns: 1 }),
  ],
};

const header = {
  root: { props: {} },
  zones: {},
  content: [
    node("PageHeader", {
      title: "{{product.name}}",
      subtitle: "{{product.sku}}",
      logoUrl: "{{shop.logo}}",
      logoHeight: 12,
      backgroundUrl: "",
      backgroundColor: "var(--color-primary)",
      textColor: "#ffffff",
      height: 26,
    }),
  ],
};

const footer = {
  root: { props: {} },
  zones: {},
  content: [
    node("PageFooter", {
      left: "{{shop.company.address}}",
      center: "{{shop.company.phone}} - {{shop.company.email}}",
      backgroundColor: "var(--color-secondary)",
      textColor: "#ffffff",
      height: 16,
      showPageNumbers: true,
    }),
  ],
};

const settings = {
  geometry: {
    width: 210,
    height: 297,
    margins: { top: 32, right: 0, bottom: 22, left: 0 },
  },
};

async function main() {
  const sql = connect();

  // --- Boutique ------------------------------------------------------------

  const existing = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${SHOP_SLUG}`;
  let shopId: string;

  if (existing[0]) {
    shopId = existing[0].id;
    console.log(`boutique existante  ${SHOP_SLUG}`);
  } else {
    const demo = process.env.DEMO_API_KEY?.trim() || null;
    if (demo !== null && !API_KEY.test(demo)) {
      throw new Error("DEMO_API_KEY invalide : format attendu sk_<12 hexadecimaux>_<16 caracteres ou plus>.");
    }
    const key = demo ?? `sk_${randomBytes(6).toString("hex")}_${randomBytes(24).toString("base64url")}`;
    const prefix = key.split("_")[1];
    const hash = createHash("sha256").update(key, "utf8").digest("hex");

    const inserted = await sql<{ id: string }[]>`
      INSERT INTO shops (slug, name, api_key_prefix, api_key_hash, webhook_secret)
      VALUES (${SHOP_SLUG}, ${SHOP_NAME}, ${prefix}, ${hash},
              ${randomBytes(24).toString("hex")})
      RETURNING id
    `;
    shopId = inserted[0].id;

    console.log(`boutique creee      ${SHOP_SLUG}`);
    console.log("");
    console.log(demo ? "  CLE API (cle de demonstration, DEMO_API_KEY) :" : "  CLE API (affichee une seule fois) :");
    console.log(`  ${key}`);
    console.log("");
  }

  // --- Template de bibliotheque -------------------------------------------

  const found = await sql<{ id: string }[]>`
    SELECT id FROM templates WHERE slug = ${TEMPLATE_SLUG} AND shop_id IS NULL
  `;

  if (found[0]) {
    console.log(`template existant   ${TEMPLATE_SLUG}`);
    await sql.end();
    return;
  }

  await sql.begin(async (tx) => {
    const template = await tx<{ id: string }[]>`
      INSERT INTO templates (shop_id, slug, name)
      VALUES (NULL, ${TEMPLATE_SLUG}, ${"Fiche technique 01 (bibliotheque)"})
      RETURNING id
    `;
    const templateId = template[0].id;

    const version = await tx<{ id: string }[]>`
      INSERT INTO template_versions (template_id, number, body, header, footer, css, settings, note)
      VALUES (${templateId}, 1,
              ${tx.json(body)}, ${tx.json(header)}, ${tx.json(footer)},
              ${null}, ${tx.json(settings)},
              ${"Reprise de la mise en page du template 01 de l'ancien generateur PDF"})
      RETURNING id
    `;

    await tx`
      UPDATE templates SET published_version_id = ${version[0].id}, updated_at = now()
      WHERE id = ${templateId}
    `;
  });

  console.log(`template cree       ${TEMPLATE_SLUG} (version 1 publiee)`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
