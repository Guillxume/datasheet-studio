# Se servir du Studio

Le Datasheet Studio compose et génère les fiches techniques PDF des produits. Ce guide
s'adresse à qui l'utilise au quotidien — pas à qui le développe ou l'héberge.

## Activer son compte

Un administrateur vous a ouvert un accès. Vous recevez un courriel « Votre accès au Datasheet
Studio » avec un bouton **Choisir mon mot de passe**.

- Le lien est valable une semaine et ne sert qu'une fois. Passé ce délai, ou si vous l'avez déjà
  utilisé, demandez à la personne qui vous a invité d'en émettre un nouveau.
- Le mot de passe doit faire au moins 12 caractères. Une phrase facile à retenir pour vous et
  longue à deviner pour un tiers convient mieux qu'un mot compliqué : « le-cafe-du-matin-est-froid »
  est à la fois plus sûr et plus simple que « K7!mPz2 ».
- Une fois validé, vous arrivez directement dans le Studio — pas besoin de vous reconnecter juste
  après.

## Se connecter, se déconnecter

L'adresse du Studio vous a été communiquée par la personne qui vous a invité — gardez-la dans vos
favoris. Une session reste ouverte plusieurs jours ; **Sortir**, en haut à droite de chaque page,
la ferme volontairement (à faire sur un poste partagé).

**Mot de passe oublié ?** Le lien sous le formulaire de connexion envoie un courriel de
réinitialisation. Le message affiché est le même que l'adresse soit connue ou non : c'est voulu,
pour qu'on ne puisse pas déduire qui a un compte en essayant des adresses au hasard. Si rien
n'arrive après quelques minutes, vérifiez les indésirables avant de recontacter votre
administrateur.

## Ce que vous voyez dépend de votre rôle

La barre en haut de chaque page ne propose que ce que votre rôle autorise — elle ne vous montre
jamais un accès qui vous serait ensuite refusé. Trois profils, en pratique :

- **Importateur** : la bibliothèque de templates (en lecture et en aperçu), l'import de
  catalogue, la bibliothèque d'images, le journal des rendus.
- **Éditeur** : la même chose, plus la création, la modification et la publication des
  templates, et les règles qui choisissent automatiquement un template par catégorie de produit.
- **Administrateur** : la même chose, plus la gestion des comptes, des boutiques et des clés
  d'intégration.

Le détail complet — utile si vous administrez le Studio, pas pour s'en servir au jour le jour —
est dans [comptes-et-roles.md](comptes-et-roles.md).

## La bibliothèque de templates

C'est la page d'accueil : la liste des modèles de fiche disponibles, avec leur portée (un modèle
« bibliothèque » sert à toutes les boutiques, un modèle propre à une boutique n'apparaît que pour
elle), leur version publiée et leur brouillon en cours.

**Aperçu** est accessible à tout le monde et génère un vrai PDF, avec des données d'exemple, dans
un nouvel onglet — pratique pour voir à quoi ressemble un modèle sans toucher à un vrai produit.
Selon votre rôle, **Éditer** ouvre le compositeur du template, et **Supprimer** retire un modèle
(le Studio prévient si des fiches en dépendent encore avant de laisser confirmer).

## Importer un catalogue

La page **Import** génère des fiches en série à partir d'un fichier (CSV ou JSON) : on y choisit
le fichier, on fait correspondre ses colonnes aux champs d'une fiche, on choisit un template et une
boutique, puis on lance. Le résultat est une archive contenant un PDF par produit et un rapport
listant ce qui a échoué ou mérite d'être vérifié.

C'est plus détaillé qu'un simple clic, et ça mérite son propre guide :
[importer-un-catalogue.md](importer-un-catalogue.md).

## Le journal des rendus

**Journal** recense les fiches réellement produites en production — celles qu'une boutique a
demandées, pas les aperçus qu'on génère en composant un template. On y voit combien de fiches sont
sorties, combien ont échoué ou déclenché un avertissement, et sur quels produits. Les fenêtres de
temps en haut de la page (1 heure, 24 heures, 7 jours, 30 jours) changent la période observée sans
recharger tout le reste.

## Changer l'apparence

Le sélecteur **Thème**, en haut de chaque page, propose Système (suit les réglages de votre
ordinateur), Clair ou Sombre. C'est un réglage personnel, gardé par votre navigateur : il ne change
rien pour les autres.

## Un problème ?

Un rôle qui ne correspond pas à ce que vous devez faire, un accès qui manque, un mot de passe à
réinitialiser pour quelqu'un d'autre : ça se règle du côté de votre administrateur, dans
**Administration → Comptes** — ce n'est pas quelque chose qu'on configure soi-même.
