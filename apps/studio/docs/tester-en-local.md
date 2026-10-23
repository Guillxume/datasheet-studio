# Tester en local

Deux façons de faire tourner le Studio, selon ce qu'on veut faire.

| Besoin | Commande (depuis la racine du dépôt) |
|---|---|
| Visiter le Studio, essayer l'API | `docker compose up --build` — tout tourne dans Docker, données de démonstration comprises |
| Modifier le code | Postgres, Gotenberg et Mailpit dans Docker, le Studio sur le poste en `next dev` (ci-dessous) |

## La démonstration, en une commande

```sh
docker compose up --build
```

Puis <http://localhost:3000>, avec le compte `admin@example.com` / `studio-demo-2026`.

Le service `setup` applique les migrations, crée la boutique **Contoso Equipment** (fictive), installe
et publie trois templates de bibliothèque, puis le service `samples` rend quatre fiches par l'API
publique : le journal des rendus et la consultation ne sont pas vides au premier passage. Relancer
`docker compose up` ne recrée rien — tout est idempotent.

| Quoi | Où |
|---|---|
| Studio — liste des templates | <http://localhost:3000/> |
| Studio — éditeur | <http://localhost:3000/editor/shared/fiche-produit-simple> |
| Studio — consultation des fiches | <http://localhost:3000/consultation> |
| Studio — journal des rendus | <http://localhost:3000/journal> |
| Courriels attrapés (Mailpit) | <http://localhost:8025> |

Ports, compte et clé se changent par variables d'environnement : `STUDIO_PORT`, `MAIL_UI_PORT`,
`DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_API_KEY` (voir l'en-tête de `docker-compose.yml`). La clé et le
compte ne sont posés qu'à la première initialisation : après un changement, repartir d'une base vide
avec `docker compose down -v`.

> **Une démonstration, pas un déploiement.** Mot de passe et clé API sont publics, le cookie de
> session circule en HTTP, rien n'est publié au-delà de `127.0.0.1`.

### Rendre une fiche au curl

```sh
D=apps/studio/scripts/demo
curl -X POST http://localhost:3000/api/v1/render \
  -H "Authorization: Bearer sk_000000000000_local-demo-key-not-a-secret" \
  -F "payload=<$D/payload.json" \
  -F "asset[logo]=@$D/images/logo.svg" \
  -F "asset[img-0]=@$D/images/shelving.svg" \
  -F "asset[img-1]=@$D/images/shelving-detail.svg" \
  -F "asset[schema]=@$D/images/shelving-schema.svg" \
  -o fiche.pdf
```

`payload=<` et non `payload=@` : la première forme envoie le contenu du fichier comme valeur de
champ, ce que produit le module PrestaShop. Les images voyagent à côté, en `asset[<clé>]`, et le
payload y renvoie par `asset://<clé>`.

Les quatre fiches de démonstration d'un coup, écrites dans un dossier :

```sh
cd apps/studio
STUDIO_URL=http://localhost:3000 DEMO_API_KEY=sk_000000000000_local-demo-key-not-a-secret \
  pnpm exec tsx scripts/demo-samples.ts --out /tmp/fiches
```

## Développer : le Studio sur le poste

### Installer

```sh
pnpm install          # a la racine : tout le workspace
pnpm build:ui         # le Studio consomme @guillxume/ui depuis son dist/
```

Pour modifier le design system en même temps, `pnpm --filter @guillxume/ui build:watch` dans un
second terminal : le Studio voit chaque reconstruction.

**`qpdf`**, l'outil qui assemble les books et rend leur sommaire cliquable, est installé dans l'image
Docker ; sur le poste :

```sh
brew install qpdf
```

Sans lui, rien ne casse : le book est assemblé par Gotenberg, et son sommaire est imprimé sans liens
ni signets. `tests/bookToc.integration.test.ts` est alors sauté, en le disant.

### Démarrer

```sh
# 1. Postgres (5433), Gotenberg (3100) et Mailpit (1025 / 8025), publies sur 127.0.0.1
docker compose -f docker-compose.yml -f apps/studio/infra/docker-compose.dev.yml up -d db gotenberg mailpit

# 2. La configuration du poste
cp apps/studio/.env.dist apps/studio/.env

# 3. Le schema, la boutique de test et un premier template
pnpm --filter @guillxume/studio migrate
pnpm --filter @guillxume/studio seed

# 4. Le Studio, en mode developpement
pnpm --filter @guillxume/studio dev
```

Les ports publiés se changent par `DB_PORT`, `GOTENBERG_PORT` et `MAIL_SMTP_PORT` — à reporter
alors dans `apps/studio/.env`.

`pnpm seed` affiche **une seule fois** la clé API de la boutique de test : elle n'est stockée qu'en
sha256. Pour en émettre une nouvelle (l'ancienne cesse de fonctionner) :
`pnpm --filter @guillxume/studio issue-key contoso-equipment`.

### Se connecter, la première fois

L'interface demande une session : `http://localhost:3000/` renvoie sur `/connexion`. Une instance
neuve n'a aucun compte, et personne ne peut donc inviter — une commande casse cette boucle :

```sh
pnpm --filter @guillxume/studio admin vous@exemple.fr "Votre Nom"
```

Elle imprime un lien d'activation à ouvrir dans le navigateur ; on y choisit un mot de passe (douze
caractères minimum) et on entre. Ensuite, `/admin/comptes` pour les autres, `/admin/boutiques` pour
les clés API. Voir [docs/comptes-et-roles.md](comptes-et-roles.md).

En local, `.env` porte `COOKIE_SECURE=false` : sans ça, le navigateur accepte le cookie de session
servi en HTTP et ne le renvoie jamais — on boucle sur `/connexion` sans le moindre message.

Les invitations sont attrapées par Mailpit : <http://localhost:8025>. Le lien s'affiche aussi dans
`/admin/comptes`.

> **`/api/v1/*` n'est pas concerné.** Ces routes portent leur propre clé de boutique et ne voient
> jamais de session : `curl`, `fixtures/render.sh` et les collecteurs marchent sans compte.

## Le tour complet, en cinq minutes

1. **Ouvrir l'éditeur** — <http://localhost:3000/editor/shared/fiche-produit-simple>.
   Le canvas montre une page à l'échelle, alimentée par un jeu de données d'exemple : bandes
   réservées aux bandeaux, rubans de saut de page numérotés, et une barre de mesure qui annonce le
   nombre de pages et les blocs coupés par un saut. Déplacer un bloc, changer une couleur.

   > Basculer le **profil** sur « Dense (cas hostile) » : c'est le moment de vérité. Un template qui
   > tient en une page sur le profil typique passe souvent à deux sur celui-là, et c'est ce qui
   > arrivera pour une partie du catalogue.

   > Le mode **« Tokens »** affiche les tokens et rend les textes éditables directement sur le
   > canvas ; le mode **« Données d'exemple »** montre la place réelle. Les deux ne peuvent pas
   > coexister — voir le README.

2. **Aperçu PDF exact** — bouton en haut à droite. Rendu par le même moteur que la production, à côté
   du canvas, avec le nombre de pages. Il se rafraîchit tout seul après chaque modification.

   > **« Contrôler les profils »** rend le template sur chacun des jeux de données et remonte
   > pages, avertissements et durée. À lancer avant toute publication : c'est le seul contrôle qui
   > parle du catalogue entier plutôt que d'un produit.

3. **Publier** — le bouton enregistre puis publie. Avant publication, l'API continue de servir
   l'ancienne version : c'est visible dans la colonne « Brouillon » de la liste des templates.

4. **Rendre par l'API** — le `curl` ci-dessus, ou `scripts/demo-samples.ts`. La réponse porte la
   version du template servie (`x-template-version`) et ses avertissements éventuels.

5. **Suivre** — la fiche rendue apparaît dans la [consultation](http://localhost:3000/consultation),
   classée par catégorie, et le rendu dans le [journal](http://localhost:3000/journal).

## Vérifier sans navigateur

```sh
cd apps/studio

# Lint, types et tests unitaires — ce que fait l'integration continue
pnpm check

# HTML envoye a Chromium, plutot que le PDF — l'outil de diagnostic d'un bloc vide
curl -s -X POST "http://localhost:3000/api/editor/preview?format=html" \
  -H 'content-type: application/json' -d @docs/exemple-template-02.json | less

# Pages, avertissements, poids et duree, sans transferer le document. Le profil
# choisit le jeu de donnees : "typique", "dense", "minimal", "sans-medias".
curl -s -X POST "http://localhost:3000/api/editor/preview?format=report" \
  -H 'content-type: application/json' \
  -d "$(jq '. + {profile:"dense"}' docs/exemple-template-02.json)"
```

Les routes `/api/editor/*` sont derrière la session : ces deux appels demandent le cookie d'une
connexion (`-b "studio_session=…"`, copié depuis le navigateur), sinon ils répondent 401.

**Voir le canvas de l'éditeur sans navigateur.** La capture est produite par le Chromium de
Gotenberg, et inclut le résultat de la barre de mesure exécutée dedans.

```sh
pnpm probe-canvas                                    # /tmp/datasheet-canvas/*.png
PROFILE=dense pnpm probe-canvas                      # le cas qui deborde
ZONE=header TEMPLATE=docs/exemple-bandeaux.json pnpm probe-canvas
```

## Si quelque chose ne marche pas

**Un client dans un conteneur dit « Studio injoignable ».** Depuis un conteneur, `localhost` désigne
le conteneur, pas votre poste. Pointer le client sur `http://host.docker.internal:3000`.

**Un picto n'apparaît pas dans le PDF.** Un picto **blanc à fond transparent** se rend correctement
et reste invisible sur une page blanche. Lui donner un fond coloré (propriété du bloc `BadgeRow`, ou
un `Panel` autour).

**Un bloc reste vide.** L'éditeur le dit lui-même : le bloc affiche un placeholder « absent du PDF »
qui nomme la cause (aucune donnée dans ce profil, réglage `Ignorer les N premières images` trop
élevé, aucune correspondance badge / picto…). `?format=html` reste utile pour voir le HTML réellement
envoyé à Chromium.

**Le bandeau d'en-tête est tronqué.** La marge haute réglée sur la racine du template réserve la
place du bandeau. Trop faible, Chromium le coupe sans avertissement — mais l'onglet « En-tête »
hachure ce qui dépasse et la barre de mesure annonce le nombre de millimètres masqués.

**Les réglages de géométrie n'ont aucun effet.** Ils sont lus sur l'arbre du **corps**, y compris pour
les bandeaux : ils ne sont donc proposés que dans l'onglet « Corps ».

**Le PDF ne reflète pas mes modifications.** Vérifier que le brouillon a été **publié** : l'API ne
sert que la version publiée.

**L'interface du Studio s'affiche sans aucun style.** Un serveur standalone lancé sans que
`.next/static` et `public/` y soient copiés : l'application répond 200 partout, et 404 sur chaque
feuille de style. Utiliser `pnpm dev` sur le poste ; l'image Docker fait la copie.

**L'API répond `429`, ou l'aperçu de l'éditeur « moteur saturé ».** Le plafond de rendus simultanés
est atteint — probablement une génération en masse en cours. Le
[journal](http://localhost:3000/journal) compte les requêtes refusées et l'attente en file. Soit
relever `MAX_CONCURRENT_RENDERS`, soit réduire la concurrence côté client.

**`docker compose up` : « could not find an available, non-overlapping IPv4 address pool ».** Docker
n'a plus de plage libre pour les deux réseaux du projet. Supprimer des réseaux inutilisés de vos
autres projets, ou déclarer un sous-réseau explicite (`ipam`) sur `rendu` dans `docker-compose.yml`.

## Remettre à zéro

```sh
# La demonstration : base, comptes, templates et journaux
docker compose down -v && docker compose up --build

# Le poste de developpement : apres un drop manuel de la base
pnpm --filter @guillxume/studio migrate   # recree le schema
pnpm --filter @guillxume/studio seed      # boutique de test + template 01
pnpm --filter @guillxume/studio admin vous@exemple.fr "Votre Nom"   # rouvre un acces a l'interface
```

> Un `drop` de la base efface aussi les comptes. `pnpm admin` est ce qui rend la main : sans lui,
> l'interface reste inaccessible alors que l'API répond normalement.
