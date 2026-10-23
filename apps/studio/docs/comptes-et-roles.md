# Comptes, rôles et connexion

**Objet :** comment on entre dans le Studio, qui a le droit de quoi, et comment on ouvre un accès
à quelqu'un.

**À qui c'est destiné :** l'administrateur du Studio, et la personne qui déploie.

---

## 1. Ce qui a changé, et pourquoi

Jusqu'ici l'interface entière vivait derrière le **basicauth de Traefik** : un identifiant et un
mot de passe uniques, écrits dans `/etc/traefik/studio-users`, partagés par tout le monde.

Ça marchait. Ce que ça ne permettait pas :

| Besoin | Avec le mot de passe partagé |
|---|---|
| Confier l'import d'un catalogue à quelqu'un | il obtenait aussi le droit de supprimer un template |
| Savoir qui a supprimé un template | impossible |
| Retirer l'accès à une personne qui part | changer le mot de passe de tout le monde |
| Laisser un prestataire prévisualiser une fiche | il fallait lui donner les clés de l'éditeur |

Les comptes nominatifs répondent à ces quatre points, et à rien d'autre : le Studio reste un outil
interne. Il n'y a ni inscription libre, ni fédération d'identité, ni double facteur — **un accès
s'ouvre toujours par un administrateur**.

L'authentification par **clé API des boutiques** (`/api/v1/*`) n'est pas touchée : elle répond à un
autre besoin — une machine, pas une personne — et les deux cohabitent sans se connaître.

## 2. Les rôles

La matrice vit dans [`src/lib/roles.ts`](../src/lib/roles.ts), en toutes lettres, et
[`src/lib/roles.test.ts`](../src/lib/roles.test.ts) la garde.

| | Super-admin | Administrateur | Éditeur | Importateur | Commercial |
|---|:---:|:---:|:---:|:---:|:---:|
| Voir la liste des templates, **prévisualiser** | ✅ | ✅ | ✅ | ✅ | — |
| Créer, modifier, dupliquer, **supprimer** un template | ✅ | ✅ | ✅ | — | — |
| Publier un template | ✅ | ✅ | ✅ | — | — |
| Voir la bibliothèque d'images | ✅ | ✅ | ✅ | ✅ | — |
| Téléverser / supprimer une image | ✅ | ✅ | ✅ | — | — |
| Importer un catalogue | ✅ | ✅ | ✅ | ✅ | — |
| Journal des rendus | ✅ | ✅ | ✅ | ✅ | — |
| **Consulter les fiches, les télécharger en zip, composer un book** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Couvertures et intercalaires du book | ✅ | — | — | — | — |
| **Masquer des catégories ou des fiches** de la consultation (et donc des zips et des books) | ✅ | ✅ | — | — | — |
| Comptes, boutiques, clés API | ✅ | ✅ | — | — | — |
| **Accorder ou retirer le rôle d'administrateur** | ✅ | — | — | — | — |
| **Supprimer ou désactiver un administrateur** | ✅ | — | — | — | — |
| **Transmettre le rôle de super-administrateur** | ✅ | — | — | — | — |

**Le commercial** n'a que la consultation, le book et la page Retours (quand elle est activée). En se connectant,
il arrive directement sur `/consultation` : l'accueil, qui est la liste des templates, le renvoie
sur sa seule section.

**Le super-administrateur est unique**, et l'unicité est tenue par la **base** — un index unique
partiel (migration 007), pas une règle de code. Une règle métier qui ne vit que dans une fonction
finit par être contournée par un second chemin d'écriture.

**Ce que ça change pour les administrateurs :** ils ne se gèrent plus les uns les autres. Avant,
deux administrateurs pouvaient se désactiver mutuellement — seuls « pas le dernier actif » et « pas
soi-même » les empêchaient d'aller au bout, et un désaccord entre deux personnes de même rang se
réglait à celui qui cliquait le premier. Désormais cela remonte à une seule personne, qui répond de
l'instance.

### Le rôle ne se retire pas, il se transmet

Le compte du super-administrateur **ne peut être ni supprimé, ni désactivé, ni rétrogradé** — y
compris par son titulaire. La seule sortie est **« Transmettre le rôle »** dans `/admin/comptes`,
qui rétrograde le sortant en administrateur et promeut le nouveau dans la même transaction.

Sans cette règle, on atteint zéro super-administrateur et plus personne ne peut en désigner un
depuis l'interface.

> **C'est un essai de bout en bout qui l'a montré, pas une relecture.** La première version gardait
> la suppression et la désactivation mais pas le changement de rôle : le titulaire pouvait se
> retirer son propre rôle par le sélecteur, avec une réponse « ok ». La garantie était écrite dans
> les commentaires sans être implémentée.

**La cible doit avoir activé son compte.** Confier le rôle le plus puissant du Studio à quelqu'un
qui n'a jamais suivi son lien d'activation reviendrait à le confier à qui intercepte ce lien — et le
sortant aurait déjà perdu le sien.

### Quand le super-administrateur n'est plus joignable

```sh
pnpm superadmin prenom.nom@exemple.fr
```

Il quitte l'entreprise, perd son accès, part en congés au mauvais moment : le rôle ne se prend pas,
il se donne. Cette commande est la seule sortie, et **elle exige un accès SSH** — c'est la garantie.
Le seul moyen de s'attribuer le rôle le plus puissant du Studio est d'avoir la main sur le serveur.
Aucune page, aucun jeton, rien de joignable depuis Internet.

Le compte doit exister et avoir été activé ; la commande ne crée rien — `pnpm admin` le fait, et
séparer les deux gestes évite de donner ce rôle à une adresse de courriel plutôt qu'à une personne.
La trace apparaît dans le journal des actions avec « ligne de commande » comme auteur : personne ne
s'est authentifié.

### Sur cette instance

La migration 007 promeut **le plus ancien administrateur ayant réellement activé son compte**.
Déterministe, et le critère n'est pas anodin : un compte seulement invité est écarté.

Si aucun administrateur n'est activé, **personne n'est promu** — l'instance reste sans
super-administrateur et `pnpm superadmin` le désigne. Promouvoir au hasard serait pire que ne rien
faire.

**Ce n'est pas une hiérarchie**, même si le tableau y ressemble. Un éditeur n'est pas un
administrateur diminué : il n'a aucune raison de voir les clés API du parc. C'est pour ça que la
matrice est écrite rôle par rôle plutôt que dérivée d'un niveau numérique — un niveau force à
inventer un ordre entre des besoins qui n'en ont pas.

**Trois choix méritent d'être défendus :**

- **L'importateur voit les templates et peut les prévisualiser.** C'est la demande exacte : il
  travaille *sur* un template sans avoir à le modifier. L'aperçu part de la version publiée (ou du
  brouillon s'il n'y en a pas), sur les **données d'exemple** du Studio — il ne divulgue aucun
  catalogue. Bouton **« Aperçu »** sur l'accueil, et **« Aperçu du template »** dans la page
  d'import.
- **L'éditeur peut importer.** Régler un template se termine toujours par un lot d'essai sur de
  vraies données. Le lui refuser l'obligerait à demander à quelqu'un d'autre de lancer chaque essai.
- **`templates:write` et `templates:publish` sont deux permissions séparées** alors que les deux
  rôles qui écrivent ont aujourd'hui les deux. La distinction coûte une ligne et sera là le jour où
  l'on voudra un rôle qui compose sans mettre en ligne — la demande qui revient toujours.

> **Masquer un bouton ne protège rien.** L'interface cache ce que le rôle ne permet pas, par
> lisibilité ; **chaque page et chaque route revalide côté serveur**
> ([`src/lib/guard.ts`](../src/lib/guard.ts)). Le portail
> [`src/proxy.ts`](../src/proxy.ts) ne fait qu'un raccourci : il vérifie qu'un cookie existe, jamais
> ce qu'il vaut.

## 3. Ouvrir le tout premier accès

Une instance neuve n'a **aucun compte** : personne ne peut se connecter, donc personne ne peut
inviter. Une commande casse cette boucle, une fois.

```sh
# Sur un poste de développement
pnpm admin prenom.nom@exemple.fr "Prénom Nom"

# Avec la démo Docker, depuis la racine du dépôt
docker compose run --rm setup tsx scripts/create-admin.ts \
  prenom.nom@exemple.fr "Prénom Nom"
```

Elle affiche un **lien d'activation**, valable sept jours et à usage unique :

```
  LIEN D'ACTIVATION (valable 7 jours, a usage unique) :
  https://studio.acme.example/activation?jeton=…
```

Le script **n'écrit aucun mot de passe** : il émet un jeton. Le mot de passe est choisi par la
personne, dans le navigateur, et ne transite jamais par un terminal ni par l'historique du shell.
C'est la même règle que pour les clés API — rien de réversible ne sort d'ici.

> Relancer la commande sur une adresse existante **la promeut administrateur** et émet un nouveau
> lien, en invalidant le précédent. C'est le dépannage prévu quand plus personne n'a la main.

Ensuite, tout passe par **`/admin/comptes`**.

## 4. Inviter quelqu'un

`/admin/comptes` → **Inviter quelqu'un** → adresse, nom, rôle.

Le compte est créé **sans mot de passe** : il ne devient utilisable qu'une fois le lien
d'activation suivi. Un compte en attente porte la pastille *invitation en attente*.

**Si le courriel ne part pas**, le lien s'affiche à l'écran, dans un encadré à copier. C'est un
compromis assumé : un lien affiché peut être collé dans une conversation, donc fuiter — mais
l'alternative est pire. Un Studio sans relais SMTP (le cas au premier jour de chaque environnement)
rendrait l'ouverture de comptes impossible, et la réponse habituelle à cette impasse est un mot de
passe partagé, c'est-à-dire exactement ce que ces comptes remplacent.

Le compromis est borné : le lien n'apparaît **que si l'envoi a échoué**, il ne vaut qu'une fois, il
expire, et en émettre un nouveau invalide le précédent.

**Pensez à transmettre aussi** [utiliser-le-studio.md](utiliser-le-studio.md) à la personne
invitée : ce document-ci s'adresse à qui administre le Studio, pas à qui s'en sert au quotidien.

## 5. Brancher un relais de courriel

Sans configuration, `MAIL_TRANSPORT` vaut `log` : les messages sont écrits dans les journaux du
conteneur et rien ne part. `/admin` l'affiche en toutes lettres, en tête de page.

### En production : un sidecar, rien à configurer

Le montage recommandé est un service **`smtp`** (par exemple `namshi/smtp`) sur le réseau `internal`,
jamais exposé. C'est le motif courant d'un projet auto-hébergé ; la démo Docker du dépôt utilise
Mailpit à la place (voir plus bas). L'application lui parle sur le **port 25, sans
authentification et sans TLS** : c'est sans danger précisément parce qu'il n'est joignable que
depuis ce réseau, comme Postgres et Gotenberg.

> L'image `namshi/smtp` tourne **Exim**, pas Postfix :
> `220 studio.acme.example ESMTP Exim 4.92`. Le dire évite de chercher un `postconf` qui
> n'existe pas quand on diagnostique. La bannière est aussi la preuve la plus rapide que `MAILNAME`
> a pris effet.

Avec ce montage (`MAIL_TRANSPORT=smtp`, `MAIL_HOST=smtp`, `MAIL_PORT=25`), **il n'y a rien d'autre à
configurer**, sauf deux choses :

```dotenv
# Le nom d'hôte que le relais annonce
MAILNAME=studio.acme.example
MAIL_FROM=Datasheet Studio <no-reply@studio.acme.example>

# Indispensable : les liens d'activation. L'application ne peut pas la deviner,
# elle ne voit qu'un hôte interne derrière Traefik.
STUDIO_PUBLIC_URL=https://studio.acme.example
```

> **`MAILNAME` n'est pas cosmétique.** C'est le nom d'hôte que les serveurs destinataires
> confrontent aux enregistrements **SPF** et **PTR** du domaine pour décider si le message est
> légitime. Laissé par défaut, les invitations finissent en indésirables — et le Studio, lui,
> annoncera « envoyé » en toute bonne foi : il a bien remis le message au relais.

Ce qu'on gagne face à un relais externe authentifié : **aucun identifiant à stocker**, aucune clé à
faire tourner, et une configuration identique d'un projet à l'autre.

### En local, le courriel est attrapé

Le `docker-compose.yml` racine lance un **Mailpit**, interface sur 8025 ; la surcharge de
développement publie aussi son SMTP sur 1025 :

```sh
docker compose -f docker-compose.yml -f apps/studio/infra/docker-compose.dev.yml up -d db gotenberg mailpit
open http://localhost:8025
```

On y **lit** les invitations telles qu'elles partiront, mise en page comprise — ce que le mode
`log` ne montre pas. `MAIL_HOST=localhost` et non le nom de service `smtp` : `pnpm dev` tourne
sur l'hôte, il ne voit pas le réseau Docker interne.

> Mailpit et non MailHog : MailHog est archivé depuis 2020, Mailpit en
> est le successeur maintenu et parle exactement les mêmes ports. C'est un conteneur de
> développement, remplacé à chaque `up`.

### Le cas d'un relais externe

À n'utiliser que si le sidecar ne convient pas — un service transactionnel pour la délivrabilité, ou
un relais imposé.

```dotenv
MAIL_TRANSPORT=smtp
MAIL_SMTP_URL=smtps://utilisateur:motdepasse@smtp.exemple.fr:465
# …ou le quadruplet MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASSWORD
```

**`MAIL_SECURE` suit le port si on ne le pose pas** : `true` sur 465, `false` ailleurs. Le 465
attend une connexion chiffrée d'emblée, le 587 attend du STARTTLS. Les mettre en désaccord est
l'erreur la plus fréquente, et la plus opaque — le relais parle de « wrong version number ».

| Relais | Port | `MAIL_SECURE` | Identifiants |
|---|---|---|---|
| **Sidecar** (défaut) | 25 | `false` | **aucun** |
| Relais authentifié d'hébergeur | 587 | `false` | l'adresse et son mot de passe |
| Microsoft 365 / Google Workspace | 587 | `false` | ⚠ un **mot de passe d'application** |
| Service transactionnel (Brevo, Postmark) | 587 | `false` | l'identifiant du service, la clé API comme mot de passe |

> **`MAIL_TLS_INSECURE=true` n'a qu'un seul usage légitime :** un relais interne dont le certificat
> est auto-signé, sur un réseau de confiance. Sur un relais joignable depuis Internet, l'activer
> revient à accepter n'importe quel interlocuteur — avec les identifiants SMTP à la clé.

> **ÉDITER LE `.env` NE SUFFIT PAS.** Compose lit ce fichier **au démarrage** du conteneur, pas
> en continu. Un `.env` corrigé après un `docker compose up` laisse le conteneur tourner avec les
> anciennes valeurs — et le contrôle de `/admin` rapporte alors fidèlement l'ancienne configuration,
> ce qui est parfaitement déroutant.
>
> Rencontré sur une instance de test : le fichier disait `MAIL_TRANSPORT=smtp`, le conteneur
> avait `log`, et deux invitations n'ont jamais pu partir.
>
> ```sh
> docker compose up -d app          # recree le conteneur avec le .env courant
> docker exec <projet>-app env | grep MAIL_   # ce qu'il a REELLEMENT
> ```
>
> Le second contrôle est le seul qui dise la vérité. `docker compose config` lit le fichier, pas le
> conteneur.

### Éprouver la configuration, sans deviner

`docker compose up -d app`, puis **`/admin` → tuile « Courriel »**. Deux boutons, et ils ne disent
pas la même chose :

| | Ce que ça couvre |
|---|---|
| **Vérifier le relais** | ouvre la connexion, négocie TLS, s'authentifie, raccroche. **Sans envoyer.** Isole l'hôte, le port, le TLS et les identifiants |
| **M'envoyer un courriel de test** | envoie un vrai message, **à votre propre adresse uniquement**. Seul contrôle qui couvre `MAIL_FROM` et le routage — un relais peut très bien nous authentifier puis refuser notre adresse d'expédition |

En cas d'échec, l'écran donne trois choses : **la cause en français**, **le champ à regarder**, et
**le message SMTP d'origine** — ce dernier parce que c'est lui qu'on colle dans un ticket au
fournisseur du relais.

Les causes reconnues, et leur correction :

| Ce que dit le relais | Ce qu'il faut changer |
|---|---|
| `ECONNREFUSED` | `MAIL_HOST` / `MAIL_PORT` — rien n'écoute là |
| `ENOTFOUND`, `EAI_AGAIN` | `MAIL_HOST` — depuis un conteneur, un nom local n'est pas forcément connu |
| `ETIMEDOUT` | `MAIL_PORT` — un pare-feu bloque souvent le 25 en sortie ; essayer 587 |
| `EAUTH`, `535`, `534` | `MAIL_USER` / `MAIL_PASSWORD` |
| `wrong version number` | `MAIL_PORT` et `MAIL_SECURE` en désaccord |
| `self-signed certificate` | relais interne : `MAIL_TLS_INSECURE=true`, et seulement là |
| `550 Sender address rejected` | `MAIL_FROM` — la plupart des relais n'acceptent qu'un domaine qu'ils gèrent |
| `554 Relay access denied` | il faut s'authentifier, ou être autorisé par IP |
| `421`, `4.7.0` | rien : le relais nous limite temporairement |

> **« Envoyé » ne veut pas dire « arrivé ».** Le Studio dit *remis au relais*. Ce qui se passe
> ensuite — filtre antispam, boîte pleine, réputation du domaine — lui échappe. Si le test ne
> parvient pas alors que l'écran annonce un envoi, la panne est en aval : regarder les indésirables,
> puis les journaux du relais.

### Ce que l'échec ne casse pas

**Un envoi qui échoue ne fait jamais échouer l'action qui l'a déclenché.** Inviter quelqu'un crée le
compte et le jeton ; si le relais tousse, le lien s'affiche à l'écran et l'administrateur le
transmet. C'est délibéré : l'inverse rendrait l'ouverture de comptes impossible sur une instance
sans relais, et la réponse habituelle à cette impasse est un mot de passe partagé — exactement ce
que ces comptes remplacent.

Pour « mot de passe oublié », l'envoi part **en arrière-plan** et n'est pas attendu. C'est une
précaution d'énumération, pas une optimisation : attendre la poignée de main SMTP faisait répondre
une adresse connue en plusieurs secondes et une inconnue en cinq millisecondes, ce qui annulait le
message volontairement identique (voir §8).

## 6. Cycle de vie d'un compte

| Situation | Geste |
|---|---|
| La personne a perdu son mot de passe | elle utilise **Mot de passe oublié** ; ou l'administrateur clique **Réinviter** |
| Le lien d'invitation a expiré | **Réinviter** — l'ancien lien devient invalide |
| La personne change de poste | changer son rôle dans la liste, ça prend effet à sa requête suivante |
| La personne part | **Désactiver**. Ses sessions sont fermées **immédiatement** |
| L'invitation est partie sur une adresse mal tapée | **Supprimer** — possible tant que le compte n'a **jamais été activé** |

Un compte **déjà activé ne se supprime pas**, il se désactive : ses traces dans le journal des
actions doivent rester lisibles.

Deux garde-fous refusent une manœuvre qui fermerait l'administration : on ne retire pas le rôle
administrateur au **dernier administrateur actif**, et on ne désactive pas **son propre compte**.

## 7. Ce que le journal des actions retient

`/admin` liste qui a invité, changé un rôle, désactivé, fait tourner une clé, supprimé un template.
`actor_email` y est **dupliqué volontairement** : un compte peut être supprimé plus tard, la trace
doit rester lisible.

C'est le pendant du **journal des rendus** (`/journal`), qui dit ce que les *machines* ont fait.
Les deux ne se mélangent pas.

## 8. Sécurité — les décisions, en une page

| Point | Décision | Pourquoi |
|---|---|---|
| Mots de passe | scrypt, N=32768, paramètres stockés dans l'empreinte | disponible dans `node:crypto`, donc **aucune dépendance native** à compiler dans une image Alpine ; les paramètres embarqués permettent de durcir sans invalider les comptes |
| Politique | **12 caractères minimum**, aucune classe imposée | NIST depuis 2017 : exiger majuscule + chiffre + symbole produit « Motdepasse1! » et rien de mieux |
| Réutilisation | le mot de passe choisi est confronté aux **fuites connues** (HIBP, k-anonymat) | la longueur protège du hasard, pas de la réutilisation. Mesuré : `Password123!Password` — 20 caractères, majuscule, chiffre, symbole — figure dans les fuites ; `azertyuiopqsdfgh` y est vu 2 578 fois et passe la politique de longueur |
| Sessions | **en base**, cookie `httpOnly` + `SameSite=Lax` | désactiver un compte doit couper l'accès *tout de suite*, ce qu'un jeton autoportant ne permet pas |
| Échéances | 12 h d'inactivité, **30 jours en absolu** | la seconde n'est jamais repoussée : une session finit toujours par mourir |
| Jetons | sha256 en base, usage unique, 7 j (invitation) / 2 h (réinitialisation) | une copie de la base ne permet de prendre aucun compte |
| Force brute, par compte | 10 échecs → 15 min de verrou, **en base**, vérifié **avant** la dérivation | un redémarrage de conteneur ne doit pas remettre le compteur à zéro. Le verrou était initialement consulté *après* `verifyPassword` et seulement sur le chemin du succès : un robot n'était donc jamais ralenti, et chaque tentative coûtait 44 ms et 32 Mo — une porte qu'on peut marteler doublée d'un levier de déni de service |
| Force brute, par source | `rateLimit` Traefik sur `/api/auth` : 6/s, rafale de 12, par IP | le verrou protège *un* compte ; il ne voit pas l'attaque réelle contre un outil de vingt comptes, un mot de passe courant essayé sur les vingt |
| Verrou en spirale | les tentatives pendant le verrou **ne le prolongent pas** | sans cela, un robot maintenait un compte légitime verrouillé en permanence, et une personne revenant au bout des 15 minutes se reverrouillait au premier faux pas |
| Oracle de durée | **plancher de réponse à 200 ms** sur toutes les actions qui prennent une adresse | court-circuiter la dérivation pour un compte verrouillé le fait répondre en 5 ms au lieu de 44 : l'écart se mesure à distance. Le plancher coûte un minuteur, pas 32 Mo. Mesuré : les cinq chemins répondent entre 210 et 218 ms |
| Oracle du courriel | l'envoi de « mot de passe oublié » **n'est pas attendu** | avec un relais SMTP, une adresse connue répondait après la poignée de main — parfois des secondes — et une inconnue en 5 ms. Le message identique ne servait alors à rien |
| Visibilité | chaque échec est écrit dans `login_attempts` avec son IP, et `/admin` en montre le décompte sur 24 h | `recordLoginFailure` incrémentait un compteur et ne laissait **aucune trace** : 400 tentatives dans la nuit ne se voyaient nulle part. On ne bloque bien que ce qu'on a d'abord constaté |
| Sessions mortes | purge opportuniste, au plus une fois par heure et par processus | l'appel n'existait qu'à la connexion : sur une instance où tout le monde garde son onglet ouvert, le nettoyage ne se déclenchait jamais |
| En-têtes | `nosniff`, `X-Frame-Options`, `Permissions-Policy`, CSP étroite (`frame-ancestors`, `base-uri`, `form-action`, `object-src`) | pas de `script-src` : Puck et Next injectent en ligne, et une CSP qui casse l'éditeur finit désactivée |
| Jeton dans l'URL d'activation | `Referrer-Policy: no-referrer` sur `/activation` | ferme le seul des trois canaux de fuite que l'application contrôle ; l'historique du navigateur et les journaux du reverse proxy restent, d'où l'usage unique et l'expiration |
| Énumération | « Identifiants incorrects » couvre les trois cas, et le mot de passe est dérivé **même sur un compte inconnu** | le message unique ferme le canal évident ; la dérivation à vide reste la bonne habitude, pour que l'oracle ne revienne pas seul le jour où le plancher de réponse serait retiré. Une limite subsiste, assumée : voir §10 |

## 9. Ouvrir l'accès d'une nouvelle instance

**L'ordre compte** : créer le compte administrateur avant d'ouvrir l'instance à qui que ce soit, pour
qu'un jeton d'activation valide existe dès le premier démarrage.

1. Renseigner **`STUDIO_PUBLIC_URL`**, `COOKIE_SECURE` et `MAIL_TRANSPORT` (§5).

2. **Construire et migrer** :

   ```sh
   docker compose build
   docker compose run --rm setup tsx scripts/migrate.ts
   ```

3. **Créer le compte administrateur.** Garder le lien affiché, il ne sera pas réaffiché :

   ```sh
   docker compose run --rm setup \
     tsx scripts/create-admin.ts prenom.nom@exemple.fr "Prénom Nom"
   ```

4. **Démarrer**, puis **suivre le lien** de l'étape 3 et choisir un mot de passe :

   ```sh
   docker compose up -d
   ```

Sauter l'étape 3 laisse une instance sans personne pour en ouvrir l'accès. Ce n'est jamais bloquant
— relancer la commande émet un nouveau lien et invalide le précédent.

## 10. Ce qui reste ouvert, et pourquoi

Trois limites connues, écrites ici pour qu'elles soient des décisions et non des oublis.

**Le plafonnement par IP atténue le bourrage d'identifiants, il ne le résout pas** — un botnet
réparti sur mille adresses passe sous le seuil. C'est pourquoi le mot de passe **choisi** est
confronté aux fuites connues : voir §11. Il reste que rien ne détecte un compte dont le mot de passe
a fuité *après* son choix ; une réinitialisation périodique serait la réponse, et elle a ses propres
défauts (on incrémente un chiffre). Non fait, et pas certain qu'il faille le faire.

**Il n'y a pas de second facteur.** C'est la seule chose qui fermerait vraiment le bourrage. C'est
aussi un chantier : enrôlement, codes de secours, perte d'appareil, réinitialisation par un
administrateur. Sur un outil qui ne contient ni données personnelles ni moyens de paiement — des
templates et un catalogue produit — ce n'est pas le bon arbitrage aujourd'hui. Ce le deviendrait le
jour où le Studio touche autre chose.

**Le 429 du verrou révèle qu'un compte existe** : onze requêtes sur une adresse suffisent. On le
garde, parce que les adresses du parc suivent `prenom.nom@example.com` et qu'un attaquant les
devine sans oracle. Le fermer demanderait de compter les échecs par adresse *essayée* — quinze
lignes et un index — et ce serait le correctif si les adresses cessaient d'être prévisibles.

## 11. Les mots de passe compromis

La menace réelle contre un formulaire de connexion exposé sur Internet n'est pas qu'on **devine** un
mot de passe : c'est qu'un robot essaie des couples adresse/mot de passe **déjà fuités ailleurs**.
La politique de longueur protège du hasard, pas de la réutilisation — un mot de passe de vingt
caractères repris d'un site compromis en 2023 tombe au premier essai.

Le mot de passe **choisi** est donc confronté aux fuites connues, au moment où il est posé
(activation ou réinitialisation).

### Le mot de passe ne quitte jamais le serveur

C'est la seule chose à comprendre avant d'accepter un appel réseau sur ce chemin. Le procédé est le
**k-anonymat** de Have I Been Pwned :

1. le SHA-1 du mot de passe est calculé **localement** ;
2. seuls les **cinq premiers caractères hexadécimaux** de cette empreinte sont envoyés ;
3. le service répond la liste de **tous** les suffixes qu'il connaît pour ce préfixe — environ deux
   mille — avec leur nombre d'occurrences ;
4. la recherche du suffixe se fait **localement**.

Le service apprend donc qu'un mot de passe commençant par ces cinq caractères a été vérifié. Cinq
caractères hexadécimaux, c'est un espace de 1 048 576 valeurs : il ne peut ni identifier le mot de
passe, ni savoir s'il a été trouvé. L'en-tête `Add-Padding` complète la réponse de fausses entrées,
pour que sa **taille** ne trahisse rien non plus.

> SHA-1 ici n'est pas un choix de sécurité : c'est le format de l'index de HIBP, imposé par l'API.
> Le **stockage** reste en scrypt.

### Ce que ça attrape, mesuré

| Mot de passe | Longueur | Occurrences | Verdict |
|---|---|---|---|
| `Password123!Password` | 20 | 2 | **refusé** |
| `azertyuiopqsdfgh` | 16 | 2 578 | **refusé** |
| `motdepasse123456` | 16 | 2 257 | **refusé** |
| `le rayonnage bleu de la trois` | 29 | 0 | accepté |

Les deux premiers passent la politique de longueur, et le premier passe toutes les règles de
« complexité » qu'on trouve ailleurs. C'est exactement ce que la longueur seule ne voit pas.

### Il échoue ouvert, délibérément

Service injoignable, en erreur, ou trop lent (délai de **3 secondes**, vérifié à 3 007 ms) : le mot
de passe est **accepté**, et l'indisponibilité est journalisée côté conteneur.

Refuser l'activation d'un compte parce qu'une API tierce est en panne serait un plus mauvais
échange : le compte reste inutilisable, la personne ne comprend pas, et la réponse habituelle à
cette impasse est de désactiver le contrôle pour de bon.

Un mot de passe trop court est refusé **sans appel réseau** : inutile de faire attendre trois
secondes pour annoncer qu'il manque deux caractères.

### Le message n'accuse pas

« Votre mot de passe est mauvais » serait faux : il peut être long et unique et figurer quand même
dans une fuite, parce qu'il a servi ailleurs. Le message dit le fait, donne le **nombre
d'occurrences** — qui emporte la conviction mieux qu'une consigne — et demande autre chose. Le
formulaire annonce aussi le contrôle **avant** la saisie : sans ça, l'enregistrement met deux à trois
secondes sans raison apparente.

## 12. La délivrabilité — pourquoi Gmail refuse

Constaté le 07/09/2026 : les invitations n'arrivaient pas sur Gmail, et mail-tester donnait une note
très basse. **Le Studio n'y est pour rien** — le journal du relais montre que le message part et
qu'il est accepté (`250 2.0.0 Ok`), la file est vide. Ce qui manque, c'est de quoi **prouver** que
nous avons le droit d'écrire depuis ce domaine.

### Ce qu'un destinataire vérifie, et ce qu'il trouve

| Contrôle | État constaté |
|---|---|
| **SPF** de `studio.acme.example` | **aucun enregistrement** → résultat `none` |
| **DKIM** | **aucune signature** — `namshi/smtp` ne signe pas |
| **PTR** (reverse DNS) de `203.0.113.107` | **aucun** |
| L'IP dans le SPF de `acme.example` | **non** : il liste `203.0.113.130`, et se termine par `-all` |

**Gmail exige depuis février 2024**, pour tout expéditeur : SPF **ou** DKIM qui passe, **et** un
reverse DNS valide sur l'IP émettrice. Il manque les trois. Ce n'est pas un réglage à affiner, c'est
l'absence de toute authentification — le message est indiscernable d'un envoi usurpé.

### Les trois réponses possibles

**A. Authentifier l'envoi direct.** Ajouter un SPF pour le sous-domaine, obtenir un PTR, signer en
DKIM.

```
studio.acme.example.  TXT  "v=spf1 ip4:203.0.113.107 -all"
```

Le SPF prend cinq minutes dans le panneau DNS. Le **PTR appartient à l'hébergeur de l'IP** : c'est
une demande, pas un réglage. Et le DKIM demanderait de remplacer l'image du relais, qui ne signe
pas. Même tout réuni, une IP de test sans historique d'envoi atterrit en indésirables
pendant des semaines.

**B. Relayer par un service transactionnel** (Brevo, Mandrill, Postmark…). Si le SPF de
`acme.example` en déclare déjà un, le compte existe. Le service signe en DKIM, ses IP ont une réputation, et **aucun PTR n'est
nécessaire**.

Le code le prend en charge sans modification :

```dotenv
MAIL_TRANSPORT=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=…
MAIL_PASSWORD=…
MAIL_FROM=Datasheet Studio <no-reply@acme.example>
```

**`MAIL_FROM` doit porter un domaine que le service est autorisé à signer.** C'est le point qu'on
rate : relayer par Brevo avec un `From:` sur un sous-domaine non déclaré chez lui ne résout rien.

**C. Relayer par le serveur de messagerie de l'entreprise**, si `203.0.113.130` en est un. Aucun compte
tiers, mais il faut qu'il accepte de router pour ce projet.

### La recommandation

**B**, et pour une raison qui n'est pas technique : la délivrabilité est un métier. Un service
transactionnel entretient la réputation de ses IP, gère les rebonds et les plaintes, et publie ses
enregistrements. Le faire soi-même depuis un hôte de test, c'est s'engager à surveiller des
listes noires.

Le SPF du **A** vaut la peine d'être posé de toute façon : il coûte cinq minutes et il ferme
l'usurpation du sous-domaine, quel que soit le chemin d'envoi retenu.

### Ce que le Studio fait déjà bien, vérifié

`From` et `Return-Path` alignés, `Message-ID` sur le domaine de l'expéditeur, `Date` présente,
`multipart/alternative` avec une version texte **et** une version HTML, jeu de caractères déclaré.
`Auto-Submitted: auto-generated` (RFC 3834) évite qu'un répondeur d'absence ne réponde à
`no-reply@`.

**Pas de `List-Unsubscribe`**, et c'est délibéré : mail-tester en retire des points, mais un lien de
désabonnement sur une réinitialisation de mot de passe n'a aucun sens — on ne se désabonne pas de sa
propre demande. Gmail ne l'exige que des envois **en masse**.

### Sur un réseau sans accès sortant

```dotenv
PWNED_PASSWORDS=off
```

Ou, mieux, pointer sur une copie auto-hébergée du jeu de données, que HIBP publie en téléchargement
— le contrat est le même, `GET /range/<préfixe>` :

```dotenv
PWNED_API_URL=https://hibp.interne.exemple.fr
```
