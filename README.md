# Datasheet Studio

A drag-and-drop editor and a Chromium rendering engine that turn e-commerce product data into
print-ready PDF datasheets, plus the React design system the Studio is built on.

[![CI](https://github.com/Guillxume/datasheet-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Guillxume/datasheet-studio/actions/workflows/ci.yml)
[![Storybook](https://img.shields.io/badge/Storybook-live-ff4785?logo=storybook&logoColor=white)](https://guillxume.github.io/datasheet-studio/)

![Three datasheets rendered by the Studio from the same product API, with three different templates](docs/screenshots/studio-pdf.png)

| | |
|---|---|
| **Design system demo** | **[guillxume.github.io/datasheet-studio](https://guillxume.github.io/datasheet-studio/)**: every component in Storybook, light/dark, two themes |
| **Studio demo** | `docker compose up --build`, then open http://localhost:3000 ([details](#run-the-studio-demo)) |

```
.
├── apps/studio      Datasheet Studio: Next.js 16, Puck editor, Postgres, Gotenberg (Chromium)
└── packages/ui      @guillxume/ui: design system (shadcn/ui + Radix + Tailwind v4, TanStack Table 9)
```

> The Studio's interface and its in-depth technical docs (`apps/studio/README.md`, `apps/studio/docs/`)
> are in French. The design system and this page are in English.

---

## Run the Studio demo

Requires Docker. From the repository root:

```sh
docker compose up --build
```

The first build takes a few minutes. The stack starts in this order:

1. **Postgres**, **Gotenberg** and **Mailpit**. Gotenberg is the Chromium HTML-to-PDF service. It sits on an internal network with no internet access and JavaScript disabled.
2. A one-shot **setup** job. It runs the migrations and seeds a demo shop, *Contoso Equipment*, with three templates, an image library and a demo account. It is idempotent, so running `up` again is safe.
3. The **Studio** itself, on http://localhost:3000.
4. A one-shot **samples** job. It renders four datasheets through the public API, so the render journal and the datasheet index aren't empty.

| | |
|---|---|
| Studio | http://localhost:3000 |
| Login | `admin@example.com` / `studio-demo-2026` |
| Shop API key | `sk_000000000000_local-demo-key-not-a-secret` |
| Mailpit (invitation emails) | http://localhost:8025 |

You can change the ports or credentials with `STUDIO_PORT`, `MAIL_UI_PORT`, `DEMO_EMAIL`, `DEMO_PASSWORD` and `DEMO_API_KEY`. To reset everything, run `docker compose down -v`.

### Things to try

- **Edit a template**: open *Fiche produit simple* from the library. Switch the sample-data **profile**: the A4 canvas re-flows with a different product, a different number of features, longer names and so on. **Contrôler les 7 profils** checks the template against all of them at once. **Aperçu PDF** renders the template through Chromium.
- **Map templates to categories** in *Règles*. A shop that sends `"template": "auto"` gets a template picked from the product's category path.
- **Browse the generated datasheets** in *Consultation* and download them as a ZIP. You can also assemble several into a **book**: one PDF with covers, a clickable table of contents and bookmarks.
- **Read the render journal** in *Journal*: throughput, durations, payload weights, warnings and errors for every render.
- **Invite a user** from *Admin → Comptes*. The activation email lands in Mailpit.

### Render a PDF through the API

Shops call the Studio with a per-shop API key. The payload is the same whichever platform sends it (PrestaShop, Medusa, a PIM or a CSV import). Images are sent as multipart fields and referenced as `asset://<key>`:

```sh
D=apps/studio/scripts/demo
curl -X POST http://localhost:3000/api/v1/render \
  -H "Authorization: Bearer sk_000000000000_local-demo-key-not-a-secret" \
  -F "payload=<$D/payload.json" \
  -F "asset[logo]=@$D/images/logo.svg" \
  -F "asset[img-0]=@$D/images/shelving.svg" \
  -F "asset[img-1]=@$D/images/shelving-detail.svg" \
  -F "asset[schema]=@$D/images/shelving-schema.svg" \
  -o datasheet.pdf
```

The payload ([full file](apps/studio/scripts/demo/payload.json)) is plain product data. Branding (`shop.colors`, `shop.logo`) arrives at render time, so one library template can serve several shops:

```jsonc
{
  "template": "fiche-produit-simple",   // or "auto": picked from category_path
  "version": "published",
  "locale": "fr",
  "data": {
    "shop":     { "name": "Contoso Equipment", "logo": "asset://logo", "colors": { "primary": "#0b5ea8" } },
    "product":  { "name": "Rayonnage métallique 5 niveaux", "sku": "CE-RAY-1809",
                  "category_path": ["Stockage", "Rayonnages"], "url": "https://contoso-equipment.example/…" },
    "features": [{ "name": "Hauteur", "value": "1800 mm", "abbreviation": "H" }],
    "images":   [{ "src": "asset://img-0", "legend": "Rayonnage chargé" }],
    "schema_image": { "src": "asset://schema" },
    "badges":   ["garantie:5", "montage:a-monter"],   // resolved to pictograms by the template
    "finishes": [{ "label": "Finition", "options": [{ "label": "Bleu", "color": "#2b5ca8", "note": "RAL 5010" }] }]
  }
}
```

| Route | Purpose |
|---|---|
| `POST /api/v1/render` | Payload + assets → PDF. Returns `429` with `Retry-After` when the render queue is full. `X-Render-Warnings` lists missing assets instead of failing. |
| `GET /api/v1/templates` | Templates available to the shop (for a back-office select) |
| `GET /api/v1/schema` | The variables a template can bind to |
| `GET /api/health` | Liveness + database check |

The payload schema (zod) lives in [`apps/studio/src/lib/payload.ts`](apps/studio/src/lib/payload.ts).

---

## Datasheet Studio

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/studio-editor.png" alt="Template editor with the A4 canvas and the block properties panel"></td>
    <td width="50%"><img src="docs/screenshots/studio-templates.png" alt="Template library"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/studio-consultation.png" alt="Generated datasheets grouped by category"></td>
    <td><img src="docs/screenshots/studio-journal.png" alt="Render journal: throughput, durations and errors"></td>
  </tr>
</table>

The Studio replaced a legacy PHP generator (mPDF and hard-coded templates). The editor isn't the main gain. The real change is the **rendering engine**: Chromium provides full CSS (grid, flexbox) and real pagination, where the old generator estimated page breaks from character counts.

```
Shop back-office / collector                 Datasheet Studio
  gathers product data  ── POST payload ──▶   /api/v1/render        per-shop API key
  caches the PDF        ◀────── PDF ───────   ├─ prepareData        asset:// resolution, HTML sanitizing
                                              ├─ renderNode         Puck tree → React → HTML
                                              └─ Gotenberg          HTML → PDF (Chromium, no network)

People (editors, importers, admins) ───────▶  /                     session + role
```

- **WYSIWYG that holds**: the canvas uses the same React components, fonts and box model as the PDF, and tests lock the two together. Repeated header and footer zones, page breaks, and full-bleed versus margin layouts are all supported.
- **25 blocks**: columns, panels, positioned elements, feature tables with automatic two-column fitting, image galleries, dimensioned drawings, badge rows, finish swatches, QR codes, and reusable header/footer components.
- **Multi-shop**: a shared template library plus per-shop overrides, per-shop images and API keys, and category → template rules.
- **Stateless rendering**: no PDF is stored. Images are inlined as data URIs, so Gotenberg never needs to call back into the app. A bounded render queue caps memory under bulk generation and answers `429` instead of falling over.
- **Accounts and roles** (super-admin, admin, editor, sales, importer): scrypt passwords, single-use activation links, lockout plus a timing floor against enumeration, and a k-anonymity check against known breached passwords.
- **Collectors** for CSV, Medusa and any JSON API, for batch generation from the command line (see [`apps/studio/collectors`](apps/studio/collectors/README.md)).
- **Tested**: about 650 unit tests, SQL integration tests against a real Postgres, Playwright end-to-end tests, golden HTML files for the render pipeline, and custom ESLint rules.

Stack: Next.js 16 (App Router) · React 19 · [Puck](https://puckeditor.com) · Postgres 17 (`postgres.js`, plain SQL migrations) · Gotenberg 8 · zod 4 · `@guillxume/ui`.

---

## Design system: `@guillxume/ui`

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/ui-data-table.png" alt="DataTable with faceted filter open"></td>
    <td width="50%"><img src="docs/screenshots/ui-data-table-dark.png" alt="DataTable in dark mode"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/ui-app-shell.png" alt="App shell with nested sidebar groups"></td>
    <td><img src="docs/screenshots/ui-theme-datasheet-studio.png" alt="The datasheet-studio theme"></td>
  </tr>
</table>

A component library for internal tools: about 80 components built on [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com) and [Tailwind CSS v4](https://tailwindcss.com). It is shipped as unbundled ESM with type declarations, so `'use client'` boundaries stay per module and "go to definition" opens the source.

- **DataTable**, built on TanStack Table 9: sorting; faceted, number, date and switch filters; filter presets; column pinning and drag-to-reorder; table, card and calendar views; CSV/JSON export; bulk actions. Its state syncs to the URL with `nuqs`, and layouts persist per user.
- **App shell**: a collapsible sidebar with nested groups, keyboard shortcut and mobile sheet, plus a header and user menu. Apps pass their items, `Link` component and translations, and the shell does the rendering.
- **Forms**: `react-hook-form` + zod, with date and time pickers, OTP, password, file input, combobox, and a barcode `ScannerInput` (camera + keyboard wedge).
- **i18n-agnostic**: every interactive component takes a `labels` prop. `SettingsProvider` persists theme, locale and table layouts.
- **Themes as CSS variables**: `neutral` and `datasheet-studio`. A script checks every theme against WCAG AA contrast, in light and dark mode.

```tsx
import { Button } from '@guillxume/ui/components/button'
import { Icon } from '@guillxume/ui/components/icon'
import { DataTable, type ColumnDef } from '@guillxume/ui/components/data-table'
import { DataTableColumnHeader } from '@guillxume/ui/components/data-table-column-header'
import { DataTablePagination } from '@guillxume/ui/components/data-table-pagination'
import { Download } from 'lucide-react'

type Order = { id: string; status: string; total: number }

const columns: ColumnDef<Order>[] = [
  { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title='Order' /> },
  { accessorKey: 'status', header: ({ column }) => <DataTableColumnHeader column={column} title='Status' /> },
]

export function Orders({ orders }: { orders: Order[] }) {
  return (
    <>
      <Button variant='outline'>
        <Icon icon={Download} /> Export
      </Button>
      <DataTable columns={columns} data={orders} footer={() => <DataTablePagination />} />
    </>
  )
}
```

```css
/* app/globals.css: one theme, after Tailwind */
@import "tailwindcss";
@import "tw-animate-css";
@import "@guillxume/ui/themes/neutral.css";
```

Each component has a doc page in [`packages/ui/docs/`](packages/ui/docs), and each one has a story in the [live Storybook](https://guillxume.github.io/datasheet-studio/). The DataTable has [its own guide](packages/ui/docs/data-table.md).

---

## Development

Requires Node 22 and pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm build:ui        # the Studio consumes the design system from its dist/
pnpm dev:ui          # Storybook on http://localhost:6006
```

To run the Studio on the host with hot reload, start only its dependencies in Docker:

```sh
docker compose -f docker-compose.yml -f apps/studio/infra/docker-compose.dev.yml up -d db gotenberg mailpit
cp apps/studio/.env.dist apps/studio/.env
pnpm --filter @guillxume/studio migrate
pnpm --filter @guillxume/studio seed
pnpm dev:studio
```

The full walkthrough, with common pitfalls, is in [`apps/studio/docs/tester-en-local.md`](apps/studio/docs/tester-en-local.md) (French).

| Command | |
|---|---|
| `pnpm test` | Unit tests for both packages (Vitest for the UI, `node:test` for the Studio) |
| `pnpm typecheck` / `pnpm lint` | TypeScript and Biome / ESLint, across the workspace |
| `pnpm --filter @guillxume/studio test:integration` | SQL tests against a real Postgres (`DATABASE_URL`) |
| `pnpm --filter @guillxume/studio test:e2e` | Playwright, against a running instance |
| `pnpm build-storybook` | Static Storybook in `packages/ui/storybook-static` |

CI runs lint, types and unit tests for both packages, plus the migrations and SQL integration tests against Postgres. Every push to `main` redeploys the Storybook to GitHub Pages.

---

## License

[MIT](LICENSE). Third-party credits for the design system are listed in [`packages/ui/README.md`](packages/ui/README.md#credits).
