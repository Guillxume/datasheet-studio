# Travailler sur le Studio

Ce document dit comment on contribue à ce dépôt : ce qui doit passer avant de proposer une
modification, comment on nomme les choses, et les trois disciplines qui ne se négocient pas.

Pour l'installation, voir [docs/tester-en-local.md](docs/tester-en-local.md). Pour essayer le
Studio sans rien installer d'autre que Docker, le `docker compose up` de la racine du dépôt.

---

## 1. La commande à connaître

```sh
pnpm check        # lint + types + tests unitaires — exactement ce que fait l'intégration continue
```

Elle tourne en quelques secondes et **n'a besoin d'aucune infrastructure**. Si elle passe chez
vous, l'intégration continue passera sur GitHub.

Deux contrôles supplémentaires demandent un Postgres :

```sh
pnpm migrate               # applique les migrations en attente
pnpm test:integration      # ⚠ TRONQUE les tables de la base pointée par DATABASE_URL
```

`test:integration` vit dans `tests/` et non dans `src/lib/` pour une raison précise : **`pnpm test`
ne doit dépendre d'aucune infrastructure**. Ne jamais le lancer contre une base qui contient
quelque chose d'utile.

## 2. Branches et fusion

- On part de `main`, on y revient par **pull request**. Pas de poussée directe sur `main`.
- Un nom de branche qui dit ce qu'on fait : `comptes-et-roles`, `fix-apercu-brouillon`.
- La pull request ne fusionne pas tant que l'intégration continue n'est pas au vert.
- Les messages de commit sont en français, à l'impératif, et disent **le pourquoi** quand il n'est
  pas évident : `sépare la politique de mot de passe du module crypto (bundle client)`.

## 3. Les trois disciplines

### 3.1 Une migration ne se modifie jamais après avoir été appliquée

Les fichiers de `db/migrations/` sont numérotés et **immuables**. `schema_migrations` retient ceux
qui sont passés : corriger un fichier déjà appliqué ne le rejoue nulle part, et produit deux
schémas différents selon la date d'installation.

Une correction est **une nouvelle migration**.

L'intégration continue applique les migrations sur une base vide **puis les rejoue** pour vérifier
que le second passage ne fait rien : c'est ce qui garantit qu'un déploiement relancé après une
coupure réseau ne casse pas.

### 3.2 Le contrat public ne se casse pas

`src/lib/payload.ts` est ce que le module PrestaShop, les collecteurs et toute intégration tierce
envoient. **Ajouter un champ facultatif, oui. Renommer ou rendre obligatoire, non** — cela casse
des templates déjà publiés et des modules déjà déployés.

Même règle pour la matrice de `src/lib/roles.ts` : ajouter une capacité est sans risque, en retirer
une ouvre un accès quelque part.

### 3.3 Masquer un bouton ne protège rien

Toute route qui lit ou mute quelque chose appelle `requireApi(<capacité>)`
([`src/lib/guard.ts`](src/lib/guard.ts)) ; toute page appelle `requirePage(<capacité>)`. Le portail
[`src/proxy.ts`](src/proxy.ts) ne vérifie que la **présence** d'un cookie : il ne remplace aucune
de ces deux gardes.

Une route ajoutée sans garde est publique. Il n'y a pas de vérification automatique de cette
règle — c'est la première chose à regarder en relecture.

## 4. Ce qu'on écrit dans le code

Le dépôt a une convention forte, et elle explique la densité des commentaires : **on documente le
pourquoi, pas le quoi**. Un commentaire qui paraphrase la ligne suivante est du bruit ; un
commentaire qui dit quel défaut réel a produit cette ligne évite qu'on le réintroduise.

Trois exemples déjà dans le dépôt, à prendre comme modèle :

| Fichier | Ce que le commentaire sauve |
|---|---|
| [`src/lib/env.ts`](src/lib/env.ts) | pourquoi il n'y a **pas** de `SELF_URL` |
| [`eslint-rules/no-client-value-in-server.mjs`](eslint-rules/no-client-value-in-server.mjs) | le défaut livré en production que la règle attrape |
| [`src/lib/passwordPolicy.ts`](src/lib/passwordPolicy.ts) | pourquoi ce module est séparé de `password.ts` |

Le code et les commentaires sont **en français sans accents** ; la documentation (`docs/`, `*.md`)
est **en français accentué**. C'est ce que fait déjà tout le dépôt.

### L'interface vient du design system partagé

Toute l'interface du Studio vient du package
[`@guillxume/ui`](../../packages/ui), le design system du dépôt : composants (`Button`, `Table`, `Card`, `Select`, `Dialog`…), cadre
(`AppSidebar`, `AppHeader`, `UserMenu`) et thème `datasheet-studio` (papier, encre, terre cuite,
angles droits). Le Studio n'a plus de feuille de style d'application :

- un écran se compose avec les composants du package et des utilitaires Tailwind sur les jetons du
  thème (`text-muted-foreground`, `border-border`, `bg-primary`…) — jamais une couleur en dur ni
  une nouvelle classe CSS ;
- une icône passe toujours par `<Icon icon={…} />` (icônes de `lucide-react`) ;
- les libellés des composants sont en anglais par défaut : passer `labels={{…}}` en français ;
- un composant qui manque ou qui se comporte mal se corrige **dans le package**, pour que toutes
  les applications qui l'utilisent en profitent.

**Une exception : la feuille A4 de l'éditeur.** Elle est rendue dans le document (Puck sans
iframe) et doit rester identique au PDF. `globals.css` lui retire le socle Tailwind
(`all: revert-layer`) et [`editor.css`](src/app/editor/[scope]/[slug]/editor.css) garde ses règles
`.ds-*` et ses jetons fixes `--sheet-*`, verrouillés par `src/lib/editorTheme.test.ts`.

Le package est un paquet du workspace pnpm (`packages/ui`), consommé **compilé** : après une
modification, `pnpm build:ui` à la racine du dépôt (ou `pnpm --filter @guillxume/ui build:watch`
pendant qu'on travaille) suffit pour que le Studio la voie.

## 5. Ce que l'on teste, et ce que l'on ne teste pas

Ce dépôt ne cherche pas un taux de couverture. Il teste **ce qui casse en silence** :

- les fonctions pures dont l'erreur ne se voit pas à l'écran — pagination, assainissement HTML,
  correspondances, matrice de rôles, empreintes de mots de passe ;
- ce qui est porté par du SQL — masquage bibliothèque/boutique, index partiels, comportement de
  `NULL` — et cela **contre une vraie base** (`tests/`), parce qu'une doublure reproduirait notre
  lecture du SQL, pas le SQL ;
- les règles ESLint maison, qui ont leurs propres cas valides et invalides.

Ne se testent pas utilement : la mise en page d'un courriel, le rendu d'un composant, la
formulation d'un message.

## 6. Les fichiers longs, et ce qu'on en fait

Trois fichiers dépassent mille lignes. **Deux y restent, par décision écrite** — la raison est en
tête de chacun, pour qu'elle ne se rediscute pas par réflexe :

| Fichier | Lignes | Décision |
|---|---|---|
| [`src/blocks/registry.tsx`](src/blocks/registry.tsx) | ~2 360 | **On ne découpe pas.** 640 lignes de types, puis une énumération de 20 blocs. Un fichier long *parce qu'il énumère* n'est pas une dette |
| [`src/app/editor/[scope]/[slug]/EditorClient.tsx`](src/app/editor/[scope]/[slug]/EditorClient.tsx) | ~1 020 | **On ne réécrit pas.** Le compte de lignes est un indice, pas un défaut. Le bon déclencheur est le prochain bug |
| [`src/app/(studio)/import/ImportWizard.tsx`](src/app/(studio)/import/ImportWizard.tsx) | ~1 210 | **Allégé de ce qui devait l'être** : la logique testable est sortie dans `src/lib/`, le reste est de l'interface |

La règle qui s'en dégage, et qui vaut au-delà de ces trois cas : **on n'extrait pas pour raccourcir,
on extrait ce qui doit être testé.** Le critère n'est pas le nombre de lignes, c'est *est-ce que ce
code peut se tromper sans que rien ne le signale ?*

Le cas d'école est `shopSeed` / `shopFieldsFrom` : deux conversions inverses qui énuméraient chacune
les mêmes neuf champs de leur côté. Un champ ajouté d'un côté et oublié de l'autre disparaissait de
toutes les fiches d'un lot, sans erreur ni avertissement. Elles vivent maintenant dans
[`src/lib/shopFields.ts`](src/lib/shopFields.ts), **dérivées d'une liste unique** — le défaut n'est
plus seulement testé, il est devenu impossible.

## 7. Ajouter une dépendance

Le dépôt en compte neuf en production, et c'est un choix (voir l'en-tête de
[`src/lib/db.ts`](src/lib/db.ts) : « postgres.js plutôt qu'un ORM »). Avant d'en ajouter une :

1. Est-ce que `node:` la fournit ? `scrypt` a remplacé bcrypt pour cette seule raison — aucune
   compilation native dans une image Alpine.
2. Est-ce qu'elle entre dans le paquet **navigateur** ? Si oui, vérifier ce qu'elle y ajoute.
3. Est-ce qu'elle survit à `docker build` sur `node:22-alpine` ?

## 8. Avant d'ouvrir la pull request

- [ ] `pnpm check` passe
- [ ] les migrations ajoutées sont **nouvelles**, jamais des modifications d'existantes
- [ ] toute route ajoutée porte une garde (`requireApi` / `requirePage`) ou justifie son absence en
      commentaire
- [ ] les variables d'environnement ajoutées sont dans `.env.dist` **et**, si les conteneurs en ont besoin, dans le `docker-compose.yml` racine
- [ ] la documentation touchée par le changement est à jour
