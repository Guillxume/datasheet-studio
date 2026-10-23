# Composer les templates de fiche technique

Guide de reprise des cinq templates de `acmepdfgenerator`. **On ne cherche pas la fidélité au
pixel** : la reprise sert à refaire la mise en page proprement, pas à répliquer les contournements
que mPDF imposait.

## Ce qu'il faut abandonner des anciens templates

Ces choses n'existaient que parce que mPDF n'avait ni flexbox ni grid. Les reproduire serait une
régression.

| Dans les anciens `.tpl` | Ce qu'on fait maintenant |
|---|---|
| `<table>` imbriquées pour disposer les colonnes | bloc `Columns` (2 ou 3 slots, proportions en `fr`) |
| largeurs en `mm` codées en dur (`width: 100mm`) | proportions relatives, la page s'adapte |
| `<td>` avec `background-color` pour un encadré | bloc `Panel` |
| sauts de page estimés en comptant les caractères | rien à faire, Chromium pagine réellement |
| `file://` devant chaque image | rien à faire, les images sont jointes ou inlinées |
| `{if $garantie_numeric == '1'}…{elseif '3'}` en cascade | règles de badges, une par valeur |
| un dossier de pictos par template et par langue | une bibliothèque d'images commune |

## Correspondance des variables

Les anciennes variables Smarty deviennent des tokens. Un token seul dans un champ renvoie la valeur
typée (un tableau alimente un bloc répété) ; dans une phrase, il est interpolé.

| Ancien | Nouveau |
|---|---|
| `{$product->name}` | `{{product.name}}` |
| `{$product_reference}` | `{{product.sku}}` |
| `{$product->description}` | `{{product.description_html}}` (bloc `RichText`) |
| `{$product->description_short}` | `{{product.description_short}}` |
| `{$product_characteristics}` | `{{features}}` (bloc `FeatureTable`) |
| `{$product_images}` | `{{images}}` (bloc `ImageGallery`) |
| `{$product_images[0]}` | `ImageGallery` avec « ignorer 0 » et « maximum 1 », ou `{{images.0.src}}` |
| *(aucun équivalent Smarty)* | `{{images.last.src}}` — la **dernière** image, quel qu'en soit le nombre |
| *(aucun équivalent Smarty)* | `{{images.last-1.src}}` — l'**avant-dernière** image |
| `{$schema_url}` | `{{schema_image.src}}` (bloc `SchemaImage`) |
| `{$qr_code}` | bloc `QrCode`, contenu `{{product.url}}` — plus aucune image à fournir |
| `{$logo_url}` | `{{shop.logo}}` |
| `{$primary_color}` / `{$secondary_color}` | `var(--color-primary)` / `var(--color-secondary)` |
| `{$company_info['address']}` etc. | `{{shop.company.address}}`, `.phone`, `.email` |
| `{$carsat}`, `{$tuv}`, `{$garantie}`… | `{{badges}}` + règles de badges (bloc `BadgeRow`) |

**`last` plutôt qu'un indice fixe.** `{{images.0.src}}` sait dire « la première ». Pour « la
dernière », aucun indice fixe ne vaut : un produit a 4 images, le suivant en a 6. Le segment
`last` désigne le dernier élément de n'importe quelle liste — `{{images.last.src}}`,
`{{features.last.value}}`. `last-1` désigne l'avant-dernier, `last-2` celui d'avant, etc. — de
quoi viser les deux photos de mise en situation, toujours placées en fin de liste. Un produit qui
n'a qu'une image ne rend rien pour `last-1`. Sur un objet, `last` et `last-1` restent des clés
ordinaires : un champ `custom.last` continue de se lire normalement.

Attention à ce que `last` désigne vraiment : **la dernière image reçue**, pas la dernière du
produit. La boutique tronque son envoi au réglage « Images produit maximum » du connecteur — avec
un plafond à 6, un produit qui porte 10 images fait de la 6e sa dernière. Relever le plafond si des
produits dépassent.

La liste complète est aussi accessible **dans l'éditeur** : bouton « Variables disponibles », avec
copie au clic. Les tokens de liste y sont marqués — ils alimentent un bloc répété et ne
s'interpolent pas dans une phrase. Côté back-office PrestaShop, la même liste est servie par
`GET /api/v1/schema`.

## Composants réutilisables

Un **composant** est un fragment de template — un pied de page, un bandeau de coordonnées — composé
une fois et placé dans plusieurs templates avec le bloc **« Composant »** (catégorie *Composants* de
la palette). Il se crée depuis l'accueil, section *Composants*, et s'édite comme un template : son
éditeur n'a qu'un onglet, son contenu.

**Appliquer un composant à plusieurs templates d'un coup** : bouton « Appliquer… » de sa ligne, à
l'accueil. On choisit la zone (en-tête ou pied de page), puis on coche les templates ; la page montre
ce que chaque zone contient aujourd'hui. Chaque zone cochée est **remplacée** par ce seul composant,
en brouillon. La case « Publier aussitôt » est décochée par défaut. Même cochée, elle ne publie pas
un template qui avait déjà un brouillon en cours (il serait livré avec), ni un template jamais publié :
le résultat le dit, template par template. Un composant de boutique ne s'applique qu'aux templates de
cette boutique.

- **Publier un composant met à jour tous les templates qui l'utilisent.** L'éditeur liste ces
  templates avant de publier. Chacun reçoit une nouvelle version publiée, notée « Republication
  automatique » : c'est ce changement de version qui fait régénérer leurs fiches aux boutiques, qui
  ne regénèrent qu'à ce signal. Un brouillon en cours sur ces templates est préservé.
- **Portée** : un composant de boutique remplace, pour cette boutique, le composant de bibliothèque de
  même slug. Un template commun peut donc citer `pied-de-page` et recevoir le pied de chaque site.
  Un template de bibliothèque ne propose que les composants de bibliothèque.
- **Seule la version publiée** d'un composant sort sur les fiches. Un composant jamais publié est
  signalé dans le canvas et n'apparaît pas au rendu.
- **Le style vient du template** : un composant n'a pas de feuille de style propre. Les jetons qu'il
  utilise (`var(--…)`) doivent exister dans la feuille de chaque template qui le place.
- **Pas de composant dans un composant** (le bloc n'est pas proposé dans l'éditeur d'un composant).
- **Supprimer un composant** est refusé tant qu'un template le cite, version publiée ou brouillon :
  la réponse donne la liste à corriger.

### Grouper des blocs, et en faire un composant sans quitter le template

La barre d'action qui apparaît au-dessus du bloc sélectionné porte trois actions de plus :

- **Grouper avec le bloc suivant** réunit le bloc et son voisin du dessous dans un **Groupe**. Sur
  un Groupe, la même action (« Ajouter le bloc suivant au groupe ») y fait entrer le voisin suivant :
  on groupe trois blocs en deux clics. Un Groupe se déplace, se duplique et se supprime comme un seul
  bloc. À l'impression, il n'ajoute **rien** : ni fond, ni bordure, ni marge. Sans espacement
  saisi, il reprend celui de la zone où il est posé, donc grouper ne déplace rien.
- **Dégrouper** rend au Groupe ses blocs, à sa place et dans leur ordre.
- **Créer un composant à partir de ce bloc** transforme la composition qu'on vient de mettre au
  point en composant, sans la refaire. Le composant reçoit le contenu d'un Groupe, ou le bloc
  lui-même s'il est seul. Il est créé dans la portée du template, puis **publié aussitôt** : sans
  publication, il ne serait pas déplié. Par défaut, le bloc est **remplacé** dans le template par
  le bloc « Composant » qui le cite. Rien ne change sur les fiches tant que le template n'est pas
  lui-même publié.

## Les pièges, tous constatés en pratique

**1. Les pictos de certification sont des PNG blancs à fond transparent.** CE, TÜV, Bureau Veritas,
certificat, manuel : sur une page blanche ils se rendent correctement et sont **invisibles**. Il
faut un fond coloré — propriété « couleur de fond » de `BadgeRow`, ou un `Panel` autour. C'est
exactement ce que faisaient les anciens templates avec leurs `<td>` colorés.

**0. Les zones répétées se composent librement.** `PageHeader` et `PageFooter` ne sont que des
raccourcis. Pour placer le logo, les coordonnées, un QR ou des pictos où l'on veut, utiliser
`Panel` (avec une hauteur, et un fond couleur **ou image**), puis :
- `Columns` pour des éléments côte à côte ;
- **`Positioned`** pour poser chaque élément où l'on veut par-dessus le fond — c'est la forme qui
  convient aux anciens en-têtes, où logo, titre et QR ne sont pas alignés en rangée.

Voir `docs/exemple-bandeaux.json`. C'est la réponse aux cas des anciens templates, où le QR
est en en-tête sur l'un, en pied sur l'autre, absent sur un troisième.

**2. Les zones répétées (en-tête, pied de page) sont contraintes.** Chromium les rend dans un
contexte séparé. Le Studio neutralise déjà les pièges connus, mais deux règles restent visibles pour
l'intégrateur :
- les **images y sont inlinées** automatiquement — y compris les **URLs distantes** (un logo sur un
  CDN, un fond sur un autre domaine), que Chromium refuse de charger dans ces zones ;
- la **numérotation n'y fonctionne que là** — le bloc `PageNumber` (ou `PageFooter`) n'a aucun effet
  dans le corps du document.

**3. La numérotation est un bloc autonome.** `PageNumber` s'utilise n'importe où dans une zone
répétée, ce qui permet de composer un pied de page libre (coordonnées, pictos, mentions) sans
dépendre de la mise en page fixe de `PageFooter`.

**4. La géométrie de page se règle sur la racine**, pas dans un réglage séparé : largeur, hauteur,
et surtout **marge haute et marge basse, qui réservent la place des bandeaux répétés**. Une marge
trop faible tronque le bandeau sans aucun avertissement. Le template 05 de l'ancien module utilisait
une marge haute de 35 mm là où les autres étaient à 30 : c'est ce réglage-là.

**5. Les couleurs viennent de la boutique, jamais du template.** Utiliser
`var(--color-primary)` / `var(--color-secondary)` plutôt qu'une valeur en dur : c'est ce qui permet
à un template de bibliothèque de servir plusieurs sites avec leur identité propre. Un template ne
devrait contenir une couleur littérale que si elle est intentionnellement la même partout (le liseré
jaune du template 04, par exemple).

**6. Un tableau de caractéristiques dans une demi-colonne coûte cher.** Mesuré sur un produit de 21
caractéristiques : **186 mm** de haut dans une colonne de 90 mm, **132 mm** en pleine largeur,
**102 mm** en pleine largeur sur deux paires de colonnes — pour 243 mm de page utile. C'est la
**largeur** qui décide, bien avant le regroupement des doublons (−7 mm) ou la densité des lignes.
Un schéma coté à côté du tableau se paie donc en pagination : le mettre au-dessus ou en dessous,
plutôt qu'à côté, est souvent ce qui ramène la fiche sur une seule page.

**7. L'espacement appartient au conteneur.** « Espacement entre les blocs » sur la racine règle
toute la fiche ; `Panel` et `Columns` ont le leur pour un ajustement local ; le bloc `Espace` accepte
une **hauteur négative** pour resserrer deux blocs précis. Aucun bloc ne porte plus de marge propre.

**8. `Image` occupe toute la largeur de son conteneur par défaut.** Pour un logo, réduire la largeur
(en % ou en mm) ; pour un visuel produit, la laisser telle quelle et borner « Hauteur maximale ».

**9. Un fond en dur dans un `Panel` de la même couleur est invisible.** C'était le cas du zébrage et
de l'en-tête du `FeatureTable`, tous deux peints en `var(--color-primary)` : dans un panneau de la
couleur primaire, bleu sur bleu. Leurs couleurs se dérivent désormais de celle du **texte** (14 %
pour une ligne alternée, 30 % pour l'en-tête), ce qui fonctionne aussi bien sur un panneau coloré que
sur une page blanche. Les deux restent réglables si un template demande autre chose.

En mode deux colonnes, la **gouttière sans fond** et le **filet** séparent les deux moitiés, et
« Part du libellé » évite qu'un libellé long se replie sur trois lignes dans une colonne étroite.

**10. Colorer un tableau ne se fait plus avec un `Panel` autour.** `FeatureTable` porte son propre
fond, sa couleur de texte, sa marge intérieure et son arrondi. Le fond d'un `Panel` s'étend à tout ce
qu'il contient : un schéma coté posé à côté du tableau se retrouvait sur le même aplat. Montage
correct : `Columns` → schéma d'un côté, tableau coloré de l'autre, **sans** panneau autour.

Attention en migrant un template existant : le zébrage se dérive de la couleur du **texte**. Retirer
le fond d'un `Panel` en y laissant `color: #ffffff` donne du blanc sur blanc. Les deux couleurs
voyagent ensemble — les porter toutes les deux sur le tableau.

## Les cinq templates

Répartition reprise du sélecteur de l'ancien module.

### 01 — La fiche standard
*Déjà monté, en bibliothèque sous `fiche-technique-01`.* Titre centré, visuel principal à gauche
face à l'accroche et aux vignettes, puis schéma coté face au tableau de caractéristiques.

### 02 — Trois colonnes, la plus dense
Le plus dense. Titre souligné, picto CARSAT, puis **trois colonnes** : vignettes encadrées / visuel
principal / colonne latérale colorée contenant « produit en ligne » + QR + pictos garantie,
certificat et manuel. En bas, tableau de caractéristiques face au schéma.

Composition : `Columns` avec un ratio à trois valeurs (`1fr 1.5fr 0.75fr`), et un `Panel` coloré
dans le troisième slot contenant `Text` + `QrCode` (modules en blanc) + deux `BadgeRow`.

> Ce template a servi de démonstrateur pour vérifier que le registry suffisait. Sa reproduction est
> reproductible depuis `docs/` si besoin d'un point de départ.

### 03 — Deux colonnes pleine hauteur
Deux colonnes de pleine hauteur : à gauche une barre « Ref: » colorée, le visuel principal et les
vignettes ; à droite la description longue sur toute la hauteur. Pied de page chargé, avec pictos
garantie / CE / Bureau Veritas.

Composition : `Columns` 50/50 ; à gauche `Panel` (barre de référence) + `ImageGallery` ; à droite
`Heading` + `RichText`. Pied de page : `Panel` + `BadgeRow` + `PageNumber`.

### 04 — Visuels encadrés
Rangée de visuels centrés **encadrés d'un liseré jaune épais** (`#ffba00`), accroche, puis tableau
de caractéristiques précédé d'un en-tête coloré pleine largeur portant le nom du produit.

Composition : `ImageGallery` avec cadre activé, couleur `#ffba00` et épaisseur ~4 pt ; puis `Panel`
coloré contenant un `Heading`, suivi de `FeatureTable`. C'est le seul template où une couleur
littérale est justifiée.

### 05 — Coordonnées et marge haute
Proche du 03, avec en plus un QR et un bloc de coordonnées à icônes sur fond secondaire, et une
**marge haute de 35 mm**. La description longue n'est volontairement pas rendue sur ce template
(l'ancien code excluait explicitement le 05).

Composition : comme le 03, plus `QrCode` et `KeyValueGrid` dans un `Panel`. Ne pas placer de
`RichText` sur la description longue si l'on veut conserver ce comportement.

## Assets à téléverser

Depuis `/assets`, portée « bibliothèque commune » (ils sont identiques d'un site à l'autre).
Source : `modules/acmepdfgenerator/assets/img/icons/`.

| Clé suggérée | Fichier d'origine |
|---|---|
| `ce` | `conformite_europeenne.png` |
| `tuv` | `tuv.png` |
| `bureau-veritas` | `bureau_veritas.png` |
| `carsat` | `carsat.png` |
| `garantie-1-an`, `garantie-3-ans`, `garantie-5-ans` | `0X/fr-garantie-*.png` |
| `certificat`, `manuel` | `0X/fr-certificat.png`, `0X/fr-manuel.png` |
| `icone-adresse`, `icone-telephone`, `icone-courriel` | `address_white.png`, `phone_white.png`, `email_white.png` |

Les variantes par langue (`es-*`, `pt-*`) ne sont nécessaires que si le picto contient du texte
traduit. Dans ce cas, téléverser sous la portée du site concerné plutôt qu'en bibliothèque : un
template propre au site masquera celui de la bibliothèque.

Les clés doivent correspondre aux règles de badges configurées dans le module
(`ACMEDATASHEET_BADGE_RULES`), qui produisent par défaut `ce`, `tuv`, `bureau-veritas`, `carsat`
et `garantie:<valeur slugifiée>`.

## Basculer une boutique

**L'ordre est contraignant.** La correspondance ancienne URL → nouvelle s'appuie sur une colonne
alimentée à chaque rendu : tant que la génération en masse n'a pas tourné, les anciennes URLs
répondent 410 au lieu de 301.

1. Émettre une clé API : `pnpm issue-key <slug-boutique>`.
2. Installer `acmedatasheet`, renseigner URL du Studio, clé, template, couleurs.
3. Vérifier le diagnostic de la page de configuration (dossier accessible en écriture, cURL,
   connexion au Studio).
4. Générer une fiche depuis l'onglet d'un produit, la contrôler.
5. **Lancer la génération en masse** et attendre la fin (moins d'une minute pour ~700 produits).
6. Contrôler qu'une ancienne URL renvoie bien un 301.
7. Alors seulement, désinstaller `acmepdfgenerator`.
8. Planifier le cron de préchauffage (URL affichée dans la configuration).

Tant que l'ancien module reste installé, ses fichiers PDF existent et Apache les sert directement :
la redirection ne prend le relais qu'après sa suppression. **La coexistence est donc sans danger**,
et l'étape 7 est réversible en réinstallant l'ancien module.
