# Collecteurs

Trois clients du Studio, et le noyau qu'ils partagent.

Un **collecteur** lit une source de données produit, en tire des payloads, appelle
`POST /api/v1/render` et écrit les PDF. Le Studio ne sait rien d'eux : son seul contrat est le
payload décrit dans **[docs/integrer-un-connecteur.md](../docs/integrer-un-connecteur.md)**, qui
reste la référence — ce document-ci ne décrit que les trois implémentations.

| Collecteur | Pour | Commande |
|---|---|---|
| **CSV** | un export de catalogue, un dossier d'images | `pnpm collect:csv catalogue.csv` |
| **Medusa** | une boutique Medusa v2 (API admin ou store) | `pnpm collect:medusa --medusa-url …` |
| **API** | tout le reste : PIM, ERP, back-office maison | `pnpm collect:api config.json` |

Chacun accepte `--help`.

**Le Studio sait aussi importer un fichier depuis son interface** —
[docs/importer-un-catalogue.md](../docs/importer-un-catalogue.md). C'est le même mapping, au
fichier près : ce qui est réglé à l'écran s'exporte en JSON et se repasse à `--mapping`, et
l'inverse. La ligne de partage est ailleurs — la page d'import n'a ni cache de fraîcheur, ni
reprise, et son archive vit dans un onglet. Elle sert le lot qu'on regarde passer ; ces
collecteurs-ci servent un catalogue.

## Cinq minutes

Avec un Studio qui tourne en local (voir [docs/tester-en-local.md](../docs/tester-en-local.md)) :

```sh
export STUDIO_URL=http://localhost:3000
export STUDIO_KEY=sk_...                 # pnpm issue-key <slug-boutique>

# 1. Voir ce que le mapping produit, sans rien envoyer
pnpm collect:csv collectors/csv/exemple.csv --dry-run --template fiche-technique-01

# 2. Rendre pour de vrai
pnpm collect:csv collectors/csv/exemple.csv \
  --template fiche-technique-01 \
  --shop collectors/shop.exemple.json \
  --features collectors/csv/exemple.features.csv \
  --out pdf

# 3. Relancer : rien n'est refait
pnpm collect:csv collectors/csv/exemple.csv --template fiche-technique-01 --out pdf
```

Le troisième appel est le plus instructif : il ne renvoie rien au Studio. C'est le journal qui
travaille.

## Ce que le noyau fait, et que vous n'avez pas à réécrire

Le §5 de la documentation d'intégration liste quatre mécanismes « sans lesquels un connecteur
n'est pas exploitable en production ». Ils vivent dans [`core/`](core/), et les trois collecteurs
en héritent.

> **Où vit quoi.** `core/` porte ce qui est propre à un collecteur : le cache, le journal, les
> lots, le client HTTP, les pièces jointes lues sur disque. Ce qui est commun avec la page d'import
> du Studio est remonté dans `src/lib` et importé par `@/lib/…` — le lecteur CSV
> ([`csv.ts`](../src/lib/csv.ts)), les chemins et les transformations
> ([`mapping.ts`](../src/lib/mapping.ts)), la colonne de caractéristiques PrestaShop
> ([`featureColumn.ts`](../src/lib/featureColumn.ts)) et la correspondance elle-même
> ([`importMapping.ts`](../src/lib/importMapping.ts)). La dépendance ne va que dans ce sens : un
> collecteur est un client du Studio, le Studio ne sait rien d'eux.

**Un cache, avec sa clé de fraîcheur.** Une empreinte du payload complet **plus** l'empreinte de
chaque pièce jointe — taille et date de modification pour un fichier, ETag pour une image
distante. Retoucher une photo sans toucher au produit périme la fiche ; hacher le contenu des
images coûterait une lecture complète du catalogue à chaque comparaison. Quand la source connaît
mieux (`updated_at` d'une API), les deux empreintes sont combinées : celle du payload ne voit pas
qu'une image a changé derrière une URL inchangée.

**La détection des republications.** L'empreinte ne couvre que vos données : publier une nouvelle
version d'un template ne la change pas. Le journal garde le `x-template-version` réellement servi
et le compare au `published_version` lu sur `GET /api/v1/templates` au début de chaque lot. Sans
cela, une fiche reste « à jour » indéfiniment et le catalogue sert l'ancien rendu.

**Une génération en masse reprenable.** `--budget 5m` borne le lot dans le temps ; l'état vit dans
un journal JSONL en ajout seul, écrit après chaque fiche. Fermer le terminal, subir une coupure,
relancer le lendemain : la reprise ne coûte rien. `Ctrl-C` laisse les rendus en cours se terminer.

**L'isolement des échecs.** Une référence qui échoue `--max-attempts` fois (3 par défaut) passe en
quarantaine et cesse de consommer le budget des milliers d'autres. `--retry-failed` lève les
quarantaines sans perdre les fiches déjà rendues.

S'y ajoutent trois choses que le contrat impose et qu'on oublie facilement :

- **les payloads sont validés localement**, avec le schéma zod du serveur lui-même
  (`src/lib/payload.ts`, importé et non recopié). Une erreur de mapping échoue au premier produit,
  pas au 4000ᵉ aller-retour HTTP ;
- **429 et 502 sont rejoués** (en suivant `Retry-After`), 401/415/422/404/413 non. C'est cette
  distinction qui sépare un incident d'infrastructure d'un template cassé ;
- **`x-render-warnings` est lu**. Un asset introuvable ne fait pas échouer le rendu : sans lire cet
  en-tête, vous ne le sauriez pas.

### Le choix du template

Il appartient au collecteur : `payload.template` est lu à chaque requête, jamais mémorisé par
boutique. Trois niveaux, du plus fort au plus faible : le template porté par la fiche (colonne
`template` du CSV, `template_from` d'une config API), les règles de `--rules`, puis `--template`.

> **Le sens de `--rules` a changé, et il s'est précisé.** Le moteur de correspondance vit désormais
> dans [`src/lib/templateRules.ts`](../src/lib/templateRules.ts), partagé avec le Studio, qui porte
> les mêmes règles **en base, par boutique** (page `/regles`). Un collecteur qui passe `--rules`
> **passe outre** les règles du Studio ; un collecteur qui envoie `"template": "auto"` les applique.
>
> La raison du déménagement : un fichier de règles sur un poste de développeur ne couvrait ni le
> module PrestaShop, ni le bouton de back-office, ni la page d'import. Les règles vivaient au seul
> endroit qui ne servait pas le cas principal.

```json
{
  "default": "fiche-technique-01",
  "rules": [
    { "category": ["Manutention", "Transpalettes"], "template": "fiche-transpalette" },
    { "category": ["Manutention"], "template": "fiche-manutention" },
    { "category_any": ["Promo", "Destockage"], "template": "fiche-promo" },
    { "brand": "Fabrikam", "template": "fiche-atelier" },
    { "ref": "^ETA-", "template": "fiche-etabli" }
  ]
}
```

Une règle `category` s'applique à toute la branche : « Manutention > Gerbeurs » tombe sur
`fiche-manutention` sans qu'on l'ait écrit. La règle la plus spécifique gagne — catégorie la plus
profonde d'abord, puis nombre de critères — indépendamment de l'ordre de déclaration. Casse et
accents sont ignorés.

Les slugs visés sont vérifiés contre `GET /api/v1/templates` **au démarrage** : une faute de frappe
s'y voit tout de suite, plutôt qu'en 404 sur chaque produit.

### Options communes

`--help` les liste toutes. Les cinq qui changent la façon de travailler :

| Option | Effet |
|---|---|
| `--dry-run` | construit et valide les payloads, n'envoie rien. Marche même sans clé API. |
| `--budget 5m` | borne le lot ; relancer reprend où il s'est arrêté. |
| `--limit 3` | s'arrête après 3 rendus. Pour éprouver un template. |
| `--force` | ignore le cache de fraîcheur. |
| `--forget REF` | oublie une référence, qui sera refaite au prochain lot. Répétable. |
| `--print 1` | affiche le payload produit, en entier, sans rien envoyer ni exiger de clé. |
| `--report r.json` | écrit le compte rendu : compteurs, avertissements, échecs, versions servies. |

Le code de sortie vaut 1 dès qu'une fiche a échoué ou que le lot s'est arrêté sur une erreur
bloquante — de quoi câbler une supervision sans lire la sortie standard.

**Concurrence.** `--concurrency` vaut 2 par défaut. Le Studio n'accepte que
`MAX_CONCURRENT_RENDERS` rendus simultanés (4) et met le reste en file avant de répondre 429 ;
monter beaucoup plus haut ne va pas plus vite, et prive l'aperçu de l'éditeur, qui partage le même
sas.

---

## Collecteur CSV

**La convention tient en une phrase : l'en-tête de colonne EST le chemin du champ dans le
payload.**

```csv
ref;product.name;product.sku;product.price.amount;images.0.src;feature:Capacite@Q
TPM-2500;Transpalette 2500 kg;TPM-2500;489,00;photos/tpm.jpg;2500 kg
```

L'alternative évidente — deviner que « Référence » veut dire `product.sku` — a été écartée pour une
raison précise : « Description » est-elle `description_html` ou `description_short` ? La réponse
change le rendu, et rien ne signalerait l'erreur. Un export qu'on ne maîtrise pas se traite avec
`--mapping fichier.json`, où la correspondance est écrite quelque part et se relit.

**Ce qu'il faut savoir avant le premier import :**

- une **cellule vide** vaut « champ absent », pas « champ vide » ;
- `product.price.amount` est **normalisé** : `489,00`, `1 234,56 €` et `1.234,56` donnent tous
  `1234.56`. Le contrat exige une chaîne à séparateur point, non formatée — un `489,00` envoyé tel
  quel donnerait `NaN` côté Studio, donc un prix vide sur la fiche, sans erreur nulle part ;
- une valeur d'image qui est un **chemin local** est jointe au multipart (`--assets-dir` pour la
  racine, par défaut le dossier du CSV) ; une **URL https** traverse telle quelle et sera chargée
  par Chromium au rendu ;
- une image introuvable coûte l'image, pas la fiche — elle est signalée. `--strict` inverse ce
  choix ;
- `badges` et `product.category_path` sont des listes, séparées par `--list-sep` (défaut `|`) ;
- `ref`, `template` et `locale` pilotent la fiche et n'entrent pas dans son contenu. **Donner une
  colonne `ref`** : à défaut, `product.sku` puis `product.id` sont essayés, et en dernier recours
  le numéro de ligne — qui n'est pas stable, et regénérerait tout le catalogue dès qu'une ligne est
  insérée en tête.

**Caractéristiques.** Deux formes, cumulables. En colonnes, `feature:<nom>` et
`feature:<nom>@<abréviation>` (la lettre de renvoi vers le schéma coté). En format long, quand
elles varient d'un produit à l'autre :

```sh
pnpm collect:csv catalogue.csv --features specs.csv
```

```csv
ref;name;value;abbreviation;group
TPM-2500;Roues directrices;Polyurethane 200 x 50 mm;D;Roulage
```

Le catalogue est lu **en flux** ; le fichier de caractéristiques, lui, est chargé d'un bloc —
joindre deux flux exigerait qu'ils soient triés de la même façon, ce qu'aucun export ne garantit.

Exemples complets : [`csv/exemple.csv`](csv/exemple.csv) et
[`csv/exemple.features.csv`](csv/exemple.features.csv).

### Le cas particulier qui n'en est pas un : un export PrestaShop

C'est le format qui arrivera le plus souvent, et il demande quatre choses que la convention seule
ne couvre pas. Un fichier de correspondance prêt à l'emploi est livré :

```sh
pnpm collect:csv export.csv \
  --mapping collectors/csv/prestashop.mapping.json \
  --list-sep , --where "Actif (0/1)=1" \
  --shop boutique.json --rules regles.json --print 1
```

**`--mapping` est une liste blanche.** Un export porte 54 colonnes dont une quinzaine sont utiles.
Les autres ne sont pas envoyées : `zod` les écarterait de toute façon en silence, mais elles
feraient changer la clé de fraîcheur — donc régénérer le catalogue — quand une colonne sans rapport
bouge. Le collecteur dit à la fin combien il en a laissées de côté, et lesquelles.

**`--where "Actif (0/1)=1"`** — sans filtre, les produits désactivés sont rendus aussi. Sur
l'export de 1042 produits qui a servi de référence : 409. Le filtre porte sur le nom de colonne du
fichier, pas sur le chemin cible ; une colonne absente arrête le lot au lieu de tout écarter en
silence.

**La colonne `Caracteristiques (Nom:Valeur:Position)`** porte à elle seule le cœur du document.
Elle est mappée sur le chemin `features`, ce qui déclenche son analyse. Le format n'échappe rien :
une valeur qui contient une virgule casse un `split(",")` naïf — mesuré sur l'export de référence,
648 fragments sur 6557, soit **une caractéristique sur dix** :

| Brut | `split(",")` naïf | Ce que fait le collecteur |
|---|---|---|
| `Épaisseur plateau (cm):2,5:25` | épaisseur `2`, + une ligne fantôme `5` | `2,5` |
| `Option:Voile de fond, H. 40 cm:116` | option coupée en deux | intacte |

Les valeurs répétées d'une même caractéristique — PrestaShop en exporte une ligne chacune — sont
regroupées en `120 x 80 / 140 x 80 / 160 x 80` plutôt qu'en quatre lignes identiques à gauche.
`--no-merge-features` rétablit le comportement brut.

**`Resume` est du HTML, `description_short` est du texte.** Le mapping livré applique
`| html2text` : sans lui, les balises `<p>` s'impriment en clair sur la fiche, sans erreur ni
avertissement. Une cible de mapping accepte les mêmes transformations que le collecteur d'API.

Deux points restent à décider par vous :

- **la référence.** Le mapping livré prend la colonne `ID`, pas `Reference` : sur l'export de
  référence, 127 produits ont une référence vide et 13 la partagent avec un autre. Une clé de
  journal doit être unique et stable, sinon les fiches se recouvrent ;
- **les catégories.** PrestaShop exporte *toutes* les catégories associées, dans un ordre qui n'est
  pas hiérarchique — `Promo,Bureaux d'entreprise,Gammes de Bureaux,…` commence par une catégorie
  transversale. Les règles par préfixe (`"category"`) n'y mordent pas ; utiliser
  `"category_any": ["Bureaux Droits Individuels"]`, qui teste l'appartenance sans ordre.

---

## Collecteur Medusa

Le contrat du Studio a été écrit en pensant à ce cas — c'est la correspondance citée en tête de
`src/lib/payload.ts` : `variant.sku → sku`, `variant.barcode → gtin`. Rien n'est à changer côté
Studio.

```sh
pnpm collect:medusa \
  --medusa-url http://localhost:9000 --medusa-key sk_... \
  --template fiche-technique-01 --limit 5
```

**Deux API, et le choix n'est pas cosmétique.** `--mode admin` (défaut) voit les brouillons, les
prix par devise et toutes les métadonnées. `--mode store` voit ce que voit un client : le prix
**calculé** pour une région (`--region-id`), taxes comprises ou non selon la configuration. Si la
fiche doit afficher le prix que le client verra, c'est `store`.

**Authentification.** `x-medusa-access-token` n'existe plus en v2. Une clé secrète
d'administration se passe en `Authorization: Basic <clé>` non encodée ; le base64 reste accepté par
compatibilité. Le collecteur envoie la forme documentée et, sur un 401, retente **une** fois en
base64 en le signalant dans le compte rendu — un 401 muet se cherche longtemps. Sinon :
`--medusa-jwt`, ou `--medusa-email` / `--medusa-password` (échangés contre un JWT sur
`/auth/user/emailpass`).

**Ce que le mapping reconstruit :**

| Contrat | Source |
|---|---|
| `product.name` | `title` (+ titre de variante si `--variants all` et qu'il distingue) |
| `product.sku` / `gtin` | `variant.sku` / `variant.barcode`, puis `ean`, puis `upc` |
| `product.variant_skus` | les `sku` de toutes les variantes, avec `--variants first` seulement — une fiche par variante porte déjà la sienne dans `sku` |
| `product.supplier_skus` | **rien** : Medusa n'a pas de référence fournisseur native (voir ci-dessous) |
| `product.category_path` | l'arbre des catégories, chargé une fois et remonté par parents |
| `product.description_html` | `description`, qui est du **texte** : converti en paragraphes |
| `product.description_short` | `subtitle` |
| `product.brand` | `--brand-from collection` (défaut), `type`, ou `metadata` |
| `features` | les options de variante, et les métadonnées scalaires si demandé |
| `badges` | les tags, tels quels |
| `images` | `images[]` par rang, vignette en tête si elle n'y figure pas |

L'arbre des catégories mérite une phrase : un produit Medusa ne porte que des catégories à plat.
Sans cette reconstruction, `category_path` vaudrait `["Transpalettes"]` et les règles de template
par préfixe ne pourraient jamais s'appliquer.

**La référence fournisseur n'a pas d'équivalent dans Medusa.** Une variante v2 porte `sku`,
`barcode`, `ean`, `upc`, `mid_code`, `hs_code` — aucun fournisseur. PrestaShop la tient dans
`product_supplier`, pour le produit et chacune de ses déclinaisons. Côté Medusa, elle vivra soit
dans une clé de `metadata` de la variante, soit dans un module dédié relié par un *Module Link* :
c'est à décider avec la migration, et le collecteur la lira à ce moment-là. En attendant, une
fiche Medusa se retrouve dans `/consultation` par sa référence et celles de ses variantes, pas par
celle du fournisseur.

**Trois points d'attention.**

- **Le prix.** Medusa v2 compte en unités (`349` = 349,00 €). Une base migrée depuis la v1 peut
  encore compter en centimes : `--price-scale minor`. Si aucun prix n'existe dans `--currency`, la
  fiche sort **sans prix** et le dit, plutôt qu'avec un montant faux.
- **`tax_included` n'est pas deviné** en mode admin : un prix d'administration est HT ou TTC selon
  la configuration de la région, et écrire `false` au hasard ferait afficher « HT » sur un prix
  TTC. Le champ reste absent sauf `--tax-included`. En mode store, l'API le dit et on le suit.
- **Les tags deviennent des badges tels quels.** Ce sont des **clés** que le template traduit en
  pictos, pas des libellés traduits : renommer un tag casse la correspondance sans aucun signal.

Les images restent des URLs par défaut — aucun octet ne transite par le collecteur.
`--download-images` les rapatrie et les joint, pour un stockage privé ou signé.

---

## Collecteur API

Pour tout le reste. Il est **déclaratif** : un fichier de configuration décrit où taper, comment
paginer, et quel champ de la source alimente quel champ du contrat. Brancher un PIM ne demande pas
d'écrire du TypeScript.

```sh
pnpm collect:api pim.json --check      # valide la configuration
pnpm collect:api pim.json --print 1    # montre le premier payload produit
pnpm collect:api pim.json --template fiche-technique-01 --budget 5m
```

Modèle commenté : [`api/exemple.config.json`](api/exemple.config.json).

**La table de correspondance se lit CIBLE ← SOURCE**, comme une affectation :

```json
"map": {
  "product.name":          "libelle",
  "product.price.amount":  "tarifs.public_ht | minor",
  "product.category_path": "familles[].libelle",
  "images[].src":          "medias[].url",
  "images[].legend":       "medias[].legende",
  "features[].name":       "specs[].label"
}
```

C'est l'**expression** qui dit s'il y a plusieurs valeurs, et la **cible** qui dit où les poser :
`familles[].libelle → product.category_path` pose la liste entière, `medias[].url → images[].src`
pose un élément par indice. Les listes parallèles sont appariées **par indice** — et les trous sont
conservés, faute de quoi une légende manquante décalerait toutes les suivantes.

Transformations disponibles après un `|` : `trim`, `string`, `int`, `bool`, `amount`, `minor`
(centimes → unités), `join:<sep>`, `split:<sep>`, `first`, `upper`, `lower`, `nl2html`,
`default:<valeur>`. Une transformation inconnue échoue au chargement.

**Pagination** : `page` (page / per_page), `offset` (offset / limit), `cursor` (curseur lu dans la
réponse), ou `none`. Le champ `total` sert de borne quand l'API l'annonce ; sinon une page plus
courte que demandée marque la fin — ce qui protège aussi d'une API qui ignorerait la pagination et
resservirait indéfiniment sa première page.

**`detail`** déclenche un second appel par produit quand la liste ne sert que des résumés. Les
champs de la liste restent lisibles sous `_list` : une API qui ne renvoie la famille que dans la
liste reste exploitable pour choisir le template.

**Aucun secret dans le fichier.** L'authentification ne nomme que des variables d'environnement
(`token_env`, `value_env`, jamais `token`) : un fichier de configuration se versionne, se copie, se
colle dans un ticket.

---

## Écrire un quatrième collecteur

Il n'y a qu'une interface à remplir, et rien de ce qui précède n'est à réécrire :

```ts
export type Source = {
  readonly name: string;
  list(): AsyncIterable<CollectedProduct>;   // paresseux : un catalogue ne tient pas en mémoire
  close?(): Promise<void>;
};
```

Un `CollectedProduct` porte une `ref` **stable** (la clé du journal), les `data` du payload, ses
pièces jointes éventuelles, et facultativement un `template`, une `locale`, une `fingerprint` et
des `warnings`. Le reste — validation, fraîcheur, lots, retentatives, quarantaine, écriture des
PDF — est fourni par `core/run.ts`. Les trois entrées `collect.ts` existantes font 90 à
170 lignes, dont l'essentiel est le texte d'aide.

## Ce qui n'est pas fait

- **Pas de téléversement d'assets.** La bibliothèque d'images du Studio se remplit depuis son
  éditeur ; il n'existe pas d'API publique pour y pousser des pictos. `--shop-logo` joint donc le
  logo à *chaque* requête. Pour un catalogue entier, mieux vaut déposer le logo dans la
  bibliothèque de la boutique et le référencer `/assets/<boutique>/logo` depuis le template :
  l'octet ne voyage alors plus du tout.
- **Pas de déclenchement sur événement.** Ces trois collecteurs *poussent*, à la demande ou en
  batch. Le modèle événementiel du §6 de la documentation d'intégration (le PIM signale, le
  collecteur périme et régénère) demanderait un mécanisme d'événements côté source, et se
  brancherait sur `--forget <ref>` suivi d'un lot ciblé.
- **Le journal n'est pas partagé entre machines.** C'est un fichier. Deux collecteurs qui écrivent
  le même journal en ajout seul ne se corrompent pas, mais ne se voient pas non plus : chacun
  regénérera ce que l'autre vient de faire.
- **Les collecteurs ne sont pas dans l'image Docker de production.** Ils vivent avec les sources,
  comme `scripts/` : c'est le service `migrate` qui porte l'outillage Node.
