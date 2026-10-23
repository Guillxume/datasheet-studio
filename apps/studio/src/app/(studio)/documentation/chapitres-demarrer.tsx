import { Chapter, Code, DocTable, List, Note, P, Step, Steps, Sub, Ui } from "./doc";

/**
 * Documentation, premiere partie : ce qu'est le Studio, comment y entrer, et
 * les deux ressources qu'on y depose avant de composer — les images et les
 * templates.
 */

export function Bienvenue() {
  return (
    <Chapter id="bienvenue" no="01" title="Le Studio en une minute">
      <P>
        Le Datasheet Studio fabrique les <strong>fiches techniques PDF</strong> des produits de nos boutiques. Une
        boutique (PrestaShop aujourd’hui, Medusa demain) envoie les données d’un produit : nom, référence,
        caractéristiques, photos, badges, finitions. Le Studio les verse dans un <strong>template</strong> et rend un
        PDF, que la boutique propose au téléchargement sur la fiche produit.
      </P>
      <P>
        Un template se compose <strong>une fois</strong> et sert à des centaines de fiches. C’est le cœur de votre
        travail : composer des templates qui tiennent quel que soit le produit — une caractéristique de trop, une photo
        en portrait ou un produit sans schéma ne doivent pas casser la mise en page.
      </P>

      <Sub title="Le vocabulaire">
        <DocTable
          head={["Mot", "Ce qu'il désigne"]}
          rows={[
            [<strong key="t">Template</strong>, "Le modèle d'une fiche : sa mise en page, ses blocs, ses en-tête et pied de page, sa feuille de style."],
            [<strong key="b">Bloc</strong>, "Un élément posé dans le template : un titre, une image, un tableau de caractéristiques, des colonnes…"],
            [<strong key="p">Page</strong>, "Le corps d'un template est fait de pages. Une page peut ne s'imprimer que si un champ est rempli."],
            [<strong key="k">Token</strong>, <>Un emplacement remplacé par une donnée du produit au moment du rendu, par exemple <Code>{"{{product.name}}"}</Code>.</>],
            [<strong key="c">Composant</strong>, "Un morceau de template réutilisable (un pied de page, un bandeau de coordonnées) : on le modifie une fois, tous les templates qui le citent suivent."],
            [<strong key="br">Brouillon</strong>, "Ce que vous enregistrez en travaillant. Les boutiques ne le voient pas."],
            [<strong key="pu">Version publiée</strong>, "Ce que les boutiques servent. Publier remplace la précédente — immédiatement, en production."],
            [<strong key="po">Portée</strong>, "« Bibliothèque commune » : sert à toutes les boutiques. Ou une boutique précise : ne sert qu'à elle."],
            [<strong key="pr">Profil d'exemple</strong>, "Un jeu de données fictif (produit typique, dense, sans images, vestiaire…) pour composer sans toucher à un vrai produit."],
            [<strong key="r">Règle</strong>, "Ce qui choisit automatiquement le template d'un produit selon sa catégorie, sa marque ou sa référence."],
          ]}
        />
      </Sub>

      <Sub title="Le parcours type">
        <Steps>
          <Step>Téléverser les pictos, logos et polices dans la <Ui>Bibliothèque d’images</Ui>.</Step>
          <Step>Créer un template (ou en dupliquer un) depuis l’accueil.</Step>
          <Step>Le composer dans l’éditeur, avec les données d’exemple.</Step>
          <Step>Le contrôler sur tous les profils, puis regarder l’aperçu PDF.</Step>
          <Step>Le publier — c’est là que les boutiques le reçoivent.</Step>
          <Step>Dire à quels produits il s’applique, dans <Ui>Règles</Ui>.</Step>
        </Steps>
      </Sub>
    </Chapter>
  );
}

export function PriseEnMain() {
  return (
    <Chapter id="prise-en-main" no="02" title="Prise en main">
      <Sub title="Activer son compte, se connecter">
        <List>
          <li>
            Un administrateur vous invite : vous recevez un courriel avec un bouton <Ui>Choisir mon mot de passe</Ui>. Le
            lien vaut une semaine et ne sert qu’une fois — passé ce délai, demandez une nouvelle invitation.
          </li>
          <li>
            Le mot de passe fait au moins 12 caractères. Une phrase longue (« le-cafe-du-matin-est-froid ») est plus sûre
            et plus simple à retenir qu’un mot compliqué.
          </li>
          <li>
            Mot de passe oublié : le lien sous le formulaire de connexion envoie un courriel de réinitialisation. Le
            message affiché est le même que l’adresse existe ou non — c’est voulu.
          </li>
          <li>
            Le menu de votre compte (icône en haut à droite) porte <Ui>Apparence</Ui> — Clair, Sombre ou Système, réglage
            propre à votre navigateur — et <Ui>Sortir</Ui>, à utiliser sur un poste partagé.
          </li>
        </List>
      </Sub>

      <Sub title="Ce que vous voyez dépend de votre rôle">
        <P>
          Le menu de gauche ne montre que ce que votre rôle autorise. Un accès qui manque se demande à un
          administrateur, dans <Ui>Administration</Ui> → <Ui>Comptes</Ui>.
        </P>
        <DocTable
          head={["Rôle", "Ce qu'il fait"]}
          rows={[
            [
              <strong key="e">Éditeur</strong>,
              "Compose, modifie et publie les templates et les composants ; téléverse et supprime les images ; écrit les règles ; importe des catalogues ; change les icônes de catégories de la consultation.",
            ],
            [
              <strong key="i">Importateur</strong>,
              "Voit les templates (en aperçu, sans les modifier) et les images ; importe des catalogues ; lit le journal.",
            ],
            [
              <strong key="a">Administrateur</strong>,
              "Tout ce que fait l'éditeur, plus les comptes et les boutiques (clés d'intégration, coordonnées, couleurs), et les catégories et fiches masquées de la consultation.",
            ],
            [<strong key="s">Super-administrateur</strong>, "Tout, y compris les administrateurs et les couvertures du book. Il est unique."],
            [<strong key="c">Commercial</strong>, "La consultation des fiches et le book, et la page Retours quand elle est activée. Rien d'autre."],
          ]}
        />
      </Sub>

      <Sub title="Le menu">
        <List>
          <li><Ui>Templates</Ui> — l’accueil : les templates et les composants.</li>
          <li><Ui>Règles</Ui> — quel template pour quels produits.</li>
          <li><Ui>Import</Ui> — générer des fiches en série depuis un fichier.</li>
          <li><Ui>Images</Ui> — la bibliothèque des pictos, logos et polices.</li>
          <li><Ui>Consultation</Ui> — les fiches déjà générées, et le book.</li>
          <li><Ui>Journal</Ui> — ce qui a été produit en production, et ce qui a échoué.</li>
          <li><Ui>Documentation</Ui> — cette page. <Ui>Retours</Ui> — écrire au responsable du Studio, quand la page est activée.</li>
        </List>
      </Sub>
    </Chapter>
  );
}

export function Images() {
  return (
    <Chapter id="images" no="03" title="La bibliothèque d'images">
      <P>
        Tout ce qu’un template affiche et qui ne vient pas du produit vit ici : pictos de certification, logos,
        icônes, fonds de bandeau, photos d’options, polices. Menu <Ui>Images</Ui>.
      </P>

      <Sub title="Téléverser">
        <Steps>
          <Step>
            Choisir la <Ui>Portée</Ui> : <Ui>Bibliothèque commune</Ui> pour ce qui sert à toutes les boutiques (cas
            général), ou une boutique pour ce qui lui est propre (son logo, un picto traduit).
          </Step>
          <Step>
            Cliquer <Ui>Téléverser</Ui> et choisir un ou plusieurs fichiers. L’envoi part aussitôt, sans bouton de
            validation.
          </Step>
          <Step>
            Copier l’adresse de la colonne <Ui>URL à copier dans un bloc</Ui> (un clic la sélectionne), puis la
            coller dans le champ du bloc.
          </Step>
        </Steps>
        <List>
          <li>Formats : PNG, JPEG, WebP, SVG, GIF pour les images ; woff2 (de préférence), woff, ttf, otf pour les polices.</li>
          <li><strong>2 Mo au plus</strong> par fichier.</li>
          <li>
            L’adresse a la forme <Code>/assets/&lt;portée&gt;/&lt;clé&gt;</Code>, sans extension :{" "}
            <Code>/assets/shared/tuv</Code>, <Code>/assets/acme-prod/logo</Code>.
          </li>
        </List>
      </Sub>

      <Sub title="La clé, c'est le nom du fichier">
        <P>
          La clé est tirée du nom du fichier : extension retirée, minuscules, accents retirés, espaces et signes
          remplacés par des tirets. « Garantie 3 ans.png » devient <Code>garantie-3-ans</Code>. Nommez donc vos fichiers
          comme vous voulez les retrouver : une clé ne se renomme pas, et c’est elle que les templates citent.
        </P>
        <Note kind="success" title="Remplacer une image partout, sans rouvrir un template">
          <p className="m-0">
            Téléversez le nouveau fichier <strong>sous la même clé et dans la même portée</strong> : il remplace
            l’ancien dans tous les templates qui l’utilisent. Les rendus suivants le prennent en une minute.
          </p>
          <p className="m-0">
            Mais les boutiques gardent leurs fiches en cache, et ne les régénèrent que lorsque la version publiée du
            template change (ou que le produit change). Pour que les fiches déjà générées montrent la nouvelle image,{" "}
            <strong>republiez le template</strong>.
          </p>
        </Note>
        <Note kind="warning" title="Supprimer est immédiat, sans confirmation">
          <p className="m-0">
            Un template qui cite une image supprimée sort sans elle, sans erreur : le bloc disparaît simplement, et
            le <Ui>Journal</Ui> le signale en avertissement. Vérifiez qu’une image ne sert plus avant de la
            supprimer.
          </p>
        </Note>
      </Sub>

      <Sub title="Où une image peut être lue">
        <P>
          Une fiche ne lit que la <strong>bibliothèque commune</strong> et les images <strong>de sa propre
          boutique</strong>. Une image téléversée sous la portée d’une autre boutique est ignorée au rendu — même si
          l’éditeur, lui, l’affiche. Dans le doute : bibliothèque commune.
        </P>
      </Sub>

      <Sub title="Où coller l'adresse d'une image">
        <DocTable
          head={["Bloc", "Champ"]}
          rows={[
            ["Image", <Ui key="1">Image</Ui>],
            ["Panneau (fond, bordure)", <Ui key="2">Image de fond</Ui>],
            ["Bandeau de pictos", <><Ui>Correspondance badge / picto</Ui> → <Ui>Picto</Ui></>],
            ["Bandeau de points clés", <><Ui>Correspondance badge / picto et libellé</Ui> → <Ui>Picto</Ui></>],
            ["Grille d'informations", <><Ui>Entrées</Ui> → <Ui>Icône</Ui></>],
            ["Nuancier de finitions", <><Ui>Couleur ou picto, par libellé</Ui> → <Ui>Picto ou texture</Ui></>],
            ["Grille de fiches", <><Ui>Fiches saisies à la main</Ui> → <Ui>Image</Ui></>],
            ["Bandeau d'en-tête / de pied de page", <><Ui>Logo</Ui>, <Ui>Image de fond</Ui></>],
            ["Feuille de style", <>une police, dans un <Code>@font-face</Code> (voir le chapitre 11)</>],
          ]}
        />
      </Sub>

      <Sub title="Préparer ses pictos">
        <List>
          <li>
            <strong>Les pictos blancs sur fond transparent sont invisibles sur une page blanche</strong> (CE, TÜV, Bureau
            Veritas…). Donnez-leur un fond : <Ui>Couleur de fond du bandeau</Ui> du Bandeau de pictos, ou un Panneau
            coloré autour.
          </li>
          <li>
            Une image trop petite imprime flou, et ça ne se voit pas à l’écran. Visez 300 dpi : pour un visuel
            pleine largeur (186 mm), environ 2 200 px de large.
          </li>
          <li>
            Un logotype de certification (Möbelfakta, Blue Angel…) est une marque déposée : il se demande à
            l’organisme, il ne se redessine pas.
          </li>
          <li>Un picto qui contient du texte traduit se téléverse sous la portée de la boutique de cette langue.</li>
        </List>
      </Sub>
    </Chapter>
  );
}

export function Accueil() {
  return (
    <Chapter id="templates" no="04" title="Templates et composants">
      <P>
        L’accueil (menu <Ui>Templates</Ui>) liste les templates, puis les composants. Pour chacun : sa portée, sa
        version publiée (<Ui>aucune</Ui> tant qu’il n’a jamais été publié) et l’état de son brouillon —{" "}
        <Ui>à jour</Ui> s’il est identique à la version publiée, <Ui>vN non publiée</Ui> si des modifications
        attendent.
      </P>

      <Sub title="Créer ou dupliquer">
        <Steps>
          <Step>
            <Ui>Nouveau template</Ui> part d’une page blanche ; <Ui>Dupliquer un template</Ui> repart d’un
            existant — c’est presque toujours le bon choix.
          </Step>
          <Step>
            Choisir la <Ui>Portée</Ui> : <Ui>Bibliothèque commune (tous les sites)</Ui> ou une boutique.
          </Step>
          <Step>
            Donner un <Ui>Slug</Ui> — l’identifiant technique, en minuscules, chiffres et tirets
            (<Code>fiche-vestiaire</Code>), qui ne change plus — et un <Ui>Nom affiché</Ui>, libre.
          </Step>
          <Step><Ui>Créer et éditer</Ui> ouvre l’éditeur.</Step>
        </Steps>
        <Note title="Un template de boutique masque celui de la bibliothèque">
          <p className="m-0">
            Si une boutique a son propre template sous le même slug qu’un template de bibliothèque, c’est le
            sien qu’elle reçoit. C’est ainsi qu’un site personnalise le modèle commun sans gêner les
            autres.
          </p>
        </Note>
      </Sub>

      <Sub title="Les actions d'une ligne">
        <List>
          <li><Ui>Éditer</Ui> ouvre l’éditeur.</li>
          <li>
            <Ui>Aperçu</Ui> rend un vrai PDF sur données d’exemple, dans un nouvel onglet : la version publiée, ou le
            brouillon s’il n’y en a pas.
          </li>
          <li>
            <Ui>Supprimer</Ui> demande confirmation et dit combien de fiches ce template a produites ces 90 derniers
            jours. Un composant encore cité par un template ne peut pas être supprimé.
          </li>
          <li>
            <Ui>Appliquer…</Ui> (composants seulement) pose le composant dans l’en-tête ou le pied de page de
            plusieurs templates d’un coup — voir le chapitre 12.
          </li>
        </List>
      </Sub>
    </Chapter>
  );
}
