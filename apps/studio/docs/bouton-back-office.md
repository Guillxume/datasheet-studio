# Ajouter un bouton « Fiche technique » dans un back-office

**Objet :** faire apparaître, dans l'administration d'une boutique ou d'un PIM, un bouton qui
produit la fiche technique PDF d'un produit — **à l'unité** depuis sa page, et **en masse** depuis
la liste.

**À qui c'est destiné :** la personne qui écrira l'intégration côté back-office. Elle n'a pas
besoin de connaître le Studio, seulement ce document et
[docs/integrer-un-connecteur.md](integrer-un-connecteur.md) pour le détail du contrat.

**PrestaShop est déjà couvert** par le module `acmedatasheet` : ce document ne le concerne pas,
sauf au §7 qui dit où regarder. Il vise **Medusa**, les **PIM/ERP** et tout back-office maison.

---

## 1. La seule règle d'architecture qui compte

**La clé API du Studio ne doit jamais atteindre le navigateur.**

Une clé de boutique donne le droit de rendre n'importe quelle fiche avec n'importe quelles données,
sous l'identité de la boutique. Un bouton d'administration qui appellerait le Studio directement
depuis le navigateur mettrait cette clé dans le code JavaScript servi, donc dans l'onglet
« Réseau » de tout le monde.

Le bouton appelle donc **votre back-office**, qui appelle le Studio :

```
Navigateur (admin)                Votre back-office              Datasheet Studio
  clic « Fiche technique »
        │
        └── GET /admin/fiches/:id ──▶  collecte le produit
                                       construit le payload
                                       ── POST /api/v1/render ──▶  rend le PDF
                                          Authorization: Bearer sk_…
                                       ◀────────── application/pdf ──
                                       range ou renvoie le PDF
        ◀──────── PDF ────────────────
```

La clé vit dans les **variables d'environnement du serveur** de votre back-office. Elle est émise
depuis `/admin/boutiques` du Studio, et n'est lisible **qu'une fois**.

> **Corollaire.** Une intégration correcte se reconnaît à ce qu'aucun fichier de son dossier
> `admin/` ou `frontend/` ne contient la chaîne `sk_`.

## 2. Ce que le bouton doit faire, en trois gestes

1. **Collecter** les données du produit et les mettre au format du contrat (§4 de
   [docs/integrer-un-connecteur.md](integrer-un-connecteur.md)).
2. **Appeler** `POST /api/v1/render` avec la clé en `Authorization: Bearer`.
3. **Faire quelque chose du PDF.** Le Studio **ne stocke rien** — il n'existe aucun point d'entrée
   pour relire une fiche déjà rendue. Le stockage appartient à l'intégration, et c'est une décision
   à prendre **tôt** (§6).

Un bouton qui s'arrête au geste 3 en renvoyant le PDF directement au navigateur fonctionne. Il est
simplement coûteux : chaque clic relance un Chromium.

## 3. Le contrat HTTP, en résumé

```http
POST /api/v1/render
Authorization: Bearer sk_<prefixe>_<secret>
Content-Type: application/json

{
  "template": "fiche-technique-01",
  "version": "published",
  "locale": "fr",
  "data": { "shop": { … }, "product": { … }, "features": [ … ], "images": [ … ] }
}
```

| Réponse | Ce que ça veut dire | Ce que l'intégration doit faire |
|---|---|---|
| `200` `application/pdf` | la fiche | l'en-tête `X-Template-Version` dit quelle version a servi — **à conserver**, c'est la clé de l'invalidation de cache |
| `200` + `X-Render-Warnings` | rendue, mais une image ou une référence manquait | journaliser ; ce n'est pas un échec |
| `401` | clé absente, invalide, ou boutique désactivée | ne pas réessayer |
| `422` | payload invalide | le corps JSON dit **quel champ** ; corriger le mapping |
| `429` + `Retry-After` | moteur saturé (une génération en masse tourne) | **attendre puis reprendre** — c'est prévu, pas une panne |
| `502` | Chromium a échoué (CSS invalide, délai dépassé) | journaliser le `detail`, c'est ce qui permet de corriger le template |

Deux formes de corps sont acceptées, et le choix dépend d'**où sont vos images** :

| `Content-Type` | Quand | Comment |
|---|---|---|
| `application/json` | vos médias sont sur des **URL publiques** joignables depuis le Studio (CDN, S3 public) | le payload seul, `images[].src` = l'URL |
| `multipart/form-data` | vos médias sont **locaux** ou derrière un réseau privé | champ `payload` (le JSON) + un champ `asset[<clé>]` par fichier, et `images[].src` = `asset://<clé>` |

Le second est celui des back-offices dockerisés dont le domaine ne résout pas depuis le conteneur
du Studio — c'est-à-dire la plupart des installations de développement.

## 4. Medusa v2 — le bouton unitaire

> **Les noms d'API de l'administration Medusa bougent d'une version mineure à l'autre.** Ce qui
> suit vise **Medusa v2**. Vérifier `defineWidgetConfig`, le nom des zones d'injection et la
> signature de `query.graph` dans la documentation de **votre** version avant de coller.

### 4.1 La variable d'environnement

Dans le `.env` du serveur Medusa :

```dotenv
STUDIO_URL=https://studio.acme.example
STUDIO_KEY=sk_…                     # émise dans /admin/boutiques du Studio
STUDIO_TEMPLATE=fiche-technique-01  # défaut, surchargeable par produit
```

### 4.2 La route d'administration — `src/api/admin/fiches-techniques/[id]/route.ts`

Elle est servie sous `/admin`, donc **déjà authentifiée** par la session d'administration de
Medusa : seul quelqu'un de connecté au back-office peut l'appeler.

```ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * GET /admin/fiches-techniques/:id  ->  application/pdf
 *
 * Le navigateur ne voit jamais la clé du Studio : elle est lue ici, côté serveur.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: [produit] } = await query.graph({
    entity: "product",
    fields: [
      "id", "title", "subtitle", "handle", "description", "thumbnail",
      "metadata",
      "images.url",
      "options.title", "options.values.value",
      "categories.name",
      "collection.title",
      "type.value",
      "tags.value",
      "variants.id", "variants.sku", "variants.barcode", "variants.title",
      "variants.metadata",
      "variants.calculated_price.*",
    ],
    filters: { id: req.params.id },
  });

  if (!produit) {
    return res.status(404).json({ message: "Produit introuvable" });
  }

  const reponse = await fetch(`${process.env.STUDIO_URL}/api/v1/render`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.STUDIO_KEY}`,
    },
    body: JSON.stringify({
      /*
       * « auto » laisse le Studio choisir d'apres la categorie du produit,
       * selon les regles ecrites dans /regles. Une metadonnee de produit reste
       * prioritaire : c'est ainsi qu'on force un modele pour un produit precis.
       * Voir §4 bis de docs/integrer-un-connecteur.md.
       */
      template: (produit.metadata?.template_fiche as string) ?? "auto",
      locale: "fr",
      data: construirePayload(produit),
    }),
  });

  // 429 : le Studio est saturé par une génération en masse. On rend la main au
  // navigateur avec le même en-tête, plutôt que de faire patienter la requête.
  if (reponse.status === 429) {
    res.setHeader("retry-after", reponse.headers.get("retry-after") ?? "5");
    return res.status(429).json({ message: "Moteur de rendu saturé, réessayer dans un instant." });
  }

  if (!reponse.ok) {
    const detail = await reponse.text();
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`fiche ${req.params.id} : ${detail}`);
    return res.status(502).json({ message: "Le Studio n'a pas pu rendre la fiche.", detail });
  }

  const pdf = Buffer.from(await reponse.arrayBuffer());

  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", `inline; filename="fiche-${produit.handle ?? produit.id}.pdf"`);
  // Conserver la version du template : c'est elle qui dit si un PDF en cache
  // est périmé (voir §6).
  res.setHeader("x-template-version", reponse.headers.get("x-template-version") ?? "");
  // Le slug REELLEMENT servi. Indispensable avec « auto » : il entre dans la cle
  // de cache (§6), sinon une regle modifiee dans le Studio ne se verrait jamais.
  res.setHeader("x-template-slug", reponse.headers.get("x-template-slug") ?? "");
  return res.send(pdf);
}
```

### 4.3 La correspondance — `construirePayload`

C'est **la seule partie qui demande une décision**, et elle est déjà écrite une fois dans ce dépôt :
[`collectors/medusa/source.ts`](../collectors/medusa/source.ts) fait exactement ce mapping pour la
ligne de commande. La version ci-dessous en est la forme minimale, à recopier dans le projet
Medusa.

```ts
/** Un produit Medusa v2 -> le contrat du Studio. */
function construirePayload(p: any) {
  // La première variante porte le SKU et le code-barres. `variants: "all"`
  // du collecteur produit une fiche PAR variante ; pour un bouton, la
  // première suffit — c'est le produit qu'on regarde à l'écran.
  const variante = p.variants?.[0];
  const prix = variante?.calculated_price;

  return {
    shop: {
      // Ces valeurs sont posées une fois pour toutes dans /admin/boutiques du
      // Studio. Les répéter ici les ferait diverger : préférer les lire depuis
      // votre propre configuration si vous en avez une.
      name: process.env.STUDIO_SHOP_NAME ?? "Boutique",
      url: process.env.STORE_URL,
    },
    product: {
      id: p.id,
      name: p.title,
      sku: variante?.sku ?? null,
      gtin: variante?.barcode ?? null,
      url: p.handle ? `${process.env.STORE_URL}/products/${p.handle}` : null,
      brand: p.collection?.title ?? p.type?.value ?? null,
      category_path: (p.categories ?? []).map((c: any) => c.name),
      price: prix
        ? {
            // Montant BRUT, séparateur point. Le formatage (espace insécable,
            // symbole, position) est fait par le Studio au rendu : c'est ce qui
            // garantit une fiche identique depuis le web et depuis un cron.
            amount: String(prix.calculated_amount),
            currency: (prix.currency_code ?? "eur").toUpperCase(),
            tax_included: prix.is_calculated_price_tax_inclusive ?? undefined,
          }
        : undefined,
      description_html: p.description ?? null,
      description_short: p.subtitle ?? null,
    },
    // Les options de produit font des caractéristiques honnêtes ; les
    // métadonnées de variante complètent ce que le catalogue ne modélise pas.
    features: [
      ...(p.options ?? []).map((o: any) => ({
        name: o.title,
        value: (o.values ?? []).map((v: any) => v.value).join(", "),
      })),
      ...Object.entries(variante?.metadata ?? {}).map(([name, value]) => ({
        name,
        value: String(value),
      })),
    ].filter((f) => f.value !== ""),
    images: (p.images ?? []).map((i: any) => ({ src: i.url })),
    badges: (p.tags ?? []).map((t: any) => t.value),
  };
}
```

> **Si vos images ne sont pas sur une URL publique** — un `localhost:9000` de développement, un
> stockage privé — remplacez `images[].src` par `asset://img-0`, `asset://img-1`… et envoyez la
> requête en `multipart/form-data` : un champ `payload` avec le JSON, un champ `asset[img-0]` par
> fichier. Sinon Chromium ne les atteindra pas et le rendu sortira avec un avertissement, sans
> image.

### 4.4 Le bouton — `src/admin/widgets/fiche-technique.tsx`

```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types";
import { Button, Container, Heading, Text, toast } from "@medusajs/ui";
import { useState } from "react";

const FicheTechniqueWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [enCours, setEnCours] = useState(false);

  const ouvrir = async () => {
    setEnCours(true);
    try {
      // `credentials: "include"` : la route est sous /admin, elle est protégée
      // par la session d'administration de Medusa.
      const reponse = await fetch(`/admin/fiches-techniques/${data.id}`, {
        credentials: "include",
      });
      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}));
        throw new Error(corps.message ?? `HTTP ${reponse.status}`);
      }

      // Un objet blob et non une URL directe : la route est un GET authentifié,
      // l'ouvrir dans un onglet neuf perdrait le contexte de session sur
      // certaines configurations.
      const url = URL.createObjectURL(await reponse.blob());
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      toast.error("Fiche technique", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Fiche technique</Heading>
        <Button variant="secondary" size="small" isLoading={enCours} onClick={ouvrir}>
          Générer le PDF
        </Button>
      </div>
      <Text className="txt-small text-ui-fg-subtle px-6 py-4">
        Rendue par le Datasheet Studio à partir du template configuré pour ce produit.
      </Text>
    </Container>
  );
};

export const config = defineWidgetConfig({
  // La colonne de droite de la fiche produit : le bouton y est à côté des
  // autres actions sur ce produit, pas noyé dans le contenu.
  zone: "product.details.side.after",
});

export default FicheTechniqueWidget;
```

## 5. Medusa v2 — la génération en masse

Le geste unitaire ne suffit pas : personne ne cliquera quatre cents fois. Deux formes, selon qui
attend.

### 5.1 Un lot lancé depuis la liste des produits

Un second widget sur `zone: "product.list.after"` poste une liste d'identifiants à une route qui
**rend fiche par fiche** et renvoie une archive.

```ts
// src/api/admin/fiches-techniques/lot/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * POST /admin/fiches-techniques/lot   { ids: string[] }
 *
 * UNE REQUÊTE PAR FICHE VERS LE STUDIO, jamais une requête qui en demanderait
 * quatre cents. C'est le même choix que la page d'import du Studio, et pour la
 * même raison : une requête de dix minutes ne traverse pas un reverse proxy, et
 * ne montre rien pendant qu'elle dure.
 *
 * CONCURRENCE BORNÉE À 2. Le Studio a son propre sas (MAX_CONCURRENT_RENDERS) et
 * répond 429 au-delà ; pousser plus fort ne rend pas plus vite, ça produit des
 * 429 qu'il faut ensuite rejouer.
 */
export async function POST(req: MedusaRequest<{ ids: string[] }>, res: MedusaResponse) {
  const ids = req.body.ids ?? [];
  const resultats: Array<{ id: string; ok: boolean; erreur?: string }> = [];

  const file = [...ids];
  const ouvriers = Array.from({ length: 2 }, async () => {
    for (let id = file.shift(); id !== undefined; id = file.shift()) {
      try {
        await rendreEtStocker(req.scope, id);   // §6
        resultats.push({ id, ok: true });
      } catch (cause) {
        resultats.push({ id, ok: false, erreur: String(cause) });
      }
    }
  });

  await Promise.all(ouvriers);

  return res.json({
    total: ids.length,
    rendus: resultats.filter((r) => r.ok).length,
    echecs: resultats.filter((r) => !r.ok),
  });
}
```

Le widget correspondant affiche une progression et **rejoue les seuls échecs** — c'est ce qui rend
un lot de quatre cents fiches exploitable : une image manquante sur trois produits ne doit pas
obliger à tout relancer.

### 5.2 Un catalogue entier, sans bouton

Pour « toutes les fiches, toutes les nuits », **n'écrivez rien** : le collecteur Medusa du Studio
le fait déjà, avec ce qu'un bouton ne peut pas avoir — cache de fraîcheur, détection des
republications de template, lots bornés par un budget de temps, quarantaine des références qui
échouent.

```sh
STUDIO_KEY=sk_… pnpm collect:medusa \
  --medusa-url https://admin.exemple.fr \
  --medusa-key sk_… \
  --template fiche-technique-01 \
  --out /var/www/fiches
```

Voir [collectors/README.md](../collectors/README.md). **La ligne de partage est nette :** le bouton
sert le lot qu'on regarde passer, le collecteur sert le catalogue.

## 6. Où stocker les PDF — et quand les rejeter

Le Studio ne stocke rien. Rendre à chaque affichage marche, mais lance un Chromium par clic.

**La recommandation :** stocker le PDF dans le module de fichiers de votre back-office (Medusa :
`Modules.FILE`), sous une clé qui contient **de quoi savoir s'il est périmé** :

```
fiches/<id-produit>/<slug-template>-v<version>-<empreinte-produit>.pdf
```

| Composant | Ce qu'il invalide |
|---|---|
| `<slug-template>` | l'en-tête **`X-Template-Slug`**, et non le template que *vous* avez demandé. Avec `"auto"`, c'est le Studio qui choisit : une règle modifiée dans `/regles` change ce slug, et sans lui vous resserviriez indéfiniment une fiche au mauvais modèle |
| `<version>` | l'en-tête `X-Template-Version` de la réponse. Republier le template change ce nombre : **toutes** les fiches deviennent périmées, ce qui est bien le comportement voulu |
| `<empreinte-produit>` | le `updated_at` du produit, ou un hachage des champs qui entrent dans la fiche. Un prix modifié doit produire une nouvelle fiche |

Un cache sans l'un des deux se trompe dans un sens ou dans l'autre : soit il ressert une fiche à
l'ancien prix, soit il ne ressert jamais rien.

## 7. PrestaShop

**Rien à écrire.** Le module `acmedatasheet` porte déjà le bouton, sa page de configuration, le
choix du template (alimenté par `GET /api/v1/templates`) et le cache. La seule opération est de
reporter dans sa configuration la clé API émise depuis `/admin/boutiques` du Studio.

Marquer la boutique comme **PrestaShop** dans ses réglages (`/admin/boutiques` → *Back-office
d'origine*) : ce champ ne change aucun comportement, il documente le parc à l'endroit où l'on
cherche.

## 8. Un PIM, un ERP, un back-office maison

Deux chemins, et il faut choisir en fonction de qui va l'écrire.

**Vous voulez un bouton dans une interface existante :** reprendre le §2. Le seul travail est la
correspondance entre vos champs et ceux du contrat. Le §4 de
[docs/integrer-un-connecteur.md](integrer-un-connecteur.md) liste chaque champ, obligatoire ou non.

**Vous voulez alimenter le Studio sans écrire de code :** le collecteur d'API générique est
**déclaratif**. Un fichier JSON décrit où taper, comment paginer, et quel champ de la source
alimente quel champ du contrat — voir
[`collectors/api/exemple.config.json`](../collectors/api/exemple.config.json).

```sh
STUDIO_KEY=sk_… pnpm collect:api mon-pim.json --dry-run   # voir sans envoyer
STUDIO_KEY=sk_… pnpm collect:api mon-pim.json
```

**Aucun secret dans ce fichier** : l'authentification n'y nomme que des *variables
d'environnement* (`token_env`, jamais `token`). Un fichier de configuration se versionne, se copie,
se colle dans un ticket — un jeton qui y figure finit par fuir.

## 9. Les six pièges, dans l'ordre où on tombe dedans

1. **La clé dans le navigateur.** Le §1. Si un fichier de votre dossier `admin/` contient `sk_`,
   l'intégration est à refaire.
2. **Les images en URL privée.** `http://localhost:9000/…` est **refusé** par le Studio, qui filtre
   les adresses non routables pour ne pas servir de relais vers un réseau interne. Le rendu
   réussit, la fiche sort sans images, et `X-Render-Warnings` nomme la référence et le motif —
   personne ne le lit. Passer en `multipart` avec `asset://`.
3. **Le prix déjà formaté.** Envoyer `"349,00 €"` dans `price.amount` produit une fiche avec un
   prix non formaté. Le contrat attend un **montant brut à séparateur point** ; le formatage est
   fait au rendu, et c'est ce qui garantit un résultat identique depuis le web et depuis un cron.
4. **Une requête pour tout le lot.** Quatre cents fiches en une requête tiennent dix minutes,
   au-delà de ce que laisse passer un reverse proxy, et ne montrent rien pendant ce temps. Une
   requête par fiche (§5.1).
5. **Le 429 traité comme une erreur.** Il signifie « une génération en masse est en cours » et
   porte un `Retry-After`. Un client correct attend et reprend ; un client qui abandonne perd le
   lot.
6. **Le cache sans version ni slug de template.** Republier un template ne change rien de visible
   côté produit : sans `X-Template-Version` dans la clé de cache, les anciennes fiches restent
   servies indéfiniment. Et avec `"auto"`, il faut aussi `X-Template-Slug` — c'est le Studio qui
   décide du modèle, et une règle modifiée doit périmer les fiches concernées (§6).

## 10. Contrôler l'intégration

```sh
# 1. La clé est bonne, et voici les templates que cette boutique voit
curl -s -H "Authorization: Bearer $STUDIO_KEY" https://studio.acme.example/api/v1/templates | jq

# 2. Les variables disponibles dans les templates, servies par le Studio lui-même
curl -s -H "Authorization: Bearer $STUDIO_KEY" https://studio.acme.example/api/v1/schema | jq

# 3. Une fiche de bout en bout
curl -s -X POST https://studio.acme.example/api/v1/render \
  -H "Authorization: Bearer $STUDIO_KEY" \
  -H 'content-type: application/json' \
  -d @payload.json -D en-tetes.txt -o fiche.pdf
grep -i 'x-template-version\|x-render-warnings' en-tetes.txt
```

Le point 2 est le plus utile en cas de doute : la liste est **servie par le Studio**, tirée du même
module que le panneau « Variables » de l'éditeur — elle ne peut donc pas être périmée par rapport à
ce que les templates savent lire. La référence du *payload*, elle, est le schéma zod de
[`src/lib/payload.ts`](../src/lib/payload.ts), et un mapping fautif y échoue au premier produit
plutôt qu'au trois-centième.
