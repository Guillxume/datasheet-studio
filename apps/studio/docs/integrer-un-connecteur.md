# Brancher une autre source que PrestaShop

**Objet :** ce qu'il faut écrire pour alimenter le Studio depuis un PIM, un ERP, un back-office
NestJS, Symfony, Rust, ou n'importe quoi d'autre.

**À qui c'est destiné :** la personne qui écrira le connecteur. Elle n'a pas besoin de connaître
le Studio, seulement ce document.

> **Trois implémentations existent déjà** — CSV, Medusa, et une API JSON générique pilotée par un
> fichier de configuration : voir **[collectors/README.md](../collectors/README.md)**. Elles
> portent le noyau décrit au §5 (cache de fraîcheur, détection des republications, lots
> reprenables, quarantaine). Écrire un quatrième collecteur revient à fournir une `Source` ; le
> présent document reste la référence du contrat, elles n'en sont que des clients.

**Vérifié le 17/08/2026** contre le code des routes `src/app/api/v1/*` et du schéma
`src/lib/payload.ts`. Tout ce qui suit est lu dans le code, pas de mémoire — mais un contrat se
périme : en cas de doute, la source de vérité est `renderRequestSchema` dans `src/lib/payload.ts`.

---

## 1. Le point de départ : il n'y a rien de PrestaShop dans le Studio

Le Studio ne connaît de l'appelant qu'**un objet JSON**. C'est écrit en tête de
`src/lib/payload.ts` et les noms de champs ont été choisis pour ça :

```
PrestaShop  reference -> sku      ean13 -> gtin
Medusa      variant.sku -> sku    variant.barcode -> gtin
```

Il n'existe aucune table `prestashop`, aucun champ `id_product`, aucune notion de boutique
PrestaShop côté Studio. Une « boutique » y est juste une ligne portant un nom, une clé API et des
templates.

**Conséquence directe :** brancher un PIM ne demande **aucune modification du Studio**. Le module
PrestaShop est un client parmi d'autres, et il ne bénéficie d'aucun privilège.

Ce que vous avez à écrire, c'est donc uniquement le client. Voici son cahier des charges.

---

## 2. Ce que le connecteur doit faire, au minimum

Trois choses, et c'est tout pour un premier PDF :

1. **Construire le payload** à partir de votre source de données (§4).
2. **Envoyer** `POST /api/v1/render` avec la clé API en `Authorization: Bearer` (§3).
3. **Faire quelque chose du PDF reçu** — l'écrire sur disque, dans un stockage objet, le renvoyer
   au navigateur. Le Studio **ne stocke rien** : il n'existe aucun endpoint pour relire un PDF
   déjà rendu. Le stockage appartient au connecteur, et c'est une décision d'architecture à
   prendre tôt.

Un client qui s'arrête là fonctionne. Il est simplement coûteux : chaque affichage relance un
Chromium.

## 3. Le contrat HTTP

### Authentification

```
Authorization: Bearer sk_<prefixe>_<secret>
```

Une clé par boutique, émise côté Studio par `pnpm issue-key <slug-boutique>`. Le Studio
stocke le préfixe en clair (pour retrouver la ligne) et le sha256 du secret. La clé détermine la
boutique, donc les templates visibles et les assets lisibles — un template ne peut lire que la
bibliothèque commune et les assets de sa propre boutique.

### `POST /api/v1/render` → `application/pdf`

Deux formes de corps, au choix :

| Content-Type | Quand | Comment |
|---|---|---|
| `application/json` | vos médias sont sur des **URLs publiques** joignables depuis le Studio (CDN) | le payload seul |

> **« Publiques » est désormais vérifié, pas seulement conseillé.** Une URL dont le nom résout sur
> une adresse non routable — boucle locale, 10/8, 172.16/12, 192.168/16, 169.254/16, IPv6
> unique-local — est **refusée**, et la référence apparaît dans `X-Render-Warnings`. Les
> redirections sont revalidées une par une. Si vos médias ne sont pas joignables depuis Internet,
> le mode `multipart/form-data` avec `asset://` est la bonne réponse — pas une URL interne.
>
> C'est le Studio qui télécharge ces images, pas le moteur de rendu : au plus **64 par fiche**,
> **10 Mo par image**, **48 Mo par fiche** au total, types `image/jpeg`, `png`, `gif`, `webp`,
> `avif`, `svg+xml`, `bmp`. Au-delà, l'image est omise et signalée dans `X-Render-Warnings`.
| `multipart/form-data` | vos médias sont des **chemins locaux** ou derrière un réseau privé | champ `payload` (le JSON) + un champ `asset[<clé>]` par fichier |

En multipart, le champ `payload` est accepté aussi bien comme valeur de champ que comme fichier
joint — `curl -F payload=@fiche.json` et `curl -F payload='{...}'` marchent tous les deux.

Types d'assets acceptés : `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`.
Tout autre type est refusé en 415 en nommant la clé fautive.

Taille maximale du corps : `MAX_REQUEST_BYTES`, 32 Mio par défaut.

**Réponse 200 :** le PDF, avec deux en-têtes à lire :

- `x-template-version` — le numéro de version réellement utilisé. **À stocker** : c'est ce qui
  permet de savoir plus tard qu'un template a été republié et que le PDF est périmé.
- `x-render-warnings` — présent seulement s'il y a lieu, URL-encodé, séparateur ` | `. Un asset
  introuvable ne fait pas échouer le rendu ; sans lire cet en-tête, vous ne le sauriez pas.
  L'en-tête est plafonné à 900 caractères ; la troncature porte sur le **texte**, jamais sur son
  encodage, et se termine par `...`. Décoder reste donc toujours possible — ce n'était pas le cas
  jusqu'au 27/08/2026 : la coupe tombait au milieu d'une séquence `%XX` dès qu'un avertissement
  portait un accent, et `decodeURIComponent` échouait alors sur la ligne **entière**. Un client
  écrit contre l'ancienne version gagne à entourer son décodage d'un `try`.

**Codes d'erreur, et ce qu'ils veulent dire pour votre logique de reprise :**

| Code | Sens | Rejouable ? |
|---|---|---|
| 401 | clé absente ou invalide | non |
| 415 | Content-Type ou type d'asset refusé | non |
| 422 | payload invalide — le détail contient l'arbre d'erreurs zod avec le **chemin exact** du champ fautif | non |
| 404 | template inconnu ou sans version publiée | non |
| 413 | corps trop volumineux | non |
| 429 | moteur saturé, en-tête `Retry-After` (5 s) | **oui** |
| 502 | Chromium a lâché | **oui** |
| 500 | autre | à examiner |

La distinction 429/502 contre le reste est le cœur d'une génération en masse correcte : sans elle,
un incident d'infrastructure se confond avec un template cassé, et l'un se réessaie quand l'autre
demande une correction. Le sas de rendu accepte `MAX_CONCURRENT_RENDERS` rendus simultanés (4 par
défaut) et `MAX_QUEUED_RENDERS` en attente (8) avant de répondre 429.

### `GET /api/v1/templates`

Les templates de la boutique **et** ceux de la bibliothèque commune. Chaque entrée porte `slug`,
`name`, `shared`, `published_version` et `selectable` — un template sans version publiée ne peut
pas être utilisé, autant le griser dans votre interface plutôt que d'échouer au rendu.

Sert à deux choses : peupler votre sélecteur de template, et **détecter les republications** en
comparant `published_version` à la version stockée avec chaque PDF.

### `GET /api/v1/schema`

L'arbre des variables utilisables dans les templates (`{{product.name}}`, `{{features}}`…), avec
leurs libellés. Utile pour une aide contextuelle dans votre back-office. Même source que le
panneau « Variables » de l'éditeur : les deux ne peuvent pas diverger.

---

## 4. Le payload

> **`template` accepte la valeur `"auto"`**, qui demande au Studio de choisir d'après la catégorie
> du produit. Voir §4 bis — c'est la réponse au fait qu'un rayonnage complexe et un repose-pieds
> n'ont pas les mêmes besoins de mise en page.

```json
{
  "template": "fiche-technique-01",
  "version": "published",
  "locale": "fr",
  "data": {
    "shop": {
      "name": "Espace Équipement",
      "url": "https://exemple.fr",
      "logo": "asset://logo",
      "colors": { "primary": "#0b5ea8", "secondary": "#33404d" },
      "company": { "address": "…", "phone": "…", "email": "…", "legal": "…" }
    },
    "product": {
      "id": 650,
      "name": "Transpalette manuel 2500 kg",
      "sku": "TPM-2500",
      "gtin": "3701234567890",
      "mpn": null,
      "variant_skus": ["TPM-2500-L", "TPM-2500-C"],
      "supplier_skus": ["FRN-88231"],
      "url": "https://exemple.fr/650-transpalette.html",
      "datasheet_url": "https://exemple.fr/fiche-technique/transpalette-manuel-2500-kg-650.pdf",
      "brand": "Manutan",
      "category_path": ["Manutention", "Transpalettes"],
      "price": { "amount": "349.00", "currency": "EUR", "tax_included": false },
      "description_html": "<p>…</p>",
      "description_short": "Texte simple, sans balises."
    },
    "features": [
      { "name": "Capacité de charge", "value": "2500 kg", "abbreviation": "Q", "group": null }
    ],
    "images": [{ "src": "asset://img-0", "legend": "Vue trois quarts" }],
    "schema_image": { "src": "asset://schema" },
    "badges": ["ce", "garantie:3ans"],
    "qr_code": null,

    "finishes": [
      {
        "label": "Coloris des portes",
        "options": [{ "label": "Bleu", "color": "#2b4ea2" }, { "label": "Gris" }],
        "note": "Pour vestiaire 2 portes uniquement"
      }
    ],
    "accessories": [
      {
        "name": "Coiffe inclinée",
        "image": "asset://acc-0",
        "description": "Empêche le dépôt d'objets sur le vestiaire.",
        "features": [{ "name": "Largeur", "value": "80 cm" }]
      }
    ],
    "detail_image": { "src": "asset://details" },

    "custom": {}
  }
}
```

**Seuls champs obligatoires :** `template`, `data.shop.name`, `data.product.name`. Tout le reste
est optionnel ou a un défaut. Un premier appel peut donc être très court.

**Points qui coûtent du temps si on les découvre à l'usage :**

- **`version`** vaut `"published"` ou un entier. Un entier fige le rendu sur une version
  précise : utile pour rejouer à l'identique une fiche archivée.
- **`price.amount`** est une chaîne, séparateur point, **non formatée**. Le formatage est fait par
  le Studio avec `Intl` d'après `locale`, et les templates utilisent
  `{{product.price.formatted}}`. Envoyer « 349,00 € » déjà formaté produirait un affichage
  différent selon l'origine de l'appel.
- **`description_html`** est du HTML, assaini par le Studio avant rendu (liste blanche de balises
  et d'attributs). `description_short` est du **texte** : y mettre du HTML afficherait les balises.
  Le nom du champ décide, la règle est « suffixe `_html` ».
- **`datasheet_url`** est l'adresse **publique** de la fiche, telle que la boutique la sert. Elle
  n'entre pas dans le rendu : le Studio la range dans son index, que la page **Consultation** liste
  par boutique, avec un lien vers chaque fiche et un téléchargement groupé en zip. Le Studio va
  chercher les PDF à cette adresse : elle doit donc être joignable depuis Internet, sans
  authentification. Sans elle, le produit est listé mais sans lien. Côté PrestaShop, c'est la
  route du module (`/fiche-technique/{slug}-{id}.pdf`) ; côté Medusa, la route de la vitrine qui
  sert la fiche. L'index est tenu par `id`, ou à défaut par `sku`, et par `locale` : un produit
  sans l'un ni l'autre n'y figure pas.
- **`variant_skus`** et **`supplier_skus`** n'entrent pas non plus dans le rendu : ce sont les
  références des **déclinaisons** du produit et ses références **fournisseur** (produit et
  déclinaisons, tous fournisseurs confondus). Le Studio les range dans son index, et la recherche
  de **Consultation** les couvre : un commercial retrouve la fiche avec la référence qu'il a sous
  les yeux, celle d'un devis ou d'un bon fournisseur. **Absent et vide ne disent pas la même
  chose** : un champ absent laisse l'index tel qu'il était, une liste vide l'efface. Côté
  PrestaShop, `product_attribute.reference` et `product_supplier.product_supplier_reference` ;
  côté Medusa, les `sku` des variantes, et **aucun équivalent natif** pour le fournisseur.
- **`badges`** est une liste de clés libres, avec la convention `clé:valeur`. Le template les
  traduit en pictos. Ne pas y envoyer des libellés traduits : renommer une caractéristique
  casserait la correspondance sans aucun signal.
- **Les trois collections de choix** — `finishes`, `accessories` et `detail_image` —
  décrivent ce que le client peut choisir et ce qui s'accroche au produit. Elles sont
  toutes facultatives : un connecteur écrit avant elles reste valide, et les blocs qui les
  consomment s'effacent au lieu d'échouer. Trois choses à savoir :
  - **`finishes` est un tableau de groupes, pas un dictionnaire.** Leur nombre varie d'une fiche à
    l'autre et leur **ordre** est celui de la mise en page. La forme est celle des deux
    plateformes visées, sans traduction : un groupe d'attributs PrestaShop, ou un
    `product.options[]` Medusa ; ses valeurs, ou ses `values[]`.
  - **Une valeur sans couleur, sans texture et sans règle de template n'est pas imprimée.** La
    pastille sortirait en carré vide, ce qui se lit comme un défaut d'impression. La règle vit dans
    le Studio et non chez vous, et c'est ce qui la rend rattrapable : relevé sur le catalogue Acme,
    les décors bois (« Chêne clair », « Hêtre », « Noyer ») n'ont pas de code hexadécimal — un bois
    n'est pas un aplat. Écartés côté boutique, ils disparaîtraient sans recours ; écartés au rendu,
    une règle du template leur rend une texture et ils reviennent.
  - **`color` et `image` sont facultatifs, et c'est délibéré.** Ce sont de la présentation : le même
    « Bleu » vaut la même couleur sur toutes les fiches. Quand la plateforme les connaît
    (PrestaShop a un champ couleur natif sur ses attributs), les envoyer fait gagner du temps ;
    quand elle ne les connaît pas (Medusa n'en a pas sur ses valeurs d'option), **le template les
    fournit** par la correspondance du bloc « Nuancier de finitions », qui rapproche par libellé.
    Aucune plateforme n'a donc à être enrichie pour que la fiche soit correcte. `image` l'emporte
    sur `color` : c'est ce qui permet une pastille en **texture** (un décor bois « Chêne clair »)
    ou en **picto** (une serrure à code), là où un aplat ne dirait rien.
  - **`detail_image` porte ses légendes DANS l'image.** Elles ont voyagé un temps dans le payload,
    sous forme d'un tableau de textes et de coordonnées que le Studio reliait à l'image par des
    traits de rappel. Ce modèle a été retiré avant d'avoir servi : une légende n'est dérivable
    d'**aucune** donnée produit — « Tringle avec crochets », à 8 % de la hauteur, à gauche, est une
    affirmation sur *une* photo, que quelqu'un écrit produit par produit. Les incruster déplace ce
    travail dans l'outil de dessin, où il est déjà fait. Le prix : le texte n'est plus
    sélectionnable dans le PDF, et il est figé dans une langue.
- **La zone « Informations principales » ne demande aucun champ nouveau** : elle se compose sur
  `badges`, déjà produit par le module PrestaShop et par le collecteur Medusa depuis les tags.
- **`custom`** est un dictionnaire libre. C'est **l'échappatoire prévue** pour les champs propres
  à votre source, sans toucher au schéma commun ni casser les templates existants. Un PIM avec
  des attributs métier que PrestaShop n'a pas se branche là.
- **Références d'image** — trois transports :
  `asset://<clé>` (fichier joint au multipart), `https://…` (téléchargée au rendu),
  `data:…` (déjà inline). Une nuance mesurée et documentée dans `src/lib/remoteImages.ts` :
  Chromium **ne charge aucune ressource distante dans les bandeaux répétés** (en-tête / pied). Le
  Studio les télécharge et les inline lui-même pour ces zones ; vous n'avez rien à faire, mais
  c'est bon à savoir avant de conclure qu'un logo « ne marche pas ».
- **Tolérance PHP** : `json_encode([])` produit `[]` et non `{}`. Le Studio accepte un tableau
  vide là où il attend un objet (`custom`, `company`, `colors`, `price`). Un client Rust ou
  TypeScript n'a pas ce problème et enverra `{}` naturellement.

### Un appel qui marche, tout de suite

```bash
curl -sS -X POST "$STUDIO_URL/api/v1/render" \
  -H "Authorization: Bearer $STUDIO_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
        "template": "fiche-technique-01",
        "data": {
          "shop": { "name": "Test" },
          "product": { "name": "Produit de test" }
        }
      }' \
  -D /tmp/entetes.txt -o /tmp/fiche.pdf

grep -i '^x-template-version\|^x-render-warnings' /tmp/entetes.txt
```

Remplacer `fiche-technique-01` par un slug rendu par `GET /api/v1/templates`. Si le PDF sort, le
contrat est compris ; tout le reste n'est que du remplissage de champs.

> **Ce qui a été vérifié, et ce qui ne l'a pas été.** Les deux payloads de cette section — le
> minimal et le complet du §4 — ont été passés dans `renderRequestSchema` : tous deux valides, et
> le minimal reçoit bien les défauts annoncés (`version: "published"`, `locale: "fr"`, `features:
> []`, `badges: []`, `custom: {}`). Un payload sans `product.name` est bien refusé, et la tolérance
> `[]` → `{}` fonctionne. En revanche la commande `curl` elle-même n'a pas été exécutée contre un
> Studio en marche : à faire une fois chez vous, c'est le premier geste de toute intégration.

---

## 4 bis. Laisser le Studio choisir le template

Un catalogue n'a pas un seul besoin de mise en page. Plutôt que d'envoyer un slug fixe, un
connecteur peut demander au Studio de décider :

```json
{ "template": "auto", "locale": "fr", "data": { "product": { "category_path": ["Manutention", "Transpalettes"] } } }
```

Le Studio applique alors les **règles de la boutique** — écrites à l'écran dans `/regles` — sur
`product.category_path`, puis retombe sur le **template par défaut** de cette boutique.

| Critère d'une règle | Ce qu'il fait |
|---|---|
| **sous la catégorie** | préfixe du fil d'Ariane. `Manutention` attrape tous ses descendants |
| **dans l'une de ces catégories** | appartenance sans ordre — pour les sources qui ne donnent pas un vrai fil d'Ariane |
| **marque** | égalité exacte |
| **référence** | expression régulière |

La règle la plus **spécifique** gagne : plus de critères, et une catégorie plus profonde.
`["Manutention","Transpalettes"]` bat `["Manutention"]`, qui bat le défaut. **Aucun ordre à
maintenir.** Accents et casse sont ignorés.

### Ce que la réponse vous dit

| En-tête | Valeur |
|---|---|
| `X-Template-Slug` | le template **réellement servi** |
| `X-Template-Resolved-By` | `explicite`, `regle` ou `defaut` |
| `X-Template-Version` | son numéro de version publiée |

**`X-Template-Slug` doit entrer dans votre clé de cache** dès que vous utilisez `"auto"` : sans lui,
une règle modifiée dans le Studio ne se verrait nulle part côté boutique, et vous resserviez
indéfiniment une fiche au mauvais modèle.

### Trois choses à savoir

**Un slug explicite passe toujours outre.** C'est ce qui permet de forcer un modèle pour une fiche
précise, sans toucher aux règles.

**`"auto"` est une valeur réservée**, et non un champ facultatif. Le Studio refuse de créer un
template portant ce slug. Rendre `template` optionnel aurait été plus simple — et c'est précisément
le problème : un connecteur qui **oublierait** de l'envoyer par bug reçoit un `422` explicite ;
avec un champ facultatif, il aurait reçu silencieusement le template par défaut et sorti une fiche
fausse que personne n'aurait remarquée.

**Sans règle correspondante ni template par défaut, le Studio répond `409`** plutôt que de deviner.
C'est un état valable — il refuse au lieu de rendre au mauvais modèle — mais il faut l'avoir choisi.

> **Le piège, et il est réel.** Les règles comparent des **libellés** de catégorie. Renommer
> « Manutention » en « Manutention & levage » dans un back-office ne lève rien : les règles cessent
> de correspondre, les fiches retombent sur le défaut, et elles sortent. C'est pour ça que
> `/journal` liste les **catégories sans règle** — la liste exacte des règles à réécrire.

## 5. Ce qui rend un connecteur exploitable en production

Le module PrestaShop existant est une **implémentation de référence**. Ces quatre mécanismes n'ont
rien de PrestaShop et devront être réécrits, quelle que soit la source :

**Un cache, avec sa clé de fraîcheur.** Un rendu coûte un Chromium ; le refaire à chaque
affichage n'est pas tenable. La clé retenue dans le module : une empreinte du payload **plus** la
taille et la date de modification de chaque fichier joint. Retoucher une image sans toucher au
produit doit périmer la fiche ; hacher le contenu des images coûterait une lecture complète à
chaque comparaison.

**La détection des republications de template.** L'empreinte ci-dessus ne couvre que vos données :
publier une nouvelle version du template ne la change pas. Sans comparaison de `x-template-version`
contre `published_version` lu sur `GET /api/v1/templates`, une fiche reste « à jour » indéfiniment
et le catalogue sert l'ancien rendu. C'est le défaut qui manquait à la première version du module.

**Une génération en masse reprenable.** Un catalogue de plusieurs milliers de références multiplié
par le nombre de langues ne tient ni dans une requête ni dans une boucle naïve. Le modèle qui
marche : des lots bornés par un **budget de temps**, chaque lot demandant « les N prochaines
fiches absentes ou périmées ». La reprise est alors gratuite — fermer l'onglet, relancer, reprendre
après une coupure ne coûte rien. Et il faut isoler les échecs : une référence qui échoue
systématiquement ne doit pas être resservie à chaque lot et bloquer les milliers d'autres.

**Le choix du template.** Un seul template pour tout le catalogue tient rarement. Cette liaison
appartient au connecteur, pas au Studio : un identifiant de catégorie ou de famille n'a de sens que
dans SA source, et le Studio en sert plusieurs. Le module PrestaShop y répond par des règles
« catégorie → template » avec héritage vers les parents ; un PIM ferait la même chose sur sa
propre taxonomie. Ce que le Studio fournit pour ça est déjà là : `payload.template` est lu **à
chaque requête**, jamais mémorisé par boutique.

---

## 6. Qui déclenche le rendu ?

C'est la seule vraie question d'architecture que ce document ne peut pas trancher pour vous, parce
que la réponse dépend de votre source.

- **Le connecteur pousse, à la demande** — un visiteur demande la fiche, le connecteur rend si le
  cache est froid. C'est le modèle du module PrestaShop. Simple, et la première demande paie le
  rendu.
- **Le connecteur pousse, sur événement** — le PIM signale une modification de produit, le
  connecteur périme puis regénère. Le plus juste, exige un mécanisme d'événements fiable côté
  source.
- **Le connecteur pousse, en batch planifié** — un cron regénère ce qui est périmé. C'est ce que
  fait le module en complément, et c'est ce qui rattrape ce que les deux autres ont raté.
- **Le Studio tire** — il irait chercher les produits lui-même. **Non prévu, et à éviter** : il
  faudrait lui apprendre à parler à chaque source, ce que tout le reste de cette architecture
  s'attache précisément à ne pas faire. Le jour où ce serait nécessaire, la bonne forme serait un
  service d'orchestration distinct, pas une entrée dans le Studio.

Les trois premiers se combinent, et c'est la combinaison qui rend le résultat fiable : l'événement
pour la réactivité, le batch pour l'exhaustivité, la demande pour le trou restant.

---

## 7. Ce qui manque, et qu'il faudra décider

Points ouverts, honnêtement listés plutôt que passés sous silence :

- **Pas d'endpoint de téléversement d'assets en v1.** La bibliothèque d'images du Studio se
  remplit depuis son éditeur (`/api/editor/assets`), qui n'est pas une API publique et n'est pas
  protégée par les clés `sk_`. Un connecteur qui voudrait pousser des pictos par programme n'a pas
  de porte d'entrée. À concevoir si le besoin apparaît.
- **Pas de webhook sortant en service.** Les colonnes `webhook_secret` et `webhook_url` existent
  sur la table `shops` mais rien ne les consomme aujourd'hui. Un Studio qui notifierait une
  republication de template épargnerait aux connecteurs leur boucle d'interrogation.
- **Pas d'OpenAPI.** Ce document et `src/lib/payload.ts` sont le contrat. Un schéma OpenAPI généré
  depuis les schémas zod permettrait de générer un client typé — en TypeScript, en PHP, ou en Rust
  via un générateur.
- **Un seul niveau d'isolation : la boutique.** La clé API donne accès à tous les templates de sa
  boutique plus la bibliothèque. Il n'y a pas de portée plus fine, ni de clé en lecture seule.
