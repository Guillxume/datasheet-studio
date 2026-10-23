# Importer un catalogue depuis le Studio

Un fichier CSV ou JSON, une correspondance réglée à l'écran, un template — et un ZIP de fiches en
sortie. La page vit sur **<http://localhost:3001/import>** (bouton « Importer un catalogue » sur
l'accueil).

Elle existe pour le lot qu'on regarde passer : un export qu'on vient de recevoir, quelques dizaines
à quelques centaines de fiches, un mapping à essayer. Elle **ne remplace pas les collecteurs** —
voir [« Ce qu'elle ne fait pas »](#ce-quelle-ne-fait-pas) à la fin.

## Les quatre étapes

### 1. Le fichier

Le fichier est lu **dans le navigateur** : rien n'est téléversé tant que la génération n'est pas
lancée. Le séparateur d'un CSV se détecte tout seul (`;`, `,`, tabulation, `|`), le BOM d'Excel est
retiré, les champs cités gardent leurs virgules et leurs sauts de ligne — c'est le lecteur des
collecteurs, [`src/lib/csv.ts`](../src/lib/csv.ts), pas un second.

Un JSON peut être un tableau, ou l'envelopper : `{ "items": [...] }`, `{ "data": { "products":
[...] } }`. Le chemin du tableau est deviné puis affiché, et reste modifiable — se tromper sans
recours serait pire que ne rien deviner.

Les colonnes d'un JSON sont des **chemins**, découverts sur les cinquante premiers enregistrements
(un catalogue réel a des champs qui n'apparaissent qu'au dixième produit). Un tableau y apparaît
avec `[]` :

```
id                 marque.nom          medias[].url        medias[].legende        tags[]
```

### 2. La correspondance

Une ligne par colonne, un exemple lu dans le fichier, et le champ de la fiche à alimenter.

Les colonnes **déjà nommées comme un champ du contrat** (`product.name`, `images.0.src`,
`feature:Capacité@Q`) sont mappées d'office. Rien d'autre n'est deviné : « Description » est-elle
`description_html` ou `description_short` ? La réponse change le rendu, et une table d'alias se
tromperait en silence.

Une colonne laissée sur « Ignorer » **n'est pas envoyée**. Ce n'est pas de l'hygiène : `zod`
écarterait les clés inconnues de toute façon, mais elles feraient changer la clé de fraîcheur des
collecteurs — donc régénérer le catalogue — quand une colonne sans rapport bouge.

**Le fichier de correspondance est celui des collecteurs**, à l'identique :

```json
{
  "Prix HT": "product.price.amount",
  "Resume": "product.description_short | html2text",
  "Image URLs (x,y,z)": "images"
}
```

« Exporter la correspondance » produit ce fichier, « Charger une correspondance » le relit, et
`pnpm collect:csv catalogue.csv --mapping ce-fichier.json` fait exactement la même chose en
ligne de commande. Un réglage fait à l'écran se met donc en production sans être refait.

Quelques cibles méritent un mot :

| Cible | Ce qu'elle fait |
|---|---|
| `ref` | la référence : nom du PDF dans l'archive, et clé du rapport. À défaut : `product.sku`, puis `product.id`, puis le numéro de ligne — qui est signalé, parce qu'il n'est pas stable |
| `template` | impose un template **à cette ligne**, par-dessus celui choisi à l'étape 3 |
| `images` | une colonne portant plusieurs images, séparées par le séparateur de listes |
| `images[].src` | une valeur par élément, pour un JSON. Apparié **par indice** avec `images[].legend` |
| `features` | la colonne PrestaShop `Nom:Valeur:Position`, virgules non échappées comprises |
| `feature:<nom>@<lettre>` | une colonne = une caractéristique, avec sa lettre de renvoi au schéma coté |
| `product.price.amount` | normalisé : `489,00`, `1 234,56 €` et `1.234,56` donnent tous `1234.56` |

**Le séparateur de listes est un piège connu.** Il vaut `|` par défaut et découpe `images`,
`badges` et `product.category_path`. Un export PrestaShop utilise la **virgule** : le laisser à `|`
produit une seule image dont l'URL est toute la liste — le rendu réussit, la fiche sort sans
visuel, et seul le rapport le dit.

### 3. Le template et la boutique

La **boutique** décide de deux choses, exactement comme en production :

- les templates proposés — les siens et ceux de la bibliothèque commune ;
- les images que le rendu peut lire : un template ne voit que `/assets/shared/…` et
  `/assets/<sa boutique>/…`. Sans boutique, la bibliothèque commune seule.

La **version** est « publiée » par défaut. « Brouillon » rend avec la version en cours de
composition, non publiée : de quoi éprouver un template sur de vraies données avant de le publier.

L'**identité de la boutique** (nom, logo, couleurs, coordonnées) est commune à toutes les fiches du
lot. Une colonne mappée sur `shop.*` la remplace ligne par ligne — la source gagne. `shop.name` est
le seul champ que le contrat exige.

**Les images.** Une valeur qui est une URL `https` traverse telle quelle et sera chargée par
Chromium au rendu. Une valeur qui est un nom de fichier est cherchée dans le **dossier d'images**
choisi à l'écran — par chemin relatif (`photos/tpm.jpg`) ou par nom seul (`tpm.jpg`), casse
ignorée — et jointe à la requête. Une image introuvable coûte l'image, pas la fiche : elle est
signalée dans le rapport. Sans dossier choisi, un nom de fichier local ne désigne rien et est
signalé comme tel.

### 4. Générer

**Le filtre** est l'équivalent du `--where` des collecteurs : « ne garder que les lignes où
`Actif (0/1)` vaut `1` ». Sans lui, un export PrestaShop rend aussi les produits désactivés — 409
sur les 1042 de l'export qui a servi de référence.

**La plage** porte sur les lignes retenues par le filtre, et sert à découper un gros catalogue en
plusieurs archives.

Trois boutons avant de lancer :

- **Voir le premier payload** — ce que la première ligne produira, en entier. L'équivalent de
  `--print 1`.
- **Vérifier** — valide **toutes** les lignes avec le schéma du serveur, sans rien envoyer. Le même
  argument que côté collecteurs : la validation locale n'apporte pas un meilleur diagnostic (le
  Studio répond 422 avec le chemin du champ), elle apporte le **moment** — un mapping fautif échoue
  en une seconde, pas au 400e aller-retour.
- **Générer** — le lot part.

Pendant le lot : une progression réelle, le compte des avertissements et des échecs, et
**Annuler**, qui prend effet tout de suite. À la fin, « Rejouer les échecs » ne refait que ceux-là.

**Rendus simultanés** vaut 2. Le Studio n'accepte que `MAX_CONCURRENT_RENDERS` rendus à la fois (4)
et met le reste en file avant de répondre 429 ; monter plus haut ne va pas plus vite, et prive
l'aperçu de l'éditeur, qui partage le même sas. Un 429 est attendu puis rejoué, en suivant
`Retry-After` — comme le font les collecteurs.

## L'archive

```
fiches-fiche-technique-01-20260827-1455.zip
├── TPM-2500.pdf
├── GER-1000.pdf
├── 40-60.pdf            ← « 40/60 » : la barre est remplacée, pas retirée
├── TPM-2500-2.pdf       ← deux lignes portant la même référence
├── rapport.csv
└── mapping.json
```

`rapport.csv` porte une ligne par fiche : référence, ligne du fichier, statut, nom du PDF,
avertissements, erreur. Il s'ouvre dans un tableur (BOM inclus, sinon Excel abîme les accents) et
sert à retrouver ce qui est à reprendre.

`mapping.json` est la correspondance utilisée. L'archive suffit donc à refaire le même lot dans six
mois, ici ou en ligne de commande.

**Les rendus sont journalisés** comme ceux de la production : le
[journal](http://localhost:3001/journal) répond ensuite aux mêmes questions — ce qui a râlé, ce qui
a échoué, combien de temps — sans qu'on ait à garder le ZIP sous la main.

## Ce qu'elle ne fait pas

- **Pas de cache de fraîcheur.** Relancer le même lot refait tout. Les collecteurs, eux, ne
  renvoient que ce qui a changé — et savent qu'une republication de template périme une fiche.
- **Pas de reprise.** L'archive vit dans la mémoire de l'onglet ; le fermer perd le lot. Au-delà de
  quelques centaines de fiches, la page le dit et renvoie vers
  [`pnpm collect:csv`](../collectors/README.md), dont le journal survit à une coupure.
- **Un seul fichier de caractéristiques.** Le `--features` des collecteurs (le format long, joint
  sur la référence) n'a pas d'équivalent à l'écran. Les caractéristiques en colonnes
  (`feature:<nom>`) et la colonne PrestaShop, si.
- **Pas de règles de template.** Le `--rules` des collecteurs, qui choisit le template par
  catégorie ou par marque, se remplace ici par une colonne mappée sur `template`.

## En cas de doute

| Ce qu'on voit | Ce que c'est |
|---|---|
| « Aucune version publiée » sur un template | rien à servir : le publier depuis l'éditeur, ou choisir « Brouillon » |
| Une fiche sort sans prix | le montant n'a pas été normalisé — vérifier que la colonne vise bien `product.price.amount` |
| Une fiche sort sans images | le séparateur de listes, presque toujours. Voir le premier payload le montre tout de suite |
| Des balises `<p>` imprimées sur la fiche | du HTML versé dans `description_short`, qui est du texte : ajouter la transformation « HTML → texte » |
| `429` rejoué en boucle | une génération en masse tourne en parallèle ; baisser les rendus simultanés ou attendre |
| Le ZIP ne se télécharge pas | l'archive dépasse ce que l'onglet tient. Découper avec la plage |
