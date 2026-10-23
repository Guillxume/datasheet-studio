# Datasheet Studio

Composition et rendu des fiches techniques produit en PDF, pour un parc de boutiques en ligne.

Remplace `acmepdfgenerator` (mPDF + templates Smarty figés). Le gain décisif n'est pas
l'éditeur Drag'N'Drop : c'est le **changement de moteur de rendu**. Chromium apporte le CSS
complet (grid, flexbox) et une **pagination réelle** — là où l'ancien module estimait les sauts
de page à 40 caractères par ligne et 5 mm par ligne.

Le Studio ne connaît rien de PrestaShop. Son seul contrat est le payload normalisé décrit plus
bas, ce qui le rend réutilisable depuis une autre plateforme (Medusa, Shopify, un ERP) en
écrivant un nouveau collecteur — sans toucher aux templates. Trois sont fournis (CSV, Medusa,
API JSON générique) : voir **[collectors/README.md](collectors/README.md)**.

## Architecture

```
Boutique (module acmedatasheet)          Datasheet Studio
  collecte les donnees produit  ──POST──▶   /api/v1/render      cle API de boutique
  met en cache le PDF           ◀──PDF───   │
                                            ├─ prepareData  asset:// + assainissement HTML
                                            ├─ renderNode   arbre Puck -> React -> HTML
                                            └─ Gotenberg    HTML -> PDF (Chromium)

Personnes (editeur, import, admin) ──────▶  /            session + role
                                            └─ src/lib/guard.ts
```

Le Studio **ne stocke aucun PDF** : il rend et renvoie. Le cache vit côté boutique.

**Deux authentifications, qui ne se connaissent pas.** Les boutiques présentent une **clé API** sur
`/api/v1/*` ; les personnes ouvrent une **session** sur le reste, avec un rôle qui décide de ce
qu'elles peuvent faire. La première répond à « quelle machine appelle », la seconde à « qui est
devant l'écran » — les confondre reviendrait à donner une clé de rendu à chaque personne, ou un
compte à chaque module. Voir **[docs/comptes-et-roles.md](docs/comptes-et-roles.md)**.

## Démarrage local

> Pour seulement essayer le Studio, Docker suffit : `docker compose up` à la racine du dépôt
> (voir le README racine). La procédure de développement détaillée, avec le tour complet et les
> pannes courantes, est dans **[docs/tester-en-local.md](docs/tester-en-local.md)**.


Postgres et Gotenberg dans Docker, Next.js sur l'hôte. Le design system (`packages/ui`) est un
paquet du workspace, consommé compilé : le construire une fois avant de lancer le Studio.

```sh
pnpm install                       # a la racine du depot
pnpm build:ui                      # compile packages/ui, consomme par le Studio

docker compose -f docker-compose.yml -f apps/studio/infra/docker-compose.dev.yml up -d db gotenberg mailpit

cd apps/studio
cp .env.dist .env                  # lu par pnpm dev / migrate (pointe sur localhost)

pnpm migrate
pnpm seed                          # boutique de test + template, affiche une cle API
pnpm admin vous@exemple.fr "Votre Nom"   # premier compte, affiche un lien d'activation
pnpm dev
```

L'interface demande une session : suivre le lien d'activation imprimé par `pnpm admin`, choisir
un mot de passe, et c'est ouvert. Les courriels partent dans un Mailpit local — les invitations se
lisent sur <http://localhost:8025>, telles qu'elles arriveront. `/api/v1/*` n'est pas concerné — ces routes portent leur propre
clé, et `fixtures/render.sh` marche sans compte.

> Le `.env` de `apps/studio` pointe sur `localhost` et les ports publiés par la surcharge de
> développement ; les conteneurs, eux, reçoivent leurs variables du `docker-compose.yml` racine.
> `process.loadEnvFile` n'écrasant pas une variable déjà définie, les scripts hôte ne lisent
> **que** `.env`.

Rendre une fiche de test. `fixtures/assets/` n'est **pas** versionné (il contiendrait des logos de
marques tierces) : y déposer des images nommées d'après les clés attendues par le payload —
`logo`, `img-0`, `img-1`, `img-2`, `schema`, `qr`.

```sh
STUDIO_KEY=sk_... ./fixtures/render.sh
open /tmp/fiche.pdf
```

`render.sh` joint automatiquement tout fichier de `$ASSET_DIR` sous la clé correspondant à son nom.
Sans ces images, le rendu réussit quand même : les blocs concernés s'effacent et les références
manquantes sont listées dans `X-Render-Warnings`.

## Alimenter le Studio depuis une source

Le Studio ne va chercher aucune donnée : c'est un client qui les lui apporte. Deux chemins, et ils
partagent la même correspondance.

### Depuis le Studio, pour un lot qu'on regarde passer

Le bouton **« Importer un catalogue »** de l'accueil ouvre
**[/import](docs/importer-un-catalogue.md)** : un CSV ou un JSON lu dans le navigateur, une
correspondance réglée à l'écran, un template — et un ZIP de fiches en sortie, avec son rapport.

Le lot est piloté par l'onglet, fiche par fiche : progression réelle, annulation immédiate, échecs
rejouables seuls. Une seule requête qui rendrait 400 fiches tiendrait dix minutes, au-delà de ce
que le reverse proxy laisse passer, sans rien montrer.

Ce que la page ne fait pas — pas de cache de fraîcheur, pas de reprise après fermeture de l'onglet
— est exactement ce que font les collecteurs. C'est la ligne de partage.

### Depuis la ligne de commande, pour un catalogue entier

Trois collecteurs sont livrés dans **[collectors/](collectors/README.md)**, avec le noyau qu'ils
partagent — cache de fraîcheur, détection des republications de template, lots bornés par un budget
de temps, quarantaine des références qui échouent.

```sh
STUDIO_KEY=sk_... pnpm collect:csv    catalogue.csv --template fiche-technique-01
STUDIO_KEY=sk_... pnpm collect:medusa --medusa-url http://localhost:9000 --medusa-key sk_...
STUDIO_KEY=sk_... pnpm collect:api    pim.json --dry-run
```

Ils ne bénéficient d'aucun privilège : ce sont des clients de `/api/v1/render` comme le module
PrestaShop. Le contrat qu'ils remplissent est décrit dans
[docs/integrer-un-connecteur.md](docs/integrer-un-connecteur.md), et leurs payloads sont validés
avant envoi par le schéma zod du serveur lui-même — un mapping fautif échoue au premier produit
plutôt qu'au 4000e aller-retour HTTP.

**Le fichier de correspondance est le même des deux côtés.** La page d'import exporte et relit le
JSON que `--mapping` attend : un réglage fait à l'écran se met en production sans être refait, et
un mapping versionné se rejoue à l'écran. La sémantique elle-même n'a qu'une implémentation,
[`src/lib/importMapping.ts`](src/lib/importMapping.ts) — deux versions donneraient deux payloads,
et l'aperçu montrerait autre chose que ce que le lot enverrait.

## Plusieurs templates pour une boutique

Un rayonnage complexe et un repose-pieds n'ont pas les mêmes besoins de mise en page. Une boutique
n'est donc plus liée à **un** template : `/regles` associe des templates aux **catégories** de son
catalogue.

Le module ou le connecteur envoie `"template": "auto"` au lieu d'un slug, et le Studio choisit
d'après `product.category_path` :

| Critère | Ce qu'il fait |
|---|---|
| **sous la catégorie** | préfixe du fil d'Ariane. `Manutention` attrape tous ses descendants |
| **dans l'une de ces catégories** | appartenance sans ordre — un export PrestaShop liste ses catégories dans un ordre qui n'est pas hiérarchique, et aucune règle de préfixe ne peut alors s'appliquer |
| **marque**, **référence** | égalité exacte, expression régulière |

**La règle la plus spécifique gagne** — plus de critères, catégorie plus profonde. Aucun ordre à
maintenir. Faute de règle, le **template par défaut** de la boutique ; faute de défaut, un `409`
plutôt qu'une fiche au mauvais modèle.

**Le moteur est partagé** avec les collecteurs (`src/lib/templateRules.ts`) : une fiche passée par
un collecteur et la même fiche demandée par un bouton de back-office choisissent le même template.
Un slug explicite continue de passer outre, et le fichier `--rules` d'un collecteur signifie
désormais « je passe outre le Studio ».

**`"auto"` est une valeur réservée, pas un champ facultatif** — et c'est un choix. Rendre `template`
optionnel aurait été plus simple pour l'appelant : un module qui l'oublierait par bug recevrait
alors silencieusement le template par défaut, et sortirait une fiche fausse que personne ne
remarquerait. Une intention écrite vaut mieux qu'un défaut silencieux.

**Le piège est réel, et il est surveillé.** Les règles comparent des *libellés* de catégorie :
renommer « Manutention » en back-office ne lève rien, les fiches retombent sur le défaut et sortent.
`/journal` liste donc les **catégories sans règle** — la liste exacte des règles à réécrire. C'est
la même classe de défaut que l'ancien module, qui appariait les caractéristiques par libellé traduit
et cassait en silence au premier renommage.

## Comptes et rôles

L'interface demande une **session**, et chaque personne a un **rôle** qui décide de ce qu'elle peut
faire. Trois rôles, chacun correspondant à un poste réel :

| | Super-admin | Administrateur | Éditeur | Importateur |
|---|:---:|:---:|:---:|:---:|
| Voir et **prévisualiser** les templates | ✅ | ✅ | ✅ | ✅ |
| Créer, modifier, publier, **supprimer** un template | ✅ | ✅ | ✅ | — |
| Importer un catalogue, lire le journal | ✅ | ✅ | ✅ | ✅ |
| Téléverser des images | ✅ | ✅ | ✅ | — |
| Comptes, boutiques, clés API | ✅ | ✅ | — | — |
| **Gérer les administrateurs**, transmettre son rôle | ✅ | — | — | — |

**Le super-administrateur est unique et transmissible** — le seul à pouvoir accorder le rôle
d'administrateur, et à en supprimer un. Son compte ne peut être ni supprimé, ni désactivé, ni
rétrogradé : la seule sortie est la transmission, ce qui garantit qu'il y a toujours quelqu'un qui
répond de l'instance. L'unicité est tenue par la **base**, pas par du code. `pnpm superadmin`
est la sortie de secours quand il n'est plus joignable — elle exige un accès SSH, et c'est la
garantie.

**Ce n'est pas une hiérarchie**, même si le tableau y ressemble : un éditeur n'est pas un
administrateur diminué, il n'a aucune raison de voir les clés API du parc. La matrice est donc
écrite rôle par rôle dans `src/lib/roles.ts` plutôt que dérivée d'un niveau numérique.

**L'importateur peut prévisualiser sans pouvoir modifier** — bouton « Aperçu » sur l'accueil et
dans la page d'import. C'est le seul moyen de travailler *sur* un template sans avoir le droit d'y
toucher, et l'aperçu part de données d'exemple : il ne divulgue aucun catalogue.

Un accès s'ouvre **toujours** par un administrateur, qui envoie une invitation ; le mot de passe est
choisi par la personne et ne transite jamais par un tiers. Amorçage d'une instance neuve :
`pnpm admin prenom.nom@exemple.fr "Prénom Nom"`.

**La connexion est exposée sur Internet** — le nom du service figure dans les journaux de
Certificate Transparency depuis l'émission du certificat, il n'y a aucune obscurité à laquelle se
raccrocher. Trois contrôles s'y superposent : un verrou par compte (10 échecs, 15 min, vérifié
**avant** la dérivation scrypt, qui coûte 44 ms et 32 Mo), un `rateLimit` Traefik par adresse source
sur `/api/auth`, et un **plancher de réponse à 200 ms** qui empêche la durée de révéler quel chemin
a été pris. Chaque échec est écrit dans `login_attempts` avec son IP, et `/admin` en montre le
décompte : on ne bloque bien que ce qu'on a d'abord constaté. Le détail, limites comprises, est au
§8 et §10 de **[docs/comptes-et-roles.md](docs/comptes-et-roles.md)**.

Les réponses portent des **en-têtes de sécurité** (`next.config.ts`) : `nosniff`, `X-Frame-Options`,
`Permissions-Policy`, et une CSP volontairement étroite — `frame-ancestors`, `base-uri`,
`form-action`, `object-src`. Pas de `script-src` : Puck et Next injectent des scripts en ligne, et
une politique qui casse l'éditeur serait désactivée dans la semaine. `/activation` ajoute
`Referrer-Policy: no-referrer`, son URL portant un jeton.

Le reste — invitations, relais SMTP, journal des actions, décisions de sécurité, migration d'une
instance qui tournait derrière le basicauth de Traefik — est dans
**[docs/comptes-et-roles.md](docs/comptes-et-roles.md)**.

## Vérifications

```sh
pnpm check          # lint + types + tests — exactement ce que fait l'integration continue
pnpm build
```

`pnpm check` ne demande **aucune infrastructure** et tourne en quelques secondes. Deux contrôles
supplémentaires exigent un Postgres : `pnpm migrate` et `pnpm test:integration` (qui
**tronque** les tables de la base pointée par `DATABASE_URL`).

Sur GitHub, l'intégration continue du dépôt rejoue ces contrôles à chaque pull request.

**Le témoin du HTML rendu.** `fixtures/golden/template-02.html` fixe le document produit pour un
template de référence. Il existe parce que le registry porte près de deux mille lignes de mise en page
qu'aucun test ne rendait : en refactorant la racine, le chemin PDF a été modifié et rien ne l'aurait
signalé. Il attrape un style en ligne perdu, un bloc qui s'efface, un token qui ne résout plus.

```sh
GOLDEN=update pnpm test     # après un changement VOULU, puis relire le diff
```

C'est la relecture du diff qui protège, pas le fichier. Les images inlines y sont réduites à une
empreinte — un témoin illisible n'est pas relu, donc ne protège de rien. Trois assertions
**indépendantes du témoin** (aucun token survivant, tableau peuplé, contraintes des bandeaux) empêchent
qu'un `GOLDEN=update` distrait ne grave une régression majeure dans le fichier de référence.

**Voir le canvas sans navigateur.** Le canvas de l'éditeur est le seul endroit qu'aucun test
n'atteint : il vit dans le navigateur, dans Puck. `pnpm probe-canvas` le rend hors navigateur —
arbre de template, contexte d'édition, feuille de l'éditeur — puis demande une capture au Chromium de
Gotenberg, déjà présent pour produire les PDF. La capture inclut le résultat de la barre de mesure,
compilée à la volée et exécutée dans ce Chromium, ce qui est la seule façon d'éprouver du code qui lit
un layout.

```sh
pnpm probe-canvas                                      # corps, profil typique
PROFILE=dense pnpm probe-canvas                        # le cas qui déborde
ZONE=header TEMPLATE=docs/exemple-bandeaux.json pnpm probe-canvas
MODE=tokens pnpm probe-canvas
```

La sonde **mime** ce que Puck passe aux blocs ; elle ne le remplace pas. Les repères, la géométrie, les
placeholders et la typographie y sont fidèles ; la sélection et le glisser-déposer ne peuvent pas y
être éprouvés.

## Déploiement

**Aucun outillage Node n'est requis sur le serveur.** L'installation et le `next build` tournent
dans l'image (`infra/config/app/Dockerfile`) : l'hôte n'a besoin que de Docker et de
`docker compose`. Le `docker compose up` de la racine du dépôt en est la démonstration : Postgres,
Gotenberg et le Studio, migrations comprises.

**Après les migrations, la base est vide** : ni compte, ni polices, ni tokens, ni template. Les
scripts d'amorçage sont les mêmes qu'en local — `create-admin.ts`, `seed.ts`,
`install-typography.ts`, `install-starter-template.ts`, `install-default-template.ts` — et sont
idempotents : sans argument, ils listent sans rien écrire.

**L'étage de production ne peut pas exécuter ces scripts**, et ce n'est pas une question de droits :
il ne recopie que `.next/standalone` et `.next/static`. Ni les sources, ni `scripts/`, ni `tsx` n'y
sont. Ils tournent depuis l'étage de build, qui porte les outils.

`gotenberg` et `db` restent sur un réseau interne, non exposés. Chromium n'a aucun accès réseau
sortant : les images lui arrivent jointes au rendu. Seul `app` est publié, et c'est `src/proxy.ts`
qui laisse passer `/api/v1/*` sans session, ces chemins portant leur propre clé.

Le service `app` déclare un `healthcheck` qui interroge `/api/health` : `docker compose ps` dit
alors si le service *répond*, et pas seulement si le conteneur tourne.

## Tenir la charge d'une génération en masse

**Le plafond de rendus simultanés est une contrainte de mémoire, pas de vitesse.** Un rendu tient en
mémoire les assets joints (jusqu'à `MAX_REQUEST_BYTES`, 32 Mo), les recopie dans le multipart envoyé à
Gotenberg, puis met le PDF produit en tampon : environ **trois fois le poids du payload**, pendant
toute la durée du rendu. Rien ne limitait le nombre de rendus en vol.

Or la génération en masse tire autant de requêtes que de workers, et **Gotenberg fait la queue en
interne** : le Studio gardait donc tous ces tampons ouverts pendant que Chromium traitait les rendus un
par un. Le pic de mémoire n'était pas borné par la capacité de rendu, mais par le nombre de requêtes
que la boutique voulait bien envoyer.

`src/lib/renderQueue.ts` place un sas **avant la lecture du corps de la requête** — une requête en
attente n'a encore rien mis en mémoire, son corps reste dans le socket.

| Réglage | Défaut | Rôle |
|---|---|---|
| `MAX_CONCURRENT_RENDERS` | 4 | rendus menés en parallèle |
| `MAX_QUEUED_RENDERS` | 8 | file au-delà de laquelle on répond `429` |
| `RENDER_QUEUE_TIMEOUT_MS` | 20 000 | attente maximale avant de rendre la main |

Au-delà, `429` avec `Retry-After` plutôt qu'une attente indéfinie : la demande est légitime, c'est le
rythme qui ne passe pas, et la génération en masse sait reprendre où elle s'est arrêtée. Mesuré : 20
aperçus simultanés → 12 servis, 8 refusés.

Le sas est **partagé avec l'aperçu de l'éditeur**, parce qu'il n'y a qu'un Gotenberg : lui donner sa
propre réserve reviendrait à mentir sur la ressource. La conséquence est assumée et dite à
l'intégrateur — un aperçu peut attendre pendant une génération en masse.

> La portée est **un processus**. Le compose ne déploie qu'un service `app` ; avec plusieurs replicas
> le plafond effectif serait multiplié d'autant, et il faudrait le porter côté Gotenberg.

## Journal des rendus

`/journal` — `render_logs` était alimentée depuis le premier jour et **personne ne la lisait**. Durées,
poids, avertissements et erreurs de chaque rendu de production, avec un index partiel sur les échecs :
tout était là, invisible hors d'un accès `psql`.

La page répond aux quatre questions qu'on se pose sur un parc qui génère en masse : est-ce que ça
passe, qu'est-ce qui échoue, qu'est-ce qui râle, est-ce que le moteur suit. Fenêtres de 1 h à 30 jours.

Deux choix de lecture :

- **les centiles écartent les requêtes refusées** (`status = 'saturated'`) : leur durée est celle d'un
  refus, quelques millisecondes, et les compter ferait *baisser* le p95 au moment précis où le service
  se dégrade ;
- **les avertissements sont regroupés par nature**, indice de tableau et référence fautive neutralisés.
  Les compter tels quels donnerait des milliers de lignes uniques où l'on ne verrait pas qu'il s'agit du
  même problème.

`queued_ms` sépare l'attente de la durée : « Chromium a mis 3 s » et « la requête a attendu 3 s qu'une
place se libère » appellent des décisions opposées — alléger le template, ou relever le plafond.

**La table a une rétention, désormais : 90 jours** (`RENDER_LOG_RETENTION_DAYS`). Une ligne par
rendu et aucune limite, c'était le seul défaut du dépôt qui empirait tout seul — la table grossit,
les agrégats de cette page ralentissent, la sauvegarde enfle, et personne ne décide rien. La purge
se déclenche depuis la page elle-même, par lots, au plus une fois par heure ; `pnpm purge` va au
bout en une fois, pour le premier passage ou pour un cron. La durée retenue est annoncée en bas de
la page : une rétention silencieuse ferait conclure que le journal ment.

Aucun graphique, et c'est un choix : une poignée de valeurs saillantes se lit en tuiles, des listes de
plus de sept entrées qui portent toutes du sens se lisent en tableau.

## API

| Route | Rôle | Authentification |
|---|---|---|
| `POST /api/v1/render` | Payload + assets → PDF, ou `429` si le moteur est saturé | clé de boutique |
| `GET /api/v1/templates` | Alimente le select du back-office | clé de boutique |
| `GET /api/v1/schema` | Variables disponibles (aide éditeur + BO) | clé de boutique |
| `GET /api/health` | Le service répond et joint la base | aucune |

Authentification : `Authorization: Bearer sk_<prefixe>_<secret>`. Le préfixe est stocké en clair
(il retrouve la ligne, indexé), la clé complète en sha256 seulement. Les clés s'émettent depuis
**`/admin/boutiques`**, qui affiche aussi la date de leur dernier usage — la seule information qui
permette de décider si l'on peut en faire tourner une. `pnpm issue-key <slug>` reste
disponible pour l'amorçage en ligne de commande.

**Le reste de l'application demande une session et un rôle**, jamais une clé. Les routes
`/api/editor/*` et `/api/admin/*` passent par `requireApi(<capacité>)`
(`src/lib/guard.ts`) ; `src/proxy.ts` ne fait qu'un raccourci en vérifiant la présence du cookie.

**Ajouter un bouton « Fiche technique » dans un back-office** — Medusa, PIM, ERP — à l'unité comme
en masse : **[docs/bouton-back-office.md](docs/bouton-back-office.md)**. La règle qui gouverne tout
le reste y tient en une ligne : la clé API ne doit jamais atteindre le navigateur.

### Corps de requête

Deux formes, selon que les médias de la boutique sont joignables depuis le Studio :

**`multipart/form-data`** — champ `payload` (JSON) + champs `asset[<clé>]` (binaires).
Le payload référence les fichiers en `asset://<clé>`. C'est le mode de PrestaShop, dont
`ImagesService` produit des **chemins filesystem locaux** que le conteneur de rendu ne peut pas
lire, et dont les domaines `*.localhost` ne résolvent pas entre conteneurs.

**`application/json`** — payload seul, images en URLs publiques (`https://`, `data:`).
Mode d'une boutique servant ses médias sur un CDN.

Un asset introuvable ne fait **pas** échouer le rendu : la référence est vidée, le bloc concerné
s'efface, et l'en-tête de réponse `X-Render-Warnings` liste les chemins fautifs.

### Payload

Voir `src/lib/payload.ts` (schéma zod, source de vérité) et `fixtures/sample-payload.json`.

Les noms de champs sont volontairement **neutres**, pour se mapper depuis n'importe quelle
plateforme :

| Champ | PrestaShop | Medusa |
|---|---|---|
| `product.sku` | `reference` | `variant.sku` |
| `product.gtin` | `ean13` | `variant.barcode` |
| `product.variant_skus` | `reference` des déclinaisons | `sku` des variantes |
| `product.supplier_skus` | `product_supplier_reference` | — (aucun champ natif) |

Deux choix règlent des défauts précis de l'ancien module :

- **`badges` est de la donnée** (`["ce", "tuv", "garantie:3ans"]`), résolue en pictos par le bloc
  `BadgeRow`. Fin du matching par nom de caractéristique traduit, qui cassait silencieusement dès
  qu'une caractéristique était renommée en back-office, et fin des pictos dupliqués dans cinq
  dossiers de template.
- **`shop.colors` / `shop.logo` arrivent au rendu**, jamais dans le template. C'est ce qui permet
  à un même template de bibliothèque de servir plusieurs sites avec leur identité propre, sans
  être dupliqué.

## Éditeur

`/` liste les templates, `/editor/{portée}/{slug}` les édite, `/assets` gère la bibliothèque
d'images. La portée est un slug de boutique ou `shared` pour la bibliothèque commune.

**Trois zones** — corps, en-tête, pied de page — éditées par onglets, Puck n'en gérant qu'une à la
fois.

## Le canvas montre ce que le PDF produira

Le registry est partagé entre l'éditeur et le rendu, donc le même composant React produit les deux.
Il ne garantissait rien sur les **props** qu'on lui passe, et c'est là que les deux chemins
divergeaient : le rendu résout les tokens avant d'appeler `render`, l'éditeur ne le faisait pas. Un
`FeatureTable` recevait donc la chaîne `{{features}}` au lieu du tableau — et comme un bloc dont la
source est vide doit s'effacer, il rendait `<></>`. **Invisible dans le canvas, la moitié d'une page
dans le PDF.** Idem galerie, pictos, grille ; les images sortaient en icône cassée, leur `src` valant
littéralement `{{shop.logo}}`.

Autrement dit, les blocs qui prennent le plus de place à l'impression étaient précisément ceux qui
n'en prenaient aucune à l'écran. `src/lib/blockProps.ts` est désormais le seul endroit où les props
d'un bloc sont préparées — fusion des valeurs par défaut, réparation des sources enregistrées à `[]`,
résolution des tokens — et ses deux consommateurs sont le chemin PDF et le canvas.

**Cinq divergences, toutes silencieuses, corrigées avec :**

| Divergence | Effet |
|---|---|
| Tokens non résolus dans le canvas | blocs de données invisibles à l'écran |
| Police `system-ui` 15 px contre Arial 10 pt | hauteurs mesurées fausses, donc sauts de page faux |
| `--color-primary` non défini dans l'éditeur | un titre en couleur primaire s'affichait noir |
| Largeur du canvas = largeur de la fenêtre | « 90 mm » et « 100 % » sans rapport avec l'A4 |
| Puck force `position: relative` sur chaque bloc | les « Éléments positionnés » étaient dans le flux |

La surface de page (`src/blocks/canvasChrome.tsx`) est exprimée **en millimètres** : le navigateur et
le Chromium de Gotenberg convertissent tous deux 1 mm en 96/25,4 px, donc une feuille de 210 mm dans
le canvas fait exactement la largeur d'une page du PDF — mesuré à 794 px pour 210 mm, 121 px pour la
bande haute de 32 mm. Elle porte les **marges papier**, les **bandes réservées** aux zones répétées
(hachurées, et signalées comme vides quand on réserve de la place pour rien) et des **rubans de saut
de page numérotés**.

**Un bloc qui ne produira rien affiche un placeholder qui dit pourquoi**, au lieu de disparaître :
« *Le réglage “Ignorer les 1 premières images” ne laisse rien à afficher : ce produit n'en a que 1* »,
« *Aucune correspondance badge / picto n'est définie* ». Cela répond sans `?format=html` à la question
la plus fréquente — pourquoi mon bloc est-il vide — et rend le bloc à nouveau sélectionnable. Ces
placeholders vivent dans `src/blocks/previewConfig.tsx`, que le chemin de rendu n'importe **jamais** :
ils ne peuvent donc pas fuir dans un PDF.

**Deux modes de canvas.** « Données d'exemple » résout les tokens ; « Tokens » les affiche et rend les
textes éditables sur le canvas. Les deux ne peuvent pas coexister : quand un champ est déclaré
`contentEditable`, Puck ne passe pas sa valeur au bloc mais un **élément React** (son éditeur en
ligne) — aucun token n'y serait résolu, et une saisie remplacerait le token par le texte du produit
d'exemple.

**Barre de mesure.** Nombre de pages, remplissage de la dernière, blocs traversés par un saut de page
(nommés), et dépassement d'une bande réservée en millimètres. Mesuré sur le DOM, sans aller-retour
vers Chromium : les pixels par millimètre sont eux-mêmes **mesurés** sur une sonde de 100 mm, ce qui
rend la lecture juste quel que soit le facteur de zoom. Vérifié contre le moteur de production : le
même template donne 1 page en profil typique et 2 en profil dense, des deux côtés.

## Éprouver un template avant qu'il ne serve mille fiches

Un template valide sur le produit moyen casse sur les quelques pour cent de produits qui sortent de
l'ordinaire : quarante caractéristiques au lieu de neuf, un nom sur trois lignes, aucune image. Ces
fiches-là ne sont pas relues une par une — elles sont générées en masse et publiées. **Le seul moment
où le problème peut encore être vu est la composition du template.**

**Sept profils de données** (`src/lib/sampleProfiles.ts`), choisis dans la barre d'outils et
appliqués au canvas comme à l'aperçu :

| Profil | Ce qu'il fait échouer |
|---|---|
| Typique | le produit moyen : 9 caractéristiques, 5 visuels, un schéma |
| Dense | 34 caractéristiques dont 4 doublons, nom sur trois lignes, description longue, 10 visuels |
| Minimal | 2 caractéristiques, un visuel, aucun schéma, aucun badge — montre les trous |
| Sans médias | aucune image, aucun logo — le produit fraîchement importé |
| Vestiaire | 2 groupes dont 4 fermetures, 4 accessoires détaillés, un visuel légendé |
| Siège | 3 groupes d'une seule valeur, 2 accessoires — le panneau de choix au plus maigre |
| Bureau | des décors bois en **texture** et non en aplat — le seul qui éprouve ce rendu |

**« Contrôler les profils »** rend le template par le moteur de production sur chacun et remonte
pages, avertissements et durée. C'est le tableau qui dit si une fiche basculera sur une deuxième page
pour une partie du catalogue. Les profils sont rendus l'un après l'autre, et non en parallèle : une
rafale de Chromium entrerait en concurrence avec une génération en masse en cours côté
boutique.

**Brouillon et publication, sans colonne dédiée.** Le brouillon est toujours la version au numéro
le plus élevé ; si celle-ci est publiée, la première édition en crée une nouvelle. Publier ne fait
que déplacer `published_version_id`, ce qui est atomique. **Une version publiée n'est jamais
modifiée** : une boutique qui demande `version: 12` obtient toujours le même rendu, et éditer
n'affecte la production qu'au moment où l'on publie.

**Découvrabilité des variables.** Un bouton « Variables disponibles » ouvre la liste complète,
groupée, avec copie au clic — les listes y sont signalées comme telles, puisqu'un token de liste
alimente un bloc répété et ne s'interpole pas dans une phrase. La liste vient de
`src/lib/variables.ts`, partagée avec `GET /api/v1/schema` pour que l'éditeur et l'aide du
back-office ne puissent pas décrire deux contrats différents.

Les champs qui n'ont qu'une réponse correcte sont des **listes déroulantes** (« Données affichées :
les caractéristiques du produit ») plutôt que du texte libre : un champ intitulé « Source » sans
indication était inutilisable. Les champs réellement libres portent un **placeholder** montrant un
exemple de token, et les champs texte sont **éditables directement sur le canvas**
(`contentEditable`), sans passer par le panneau de droite.

**Aperçu PDF exact** : rendu par le même moteur que la production, sur le jeu de données choisi.
Affiché **à côté du canvas** et non par-dessus, dans une blob URL en `<iframe>` — le lecteur PDF du
navigateur suffit, inutile d'embarquer pdf.js. Il se **rafraîchit tout seul** 1,2 s après la dernière
frappe, en annulant la requête en vol : sans cela une saisie rapide déclencherait une file de rendus
dont chacun occupe un Chromium et dont seul le dernier sert. Le nombre de pages est lu dans le PDF
(`src/lib/pdf.ts`) et affiché — c'est la réponse à « est-ce que ça tient ? ».

Une seule route de rendu, **trois vues** :

| `POST /api/editor/preview` | Renvoie |
|---|---|
| `?format=pdf` (défaut) | le PDF, avec `X-Pdf-Pages` |
| `?format=html` | le HTML envoyé à Chromium — diagnostic d'un bloc vide |
| `?format=report` | les seules mesures (pages, avertissements, poids, durée) |

`Cmd/Ctrl + S` enregistre, et le navigateur demande confirmation avant de fermer un onglet portant
des modifications non enregistrées.

Les routes d'édition vivent sous **`/api/editor/`** et non `/api/v1/` : le portail laisse passer
`/api/v1/*` sans session, ces routes portant leur propre clé de boutique. Une route d'édition
placée là serait publique. Chacune exige en outre une **capacité** précise —
`templates:write` pour enregistrer, `templates:publish` pour publier, `import:run` pour rendre une
fiche de lot, `templates:read` pour un aperçu.

## Bibliothèque d'images

Pictos de badges, logos et icônes, stockés en base (`bytea`) : le conteneur applicatif n'a aucun
volume à sauvegarder, un `pg_dump` restaure tout. Les templates les référencent par URL relative
(`/assets/shared/tuv`), et le moteur les **inline en data URI** au moment du rendu — Gotenberg n'a
donc jamais besoin de joindre l'application, et il n'y a aucune URL de service à configurer.

**L'encodage est mis en cache** (`src/lib/boundedCache.ts`), une minute, borné à 32 Mo. Sans lui,
une génération en masse de 2 000 fiches sur un template portant cinq pictos produisait 10 000
requêtes et 10 000 encodages base64 — pour cinq contenus qui ne changent pas. Le cache est vidé
explicitement à chaque téléversement ou suppression ; la péremption d'une minute couvre le cas
qu'une invalidation locale ne peut pas voir, celui d'un second processus qui écrit.

Re-téléverser sous la même clé remplace l'image partout où elle est utilisée, sans rouvrir les
templates.

> **Les pictos de certification du parc (CE, TÜV, Bureau Veritas) sont des PNG blancs à fond
> transparent.** Sur une page blanche ils se rendent correctement et sont invisibles. C'est ce qui
> a motivé la propriété « couleur de fond » du bloc `BadgeRow` : ces pictos exigent un bandeau
> coloré. À garder en tête lors de la reprise des anciens templates.

## Templates

`templates.shop_id` nullable : `NULL` = bibliothèque commune visible par tous les sites. Un
template propre à une boutique **masque** un template de bibliothèque de même slug, ce qui permet
de partir du modèle commun et de le surcharger sans renommer ni affecter les autres sites.

Les arbres sont au format de données Puck (`{ root, content, zones }`), donc l'éditeur produit
directement ce que le moteur consomme.

## QR code

Le bloc `QrCode` **génère le code lui-même**, à partir de son champ « contenu » (par défaut
`{{product.url}}`). La boutique n'a aucune image à fournir.

Le paquet retenu est `qrcode-generator` et non `qrcode`, plus connu, pour une raison de pipeline :
`qrcode` n'expose qu'une API à promesses, alors que le rendu des blocs est synchrone. Ici tout est
synchrone, donc le QR apparaît à l'identique dans l'aperçu de l'éditeur et dans le PDF, sans étape
de préparation ni champ de payload.

Sortie en **SVG** — net à toute taille d'impression, là où un PNG obligerait à deviner la
résolution. Correction d'erreur `M` (~15 % de redondance), suffisante pour un imprimé qui peut être
plié. Un contenu dépassant la capacité d'un QR fait s'effacer le bloc plutôt qu'échouer la fiche.

## Reprise des anciens templates

Guide de composition : **[docs/composer-les-templates.md](docs/composer-les-templates.md)** —
correspondance des variables, pièges constatés, composition suggérée pour chacun des cinq templates,
et procédure de bascule d'une boutique (dont l'ordre est contraignant).
`docs/exemple-template-02.json` est un arbre complet utilisable comme point de départ.

## Blocs disponibles

**Structure** `Columns` (2 ou 3 slots) · `Panel` · `Positioned` · `Spacer` · `Divider` · `PageBreak`
**Contenu** `Heading` · `Text` · `RichText` (HTML assaini) · `Image`

> **`Image` occupe toute la largeur de son conteneur par défaut**, et non 30 mm. Les 30 mm étaient
> taillés pour un logo, seul usage du bloc à sa création : un visuel produit posé avec ce défaut
> sortait en vignette, sans que rien ne le signale. Une image trop grande se voit et se corrige ;
> une image trop petite passe pour un défaut du moteur. « Hauteur maximale » borne une photo en
> portrait sans la déformer, et l'étiquette bleue rappelle la taille pendant la composition.
**Produit** `FeatureTable` · `ImageGallery` · `SchemaImage` · `BadgeRow` · `KeyValueGrid` · `QrCode`
**Bandeaux** `PageHeader` · `PageFooter`

**`Panel` est le bloc qui manquait pour reprendre les anciens templates.** La lecture des cinq
`.tpl` de `acmepdfgenerator` a montré que quatre d'entre eux posent un fond coloré ou une bordure
derrière un groupe d'éléments : colonne latérale du 02, barre « Ref: » du 03 et du 05, encadrés
jaunes du 04. Sans conteneur décoré, aucun n'était reproductible. `Heading`, `Text` et
`ImageGallery` ont reçu les mêmes possibilités pour les cas simples, et `Columns` un troisième slot
pour la ligne à trois colonnes du 02.

Vérifié en reproduisant le template 02, le plus contraignant : trois colonnes, vignettes encadrées,
colonne latérale colorée contenant un QR blanc et trois pictos. **Les cinq templates de l'ancien
module sont exprimables.**

## Marges et pleine largeur

Deux leviers distincts, sur les réglages de la **racine** du corps :

| Réglage | Portée |
|---|---|
| **Marge papier gauche / droite** | toute la page, bandeaux compris |
| **Retrait du contenu à gauche / droite** | le corps seulement — `0` donne la pleine largeur |

Les deux sont indépendants : un bandeau bord à bord avec un corps en retrait est le cas courant, et
c'est pourquoi la marge papier est à 0 par défaut tandis que le retrait du contenu est à 12 mm.

> **La marge intérieure de la racine ne s'applique plus aux zones répétées.** Elle le faisait, ce
> qui insérait 12 mm de part et d'autre de chaque bandeau — impossible d'aller bord à bord, et rien
> ne l'indiquait puisque la racine des arbres d'en-tête et de pied est vide. La racine porte la
> géométrie de page, le retrait du corps et les repères de saut de page : trois choses qui n'ont
> aucun sens dans un en-tête.

## Espacement entre les blocs

Un seul réglage gouverne l'aération d'une fiche : **« Espacement entre les blocs (mm) »**, sur la
racine du corps (4 mm par défaut). Les conteneurs ont le leur, pour resserrer ou aérer localement :
`Panel` → « Espacement entre les blocs internes », `Columns` → « Espacement dans une colonne »
(distinct de « Espacement entre les colonnes »).

Avant, chaque bloc décidait de sa propre marge : 3 mm sous un titre, 2 mm sous un paragraphe, rien
ailleurs. D'où des fiches tantôt serrées tantôt aérées, sans aucun réglage possible. **`Heading` et
`Text` n'ont plus de marge propre** — l'espacement appartient au conteneur.

Pour un écart ponctuel, le bloc **`Espace`** l'emporte : une hauteur **négative** rapproche deux
blocs, ce qui est le seul moyen de *retirer* de l'espace, le réglage du document ne pouvant
qu'ajouter. Utile pour coller un sous-titre à son titre sans dérégler toute la fiche.

Un « Élément positionné » est hors flux : l'espacement l'ignore et son ancrage reste exact.

## Faire tenir un tableau de caractéristiques

Un catalogue PrestaShop porte régulièrement plusieurs valeurs sous le même libellé — « Réglages »
trois fois, avec trois valeurs différentes. Le bloc `FeatureTable` les **regroupe** désormais en une
ligne (réglage « Regrouper les caractéristiques de même nom », actif par défaut), les valeurs
séparées par une puce, une virgule ou un retour à la ligne au choix.

L'abréviation reste collée **à sa valeur** et non au groupe : c'est un renvoi vers une côte du
schéma, il désigne une valeur précise. `45 cm (H) · 52 cm (H2)`, et non `45 cm · 52 cm (H, H2)`.

Les quatre leviers, **mesurés** sur un produit réel de 21 caractéristiques dont 3 en doublon
(hauteur de la page utile : 243 mm) :

| Disposition | Hauteur |
|---|---|
| Colonne de 90 mm, sans regroupement | 193 mm |
| Colonne de 90 mm, regroupé | 186 mm |
| Colonne de 90 mm, regroupé + densité serrée | 164 mm |
| Pleine largeur (186 mm), sans regroupement | 144 mm |
| Pleine largeur, regroupé | 132 mm |
| Pleine largeur, regroupé + 2 colonnes | 102 mm |
| Pleine largeur, regroupé + 2 colonnes + densité serrée | **91 mm** |

Enseignement contre-intuitif : **le regroupement n'est pas le levier principal** (−7 mm dans une
colonne étroite, les valeurs concaténées se repliant sur plusieurs lignes). Ce qui coûte, c'est la
**largeur** : le même tableau perd 54 mm en passant de 90 mm à pleine largeur, et 30 mm de plus sur
deux paires de colonnes.

### Lisibilité en mode deux colonnes

Quatre colonnes accolées, toutes du même fond, forment un mur de texte. Trois dispositifs, tous
réglables, séparent les deux moitiés :

- une **gouttière** qui est une vraie colonne **sans fond** — elle laisse voir le fond du conteneur,
  ce qui fait lire deux tableaux distincts ;
- un **filet** vertical, en plus de la gouttière ;
- des **largeurs de colonnes explicites** (`table-layout: fixed`), sans lesquelles chaque moitié se
  cale sur la longueur de son propre contenu et les deux ne s'alignent jamais. « Part du libellé »
  règle le partage à l'intérieur d'une paire : dans une colonne étroite, un libellé comme
  « Dimensions Hors tout (cm) » se replie sur trois lignes si on lui donne moins de la moitié.

Les cellules sont alignées **en haut** : une valeur repliée sur trois lignes face à un libellé d'une
seule ligne se lit mal centrée, on ne sait plus quelle valeur va avec quel libellé.

### Le fond appartient au tableau

`FeatureTable` porte son propre **fond**, sa **couleur de texte**, sa **marge intérieure** et son
**arrondi** — comme `Heading`, `Text` et `ImageGallery`. C'est ce qui manquait au bloc qui en avait le
plus besoin.

Sans cela, colorer un tableau imposait de l'entourer d'un `Panel`, dont le fond s'étend à **tout** ce
que le panneau contient : un schéma coté placé à côté du tableau se retrouvait sur le même aplat,
sans raison. Le bon montage est donc `Columns` → schéma d'un côté, tableau coloré de l'autre, sans
panneau autour.

> **Le zébrage se dérive de la couleur du texte.** Retirer le fond d'un `Panel` en y laissant
> `color: #ffffff` donne donc du blanc sur blanc, et un zébrage invisible pour la même raison. Les
> deux couleurs doivent voyager ensemble : les porter toutes les deux sur le tableau.

### Le piège des couleurs de fond

Le zébrage et l'en-tête étaient peints en `var(--color-primary)` **en dur**. Dans un `Panel` de la
couleur primaire — la disposition la plus courante des anciens templates — ils devenaient donc
rigoureusement invisibles, bleu sur bleu, sans qu'aucune option ne permette d'en sortir.

Les deux sont maintenant réglables, et leur défaut se **dérive de la couleur du texte** :
`color-mix(in srgb, currentColor 14%, transparent)` pour une ligne alternée, 30 % pour l'en-tête.
Texte blanc sur panneau coloré → lignes plus claires ; texte sombre sur page blanche → gris très
léger. Aucune valeur fixe ne peut convenir aux deux cas.

L'alternance démarre à la **deuxième** ligne quand l'en-tête est affiché : deux bandes teintées l'une
sous l'autre affadissent l'en-tête, qu'on veut justement voir en premier.

## Composer un en-tête ou un pied de page

Les zones répétées acceptent **n'importe quel bloc**, pas seulement `PageHeader` / `PageFooter` —
ces deux-là ne sont que des raccourcis pour le cas simple. Dès que le contenu varie d'un template à
l'autre (QR en haut ici, en bas là, absent ailleurs), composer à la main est plus direct.

**Deux façons de composer, selon le besoin.**

Des éléments **côte à côte** → `Columns` dans un `Panel` :

```
Panel  (hauteur, image de fond)
└─ Columns  (ratio 1fr 1.4fr 0.8fr)
   ├─ Image / ├─ Text / └─ QrCode
```

Des éléments **posés librement par-dessus le fond**, chacun où l'on veut → `Positioned` :

```
Panel  (hauteur 30 mm, image de fond)
├─ Positioned  haut gauche,    +8 / +5 mm  → Image    {{shop.logo}}
├─ Positioned  centre,          0 / -2 mm  → Text     {{product.name}}
├─ Positioned  bas centre,      0 / +3 mm  → Text     Ref. {{product.sku}}
└─ Positioned  haut droite,    +8 / +4 mm  → QrCode   {{product.url}}
```

C'est cette seconde forme qui répond aux cas réels : le QR n'est pas un « troisième slot », c'est un
élément posé où il doit l'être, au même titre que le logo ou le titre. Les décalages s'ajoutent
toujours **vers l'intérieur** depuis le bord ancré, et l'ordre de superposition est réglable.

`docs/exemple-bandeaux.json` contient cet arbre complet, en-tête et pied de page.

Quatre blocs rendent cela possible :

- **`Panel` avec une hauteur** devient un bandeau : fond en couleur **ou en image** (`cover`,
  `contain`, étiré, taille réelle, et position), et alignement vertical du contenu.
- **`Image`** place n'importe quelle image — `{{shop.logo}}`, un visuel de la bibliothèque, une image
  produit — en mm ou en pourcentage. Sans ce bloc, le logo n'était accessible qu'à travers la mise en
  page figée de `PageHeader`.
- **`Positioned`** place son contenu librement dans le `Panel` qui l'entoure : ancrage parmi neuf
  points de référence, décalages en millimètres, largeur et ordre de superposition. Ancrage +
  décalages plutôt que quatre valeurs de bords, parce que `0` y est une position légitime qu'on ne
  peut pas distinguer de « non renseigné ».
- **`PageNumber`** s'utilise seul, donc la numérotation ne contraint plus le reste du pied de page.

Le **fond en image fonctionne bien dans les zones répétées** — vérifié, ce n'était pas acquis : ces
zones ignorent silencieusement plusieurs propriétés CSS. Les images y sont automatiquement inlinées
en data URI, y compris les fonds.

## Manipuler les conteneurs dans l'éditeur

**Sélectionner un conteneur.** Quand les slots d'un `Columns` ou d'un `Panel` occupent toute sa
surface, chaque clic atteint le slot et jamais le conteneur — donc impossible de le supprimer, de le
déplacer ou d'en régler les propriétés. Deux chemins :

- l'**étiquette bleue** en haut à gauche de chaque conteneur (« Colonnes 3 », « Bandeau »,
  « Positionne top-left »), ajoutée pour cela. Elle n'existe que dans l'éditeur : le chemin de rendu
  PDF n'injecte pas de contexte Puck, donc elle ne peut pas fuir dans un document ;
- le bouton **« Select parent »** de la barre d'actions de Puck, qui remonte d'un niveau depuis
  l'élément sélectionné.

Un conteneur sélectionné se supprime avec l'action correspondante de sa barre d'actions.

**Déplacer un élément d'un conteneur à un autre** se fait **par glisser-déposer sur le canvas**. Les
slots vides y sont visibles : Puck leur donne 128 px de hauteur et un contour pointillé, ce qui en
fait des cibles de dépôt franches.

> **Le panneau « outline » ne permet pas le glisser-déposer.** Ce n'est pas un réglage manqué :
> l'outline de Puck est en sélection seule, sans aucun mécanisme de glisser. Le reconstruire
> supposerait réimplémenter l'arbre, le glisser-déposer et l'émission des actions `move` de Puck —
> disproportionné, et fragile face aux évolutions de la bibliothèque. À reconsidérer si Puck l'ajoute
> nativement.

## Ajouter un bloc

Tout se passe dans `src/blocks/registry.tsx` : un couple `fields` / `render` suffit, l'éditeur et
le rendu PDF le récupèrent tous les deux. Deux règles, non négociables :

1. **Aucun hook React.** Voir la contrainte des deux instances de React ci-dessous.
2. Un bloc dont la source est vide doit **retourner `<></>`**, pas un conteneur vide : c'est ce
   qui fait qu'une fiche sans schéma ou sans caractéristique reste propre.

Les tokens (`{{product.name}}`, `{{features}}`) sont résolus avant `render` : les composants ne
voient que des valeurs concrètes. Un token seul dans un champ renvoie la **valeur typée** (un
tableau alimente `FeatureTable`) ; dans une phrase, il est interpolé.

## Contraintes établies par mesure

Ces points ont chacun coûté un diagnostic, et chacun se manifeste par une **dégradation
silencieuse** — pas par une erreur. À ne pas « simplifier » sans relire.

**1. `react-dom/server` n'est pas importable statiquement.** Next bundle les route handlers dans
la couche `react-server`, où la condition d'export du même nom fait pointer tous les points
d'entrée `react-dom/server.*` vers un stub **vide**. Le symptôme est trompeur (« Export
renderToStaticMarkup doesn't exist » alors que le module existe). `createRequire` ne sauve pas non
plus : Turbopack trace les `require` qui en dérivent. D'où l'import dynamique annoté
`turbopackIgnore` dans `src/lib/render.tsx`.

**2. Il y a donc deux instances de React.** Celle du `react-dom/server` chargé par Node, et celle
du bundle. Les éléments React traversent sans problème (les symboles sont dans le registre
global), **les hooks non** : le dispatcher appartient à une instance. C'est pourquoi le rendu
n'utilise pas le `<Render>` de Puck (il appelle `useMemo`) mais un parcours d'arbre maison, et
pourquoi aucun bloc ne doit utiliser de hook. Symptôme d'une violation : `Cannot read properties
of null (reading 'useMemo')`.

**3. Les zones répétées de Chromium (`header.html` / `footer.html`) sont un environnement
contraint.** Trois règles, toutes vérifiées expérimentalement :
- `print-color-adjust: exact` est **obligatoire** — sans lui Chromium ignore les couleurs de fond
  et de texte, et `printBackground=true` côté Gotenberg n'y change rien.
- Le document doit avoir **un seul élément racine** : avec plusieurs enfants de `<body>`, Chromium
  les répartit dans ses emplacements gauche/centre/droite et écrase leurs styles.
- Cet élément devient un **item flex** : sans `width: 100%` il épouse son contenu, pas la page.

**4. Chromium ne charge AUCUNE ressource distante dans les zones répétées.** Une URL `https://`
qui s'affiche parfaitement dans le corps donne, dans un bandeau, une image de fond absente et une
icône d'image cassée — sans erreur. `src/lib/remoteImages.ts` télécharge donc ces URLs côté serveur
et les inline en data URI, pour les bandeaux uniquement. Le corps n'en a pas besoin.

Le téléchargement ne cible que les propriétés qui désignent une image (`source`, `src`, `logo`,
`logoUrl`, `iconUrl`, `backgroundUrl`, `backgroundImage`). Sans ce filtre, on irait chercher
`{{product.url}}` — l'adresse de la fiche produit, utilisée comme contenu de QR code.

**5. La numérotation ne fonctionne que dans les zones répétées.** `<span class="pageNumber">` et
`<span class="totalPages">` doivent rester **vides** — Chromium en remplace le contenu textuel.
Dans le corps du document, ils n'ont aucun effet.

**6. Chromium fragmente correctement un conteneur flex en colonne.** L'espacement entre blocs
repose sur `display: flex` + `gap` (voir `stack()` dans le registry) plutôt que sur une règle CSS
`> * + *`, parce que **le registry ne pose que des styles en ligne** : c'est cette règle qui
garantit que l'aperçu de l'éditeur et le PDF ne peuvent pas diverger, une feuille de style devant
sinon être injectée — donc dupliquée — dans deux documents distincts.

La pagination d'un flex **exigeait une mesure** : une fragmentation incomplète aurait fait tenir
une fiche longue sur une seule page, le reste absent sans erreur. Sonde : 90 blocs de texte
numérotés, **5 pages** produites, **1881** opérateurs d'affichage comptés dans le PDF pour 1881
caractères attendus. Aucun contenu perdu.

**7. Puck ignore les `viewports` quand l'iframe est désactivée.** Vérifié dans son code : la largeur
du viewport n'est appliquée — et les contrôles de viewport ne sont rendus — que si `iframe.enabled`.
Avec `iframe: { enabled: false }`, que ce projet impose pour que les repères et les styles de
l'application s'appliquent au canvas, la largeur est forcée à `100 %` et il n'y a aucun zoom. Les deux
viewports « A4 » qui étaient déclarés ici n'ont donc jamais rien fait, et le canvas faisait la largeur
de la fenêtre. **La géométrie de page appartient à la surface de page elle-même**, en millimètres, et
le zoom est celui de l'éditeur.

**8. Puck impose `position: relative` en style *en ligne* sur chaque bloc.** Il le fait par effet,
après le rendu de React, sur l'élément racine du bloc. Un « Élément positionné », qui se déclare
`absolute`, se retrouvait donc **dans le flux à l'écran et hors flux dans le PDF** — la divergence la
plus trompeuse, puisqu'elle porte sur le bloc dont tout l'intérêt est la position. Seule une règle
`!important` d'une feuille de style reprend la main sur un style en ligne : d'où `.ds-positioned` dans
`editor.css`, sans effet au rendu, où la classe n'est pas définie.

**9. Puck remplace la valeur d'un champ `contentEditable` par un élément React.** Ce n'est donc pas la
chaîne qui arrive au bloc mais son éditeur en ligne, ce qui rend la résolution des tokens impossible
sur ces champs — et une saisie y écraserait le token par le texte résolu. C'est ce qui impose les deux
modes de canvas plutôt qu'un seul. Corollaire : `resolveValue()` laisse passer intacts les éléments
React et les fonctions, un résolveur qui traverse ce qu'il ne comprend pas le transformant en objet nu.

**10. `color-mix()` fonctionne dans le Chromium de Gotenberg.** Ce qui permet des couleurs dérivées
de la couleur du texte courant plutôt que des valeurs fixes qui ne peuvent pas convenir à tous les
fonds (zébrage et en-tête du `FeatureTable`). Vérifié de façon discriminante : un mélange **opaque**
ressort en `.5 0 .5` dans le flux du PDF, un mélange translucide en remplissage blanc plus une
opacité `/ca .14`, et une valeur invalide ne produit **aucun** remplissage — la sonde distingue donc
bien « supporté » de « ignoré silencieusement ».

## Sécurité

Tout champ `*_html` du payload traverse obligatoirement `sanitizeRichHtml()` (`src/lib/html.ts`)
avant rendu : sans ce filtre, un `<script>` collé dans une description produit en back-office
s'exécuterait dans le conteneur de rendu, avec accès réseau. `src/lib/html.test.ts` verrouille ce
comportement — toute régression y est une exécution de code arbitraire, pas un défaut cosmétique.

**La feuille de style d'un template ne peut pas refermer sa balise** (`styleElement()`, même
fichier) : `</style` y est neutralisé au rendu, et refusé à l'enregistrement. Sans cela, un compte
éditeur posait un script dans chaque fiche rendue avec ce template.

**Le JavaScript est coupé dans Gotenberg** (`--chromium-disable-javascript=true`), en seconde
barrière : aucun rendu n'en a besoin, le HTML est produit côté serveur sans un seul `<script>`.

Les références d'assets sont réécrites en noms de fichiers assainis (`safeFilename`) : une clé
fournie par l'appelant ne se retrouve jamais telle quelle dans un chemin côté conteneur de rendu.
Les schémas `file://` sont refusés, à l'entrée comme dans le HTML assaini.

**Les URLs d'images sont filtrées avant d'être jointes** (`src/lib/publicUrl.ts`). Le payload
désigne les médias par des URLs, et c'est le Studio qui les télécharge : sans filtre, une boutique authentifiée pouvait se faire livrer
`http://169.254.169.254/latest/meta-data/` **en base64 dans son PDF**. Sont refusés : les schémas
autres que `http`/`https`, les adresses non routables sous toutes leurs écritures — y compris
`::ffff:a9fe:a9fe`, la forme hexadécimale de `169.254.169.254` — et **chaque redirection est
revalidée**, le contournement le plus courant étant une URL publique qui renvoie vers une adresse
privée.

**Chromium n'a aucun accès réseau.** Jusqu'au 16/10/2026 il chargeait lui-même les images du
corps, filtrées par une liste d'adresses lue sur le *texte* de l'URL : un nom de service Docker
(`http://app:3000/`) ou un nom qui résout en privé passait. Désormais (`src/lib/remoteImages.ts`) :

- les URLs sont relevées dans le **document final** (`src`, `url()`), donc seules les images
  réellement affichées sont téléchargées — par l'application, à travers `safeFetch` ;
- dans le corps, chaque image devient un **fichier joint** au multipart ; dans les bandeaux, une
  data URI, seule forme que Chromium y affiche ;
- au plus 64 images par fiche, 10 Mo par image (lecture interrompue au premier octet de trop),
  48 Mo par rendu, 6 téléchargements simultanés, et un cache de 64 Mo pendant 10 minutes ;
- Gotenberg n'autorise que ses fichiers joints (`--chromium-allow-list=^file:///tmp/.*`) et vit
  seul avec l'application sur un réseau Docker **sans sortie** (`rendu`, `internal: true`). Deux
  barrières indépendantes : un réglage oublié ne rouvre rien.

Le risque résiduel est écrit en tête de `publicUrl.ts` : entre la résolution DNS et la connexion,
un attaquant maîtrisant sa propre zone DNS peut encore faire basculer la réponse. S'en prémunir
demanderait un client HTTP à `lookup` personnalisé que Node n'expose pas sans dépendance.

**Rien de réversible n'est stocké.** Les clés API sont en sha256, les mots de passe en empreintes
scrypt paramétrées, les jetons d'invitation en sha256. Une copie de la base — un dump de recette,
une sauvegarde égarée — ne permet de prendre ni une boutique ni un compte.

**Le mot de passe choisi est confronté aux fuites de données connues** — par k-anonymat : seuls les
cinq premiers caractères de son empreinte SHA-1 partent, jamais le mot de passe. La longueur protège
du hasard, pas de la réutilisation. Mesuré : `Password123!Password` — vingt caractères, majuscule,
chiffre, symbole — figure dans les fuites, et `azertyuiopqsdfgh` y est vu 2 578 fois tout en passant
la politique de longueur. Le contrôle **échoue ouvert** : service injoignable, mot de passe accepté.
Détail au §11 de **[docs/comptes-et-roles.md](docs/comptes-et-roles.md)**.

**Les sessions vivent en base et non dans un jeton autoportant**, parce que désactiver un compte
doit couper l'accès *tout de suite*. Elles ont deux échéances : douze heures d'inactivité, repoussée
à chaque requête, et trente jours en absolu, jamais repoussée. Le détail des décisions — politique
de mot de passe, verrouillage après échecs, non-énumération des comptes — est dans
**[docs/comptes-et-roles.md](docs/comptes-et-roles.md)**, §8.

**Masquer un bouton ne protège rien.** L'interface cache ce que le rôle ne permet pas, par
lisibilité ; chaque page et chaque route revalide côté serveur. Une route ajoutée sans garde est
publique, et aucune vérification automatique ne l'attrape — c'est la première chose à regarder en
relecture (voir [CONTRIBUTING.md](CONTRIBUTING.md), §3.3).
