import { Chapter, Code, DocTable, List, Note, P, Step, Steps, Sub, Ui } from "./doc";

/**
 * Documentation, troisieme partie : la mise en page fine, les zones repetees,
 * la feuille de style, les composants, puis tout ce qui va de « c'est pret » a
 * « c'est en ligne » — et ce qui se passe ensuite.
 */

export function MiseEnPage() {
  return (
    <Chapter id="mise-en-page" no="09" title="Mise en page et pagination">
      <Sub title="Les réglages de la page">
        <P>
          Sans bloc sélectionné (onglet <Ui>Corps</Ui>), le panneau de droite règle la page entière :
        </P>
        <DocTable
          head={["Réglage", "Effet"]}
          rows={[
            [<><Ui>Largeur</Ui> / <Ui>Hauteur de page</Ui></>, "Le format, en mm : 210 × 297 pour un A4."],
            [<Ui key="h">Bande haute réservée à l’en-tête</Ui>, "La place gardée en haut de chaque page pour l'en-tête répété. Trop faible, l'en-tête est rogné ; inutile si l'en-tête est vide."],
            [<Ui key="b">Bande basse réservée au pied</Ui>, "Idem pour le pied de page."],
            [<><Ui>Marge papier gauche</Ui> / <Ui>droite</Ui></>, "Le blanc au bord de la feuille, en-tête et pied compris."],
            [<><Ui>Retrait du contenu</Ui> à gauche / à droite</>, "Le blanc autour du corps seulement : 0 pour un contenu bord à bord."],
            [<Ui key="e">Espacement entre les blocs</Ui>, "L'écart vertical entre deux blocs, partout dans la fiche."],
          ]}
        />
      </Sub>

      <Sub title="Tenir sur une page">
        <P>
          La hauteur utile d’une page est sa hauteur moins les deux bandes réservées. La mesure, en haut de
          l’éditeur, dit à tout moment combien de millimètres le contenu occupe. Ce qui fait déborder une fiche, par
          ordre d’importance :
        </P>
        <List>
          <li>
            <strong>Une image non bornée.</strong> Une photo en portrait en pleine largeur prend la moitié de la page.
            Réglez une <Ui>Hauteur maximale</Ui> sur chaque image, galerie et schéma.
          </li>
          <li>
            <strong>Un tableau de caractéristiques étroit.</strong> C’est la largeur qui décide de sa hauteur : 21
            caractéristiques font 186 mm dans une demi-colonne, 102 mm en pleine largeur sur deux colonnes. Mettre le
            schéma au-dessus du tableau plutôt qu’à côté ramène souvent la fiche sur une page.
          </li>
          <li>
            <strong>Le produit qu’on ne regarde pas.</strong> La fiche tient sur le profil typique et déborde sur le
            profil dense : <Ui>Contrôler les 7 profils</Ui> le dit avant les clients.
          </li>
        </List>
      </Sub>

      <Sub title="Les espacements">
        <List>
          <li>L’espacement entre les blocs se règle sur la page, pour toute la fiche.</li>
          <li>Colonnes, Panneau et Groupe ont le leur, pour leur contenu.</li>
          <li>Le bloc <Ui>Espace</Ui> ajoute de la hauteur, ou en retire avec une valeur négative.</li>
          <li>
            <Ui>Garder sur une seule page</Ui> (Colonnes, Panneau, Groupe) évite qu’un ensemble soit coupé entre deux
            feuilles — au prix d’un blanc en bas de page s’il ne tient plus.
          </li>
        </List>
      </Sub>
    </Chapter>
  );
}

export function Bandeaux() {
  return (
    <Chapter id="en-tete-pied" no="10" title="En-tête et pied de page">
      <List>
        <li>
          Les onglets <Ui>En-tête (répété)</Ui> et <Ui>Pied de page (répété)</Ui> composent ce qui se répète en haut et
          en bas de <strong>chaque</strong> feuille. Dans l’onglet <Ui>Corps</Ui>, ils sont dessinés dans leurs
          bandes, pour juger l’ensemble.
        </li>
        <li>
          Leur hauteur est limitée par la bande réservée (réglages de la page, onglet Corps) :{" "}
          <strong>ce qui dépasse est masqué à l’impression</strong>. La mesure de l’onglet dit « … mm occupés
          sur … mm réservés » et si ça tient.
        </li>
        <li>
          On y compose librement : un Panneau avec une hauteur et un fond (couleur ou image), des Colonnes pour aligner
          logo et coordonnées, des Éléments positionnés pour placer un QR ou un picto où l’on veut.
        </li>
        <li>La <Ui>Numérotation</Ui> (« Page 1 / 3 ») ne fonctionne que dans ces deux zones.</li>
        <li>
          Un en-tête ou un pied commun à plusieurs templates gagne à être un <strong>composant</strong> : on le modifie
          une fois pour tous (chapitre 12).
        </li>
      </List>
    </Chapter>
  );
}

export function FeuilleDeStyle() {
  return (
    <Chapter id="feuille-de-style" no="11" title="Feuille de style et polices">
      <P>
        L’onglet <Ui>Feuille de style</Ui> reçoit du CSS appliqué au document imprimé — corps, en-tête et pied. On
        y fait surtout deux choses.
      </P>
      <Sub title="Changer de police">
        <Steps>
          <Step>
            Téléverser le fichier de police (woff2 de préférence) dans la bibliothèque d’images, par exemple{" "}
            <Code>Jost-400.woff2</Code>, ce qui donne la clé <Code>jost-400</Code>.
          </Step>
          <Step>
            Dans la feuille de style, la déclarer, puis en faire la police du texte :
            <pre className="bg-muted mt-2 max-w-full overflow-x-auto rounded p-3 font-mono text-xs leading-5">{`@font-face {
  font-family: "Jost";
  src: url("/assets/shared/jost-400") format("woff2");
  font-weight: 400;
}

:root {
  --font-body: "Jost", Arial, Helvetica, sans-serif;
}`}</pre>
          </Step>
          <Step>Une graisse = un fichier : déclarer un second <Code>@font-face</Code> pour le gras (700).</Step>
        </Steps>
        <P>
          La police voyage dans le PDF. Si le fichier manque, le texte retombe sur Arial, sans erreur.
        </P>
      </Sub>
      <Sub title="Définir ses couleurs">
        <P>
          Une variable déclarée dans <Code>:root</Code> — <Code>--gs-filet: #8c8272;</Code> — s’utilise ensuite dans
          n’importe quel champ couleur : <Code>var(--gs-filet)</Code>. Changer la valeur ici change toute la fiche.
        </P>
        <Note title="Les composants empruntent la feuille du template">
          <p className="m-0">
            Un composant n’a pas de feuille de style propre. S’il utilise <Code>var(--gs-filet)</Code>, chaque
            template qui le place doit déclarer cette variable.
          </p>
        </Note>
      </Sub>
    </Chapter>
  );
}

export function Composants() {
  return (
    <Chapter id="composants" no="12" title="Les composants">
      <P>
        Un composant est un morceau de template réutilisable : un pied de page, un bandeau de coordonnées, un encart de
        garantie. On le compose une fois ; chaque template le cite par le bloc <Ui>Composant</Ui> ; le modifier puis le
        publier change toutes les fiches qui l’utilisent.
      </P>

      <Sub title="Créer un composant">
        <List>
          <li>
            <strong>Depuis l’accueil</strong> : <Ui>Nouveau composant</Ui>, section Composants. Son éditeur
            n’a qu’un onglet, son contenu.
          </li>
          <li>
            <strong>Depuis un template</strong>, sans refaire le travail : grouper les blocs voulus (<Ui>Grouper avec le
            bloc suivant</Ui>), sélectionner le Groupe, puis <Ui>Créer un composant à partir de ce bloc</Ui>. Donner un
            nom (le slug se déduit) ; laisser cochée la case qui <strong>remplace</strong> le groupe par le composant
            dans le template. Le composant est publié aussitôt — sans effet sur les fiches tant que le template
            lui-même n’est pas publié.
          </li>
        </List>
      </Sub>

      <Sub title="Placer, modifier, publier">
        <List>
          <li>
            <strong>Placer</strong> : poser le bloc <Ui>Composant</Ui> (catégorie Composants) et choisir le composant
            dans la liste. La page en montre le contenu, sous l’étiquette « Composant · nom · v3 ».
          </li>
          <li>
            <strong>Modifier</strong> : <Ui>Éditer</Ui> sur sa ligne, à l’accueil. Pas depuis le template.
          </li>
          <li>
            <strong>Publier</strong> : l’éditeur liste d’abord les templates qui le citent ; ils sont{" "}
            <strong>tous republiés automatiquement</strong>, et les boutiques régénèrent leurs fiches. Un brouillon en
            cours sur ces templates n’est pas touché.
          </li>
          <li>Seule la version publiée d’un composant sort sur les fiches.</li>
        </List>
      </Sub>

      <Sub title="Appliquer un composant à plusieurs templates d'un coup">
        <Steps>
          <Step>À l’accueil, <Ui>Appliquer…</Ui> sur la ligne du composant.</Step>
          <Step>Choisir la <Ui>Zone remplacée</Ui> : <Ui>En-tête</Ui> ou <Ui>Pied de page</Ui>.</Step>
          <Step>
            Cocher les templates. Chaque ligne dit ce que la zone contient aujourd’hui (« 3 blocs remplacés par le
            composant », « zone vide ») ; une zone qui cite déjà ce composant n’est pas proposée.
          </Step>
          <Step>
            <Ui>Publier aussitôt les templates modifiés</Ui> est décoché par défaut : les templates reçoivent un
            brouillon. Même cochée, la publication saute les templates qui avaient déjà un brouillon en cours (il serait
            livré avec) et ceux jamais publiés. Le résultat le dit, template par template.
          </Step>
          <Step>Vérifier ensuite, dans chaque template, que la bande réservée est assez haute pour le composant.</Step>
        </Steps>
      </Sub>

      <Sub title="Les règles du jeu">
        <List>
          <li>
            Un composant de boutique remplace, pour cette boutique, le composant de bibliothèque de même slug. Un
            template commun peut ainsi citer <Code>pied-de-page</Code> et recevoir le pied de chaque site.
          </li>
          <li>Un template de bibliothèque ne propose que les composants de bibliothèque.</li>
          <li>Pas de composant dans un composant.</li>
          <li>Un composant encore cité par un template ne se supprime pas : la liste à corriger est affichée.</li>
        </List>
      </Sub>
    </Chapter>
  );
}

export function Publier() {
  return (
    <Chapter id="publier" no="13" title="Vérifier, puis publier">
      <Sub title="Vérifier">
        <List>
          <li>
            <Ui>Contrôler les 7 profils</Ui> rend le template sur chaque produit fictif et dit, pour chacun, le nombre de
            pages et les avertissements. Un profil qui passe à une page de plus que les autres est un signal.
          </li>
          <li>
            <Ui>Aperçu PDF</Ui> ouvre le vrai PDF à côté de la page, rendu par le même moteur que la production. Il se
            rafraîchit tout seul ; on peut l’agrandir et le télécharger.
          </li>
          <li>
            Pour éprouver un brouillon sur de vrais produits : <Ui>Import</Ui>, version <Ui>Brouillon — pour éprouver</Ui>,
            sur quelques lignes d’un export.
          </li>
        </List>
      </Sub>

      <Sub title="Publier">
        <Note kind="warning" title="Publier, c'est livrer en production — tout de suite">
          <p className="m-0">
            Toutes les boutiques qui utilisent ce template le reçoivent : elles constatent le changement de version et
            régénèrent leurs fiches dans les minutes qui suivent. Les templates de la bibliothèque commune sont{" "}
            <strong>partagés entre la recette et la production</strong> : il n’existe pas de publication « en
            recette seulement ».
          </p>
          <p className="m-0">
            Pour expérimenter sans risque : <Ui>Dupliquer un template</Ui>, travailler sur la copie, et ne publier
            l’original qu’une fois sûr.
          </p>
        </Note>
        <List>
          <li><Ui>Publier</Ui> enregistre d’abord, puis met le brouillon en ligne. La version publiée s’affiche en haut.</li>
          <li>Un template jamais publié n’est servi à aucune boutique, et ne peut pas être choisi dans les règles.</li>
          <li>Après publication, l’accueil affiche <Ui>à jour</Ui> dans la colonne Brouillon.</li>
        </List>
      </Sub>
    </Chapter>
  );
}

export function Regles() {
  return (
    <Chapter id="regles" no="14" title="Règles : quel template pour quels produits">
      <P>
        Une boutique peut demander au Studio de choisir lui-même le template de chaque produit. Le menu{" "}
        <Ui>Règles</Ui> dit comment, <strong>boutique par boutique</strong>.
      </P>
      <Steps>
        <Step>Choisir la <Ui>Boutique</Ui>.</Step>
        <Step>
          Choisir son <Ui>Template par défaut</Ui> : celui des produits qu’aucune règle ne vise. Sans défaut, ces
          produits n’ont pas de fiche.
        </Step>
        <Step>
          <Ui>Ajouter une règle</Ui> : un ou plusieurs critères, puis le <Ui>Template à servir</Ui>.
          <List>
            <li>
              <Ui>Sous la catégorie</Ui> : la catégorie et toutes ses sous-catégories, du plus général au plus précis,
              séparées par <Code>&gt;</Code> — <Code>Manutention &gt; Transpalettes</Code>.
            </li>
            <li><Ui>Où dans l’une de ces catégories</Ui> : pour les catégories qui n’arrivent pas dans l’ordre ; séparées par <Code>&gt;</Code> aussi.</li>
            <li><Ui>Marque</Ui> : égalité exacte (accents et majuscules ignorés).</li>
            <li><Ui>Référence</Ui> : un motif, par exemple <Code>^RAY-</Code> pour les références qui commencent par RAY-.</li>
          </List>
        </Step>
        <Step>
          Vérifier avec <Ui>Essayer un produit</Ui> : saisir un fil de catégories (et une marque, une référence), puis{" "}
          <Ui>Quel template ?</Ui>.
        </Step>
      </Steps>
      <List>
        <li>
          Pas d’ordre à gérer : la règle la plus précise l’emporte. <Code>Manutention &gt; Transpalettes</Code> bat{" "}
          <Code>Manutention</Code> ; une règle avec marque bat la même sans marque.
        </li>
        <li>Seuls les templates publiés sont proposés. Une règle se supprime et se recrée ; elle ne se modifie pas.</li>
        <li>
          Le <Ui>Journal</Ui> liste les « Catégories sans règle de template » : c’est là qu’on voit une règle
          devenue inutile après le renommage d’une catégorie.
        </li>
      </List>
    </Chapter>
  );
}

export function Import() {
  return (
    <Chapter id="import" no="15" title="Importer un catalogue">
      <P>
        <Ui>Import</Ui> génère des fiches en série à partir d’un fichier CSV ou JSON, sans passer par une
        boutique : un ZIP de PDF en sortie.
      </P>
      <Steps>
        <Step><strong>Le fichier</strong> : il est lu dans le navigateur, rien n’est envoyé avant la génération.</Step>
        <Step>
          <strong>La correspondance</strong> : pour chaque colonne, le champ de la fiche qu’elle alimente. Elle
          s’exporte et se recharge pour la fois suivante. Pour un export PrestaShop, mettre la virgule comme
          séparateur de listes.
        </Step>
        <Step>
          <strong>Le template et la boutique</strong> : la version <Ui>Publiée</Ui>, ou <Ui>Brouillon — pour
          éprouver</Ui> un template avant de le publier. Un dossier d’images peut fournir les photos.
        </Step>
        <Step>
          <strong>Générer</strong> : filtrer les lignes si besoin, <Ui>Vérifier</Ui> d’abord, puis{" "}
          <Ui>Générer</Ui>. Les échecs se rejouent. Au-delà de 300 fiches, découper le lot : l’archive vit dans
          l’onglet et se perd s’il est fermé.
        </Step>
      </Steps>
    </Chapter>
  );
}

export function Suivi() {
  return (
    <Chapter id="suivi" no="16" title="Consultation, book et journal">
      <List>
        <li>
          <Ui>Consultation</Ui> : les fiches déjà générées par une boutique, triables par catégorie. La recherche
          porte sur le nom, l’identifiant, la référence du produit, celles de ses déclinaisons et ses références
          fournisseur — la ligne dit laquelle a répondu. On en coche (jusqu’à 200) pour les télécharger en ZIP ou
          en faire un <Ui>Book</Ui>. Un éditeur peut changer l’icône d’une catégorie : elle sert aux intercalaires.
        </li>
        <li>
          <Ui>Import produits</Ui> : un book sans rien cocher. On colle les lignes d’un devis ou d’un tableau, telles
          quelles — nom, quantité, prix — et seules les <strong>références fournisseur</strong> sont reconnues. Un{" "}
          <strong>package</strong> (« {"{109445:1,109417:1}"} » : plateau, piètement…) est reconnu quand toutes ses
          références figurent dans le collage ; ce qu’il contient et qui a sa propre fiche (des pieds, une serrure)
          est écarté, et nommé. Le rapport dit ce qui a été trouvé, les références qui désignent plusieurs produits
          (tous ajoutés), et les lignes où rien n’a été reconnu : c’est là qu’un produit manquerait. Puis{" "}
          <Ui>Créer le book</Ui>, ou <Ui>Ajouter à la sélection</Ui> pour compléter à la main.
        </li>
        <li>
          <Ui>Catégories et fiches masquées</Ui> (administrateurs) : ce qui n’est pas fini ou n’a pas de fiche se
          retire de la consultation, boutique par boutique, pour tous les comptes — et ne peut plus entrer ni dans un
          ZIP ni dans un book. Une <strong>catégorie</strong> se masque d’un interrupteur, depuis{" "}
          <Ui>Gérer les catégories et fiches masquées</Ui> (ses sous-catégories suivent). Une <strong>fiche</strong>{" "}
          se masque depuis la consultation : bouton <Ui>Masquer</Ui> de sa ligne, ou <Ui>Masquer ces fiches</Ui> après
          en avoir coché plusieurs ; le produit est masqué dans toutes ses langues. Rien n’est supprimé : on
          réaffiche depuis la même page de réglage.
        </li>
        <li>
          <Ui>Book</Ui> : un PDF unique, couverture et intercalaires compris, des fiches choisies — à ranger, réordonner
          et générer. On y choisit la première et la quatrième de couverture parmi celles de la boutique (ou aucune),
          et, section par section, si l’intercalaire s’imprime — trois fiches d’une catégorie n’ont pas toujours
          besoin de leur page de garde. Les couvertures, autant que nécessaire, et les intercalaires se règlent
          par le super-administrateur. Un <strong>devis client</strong> en PDF peut être joint : il se place à la fin,
          avant la quatrième de couverture, et n’est pas conservé par le Studio — il part avec le book. Il se
          récupère dans l’ERP par sa seule <strong>référence</strong> — il est cherché dans toutes les entités ERP de
          la boutique, celles des grands comptes comprises (Administration › Boutiques) —, ou se téléverse depuis
          le poste. Un PDF protégé par un mot de passe
          d’ouverture est refusé, avec la raison.
        </li>
        <li>
          <Ui>Journal</Ui> : ce que la production a réellement rendu — fiches sorties, échecs, avertissements par
          nature, par template et par boutique. C’est là qu’on voit un picto introuvable ou une image
          d’une autre boutique ignorée. Les aperçus n’y figurent pas.
        </li>
        <li>
          <Ui>Sommaire du book</Ui> : coché par défaut, il suit la couverture — chaque section, chaque fiche et le
          devis avec leur page. On clique sur une ligne pour y aller, et le PDF s’ouvre avec ses signets.
        </li>
      </List>
    </Chapter>
  );
}

export function Pieges() {
  return (
    <Chapter id="pieges" no="17" title="Pièges et aide-mémoire">
      <Sub title="Les pièges, tous rencontrés">
        <DocTable
          head={["Symptôme", "Cause", "Remède"]}
          rows={[
            ["Un picto n'apparaît pas", "Picto blanc sur fond transparent, posé sur du blanc.", "Un fond au bandeau, ou un Panneau coloré autour."],
            ["L'en-tête est coupé", "Bande haute réservée trop faible.", "Augmenter la bande (réglages de la page, onglet Corps)."],
            ["La fiche passe à deux pages pour certains produits", "Une image ou un schéma sans hauteur maximale, un tableau trop étroit.", "Borner les hauteurs ; tableau en pleine largeur ; Contrôler les 7 profils."],
            ["Une image s'affiche dans l'éditeur, pas dans le PDF", "Image téléversée sous la portée d'une autre boutique.", "La téléverser en bibliothèque commune, ou dans la boutique du template."],
            ["Un bloc a disparu de toutes les fiches", "Image supprimée de la bibliothèque.", "La re-téléverser sous la même clé ; le Journal le signale."],
            ["Les fiches n'ont pas changé après un nouveau picto", "Les boutiques ne régénèrent qu'à un changement de version.", "Republier le template."],
            ["Le cadre des images a des côtés irréguliers à l'écran", "Trait de 0,5 pt, plus fin qu'un pixel.", "Épaisseur 1,5 pt."],
            ["Une couleur ne suit pas la boutique", "Couleur écrite en dur.", "var(--color-primary) ou var(--color-secondary)."],
            ["Du HTML apparaît tel quel (<p>…)", "Description longue dans un Paragraphe.", "Bloc Texte riche (HTML)."],
            ["Une modification n'est pas en ligne", "Enregistrée, pas publiée (le bouton « Publish » au-dessus de la page n'enregistre que).", "Publier, depuis la barre du haut."],
          ]}
        />
      </Sub>

      <Sub title="Avant de publier">
        <Steps>
          <Step>Composer en <Ui>Données d’exemple</Ui>, avec le profil de la bonne famille (Vestiaire, Siège, Bureau…).</Step>
          <Step>Chaque image, galerie et schéma a une <Ui>Hauteur maximale</Ui>.</Step>
          <Step>Les couleurs passent par <Code>var(--…)</Code>.</Step>
          <Step>L’en-tête et le pied tiennent dans leurs bandes (onglets En-tête et Pied de page).</Step>
          <Step><Ui>Contrôler les 7 profils</Ui> : même nombre de pages partout, ou un écart compris.</Step>
          <Step><Ui>Aperçu PDF</Ui> relu, en entier.</Step>
          <Step>Publier — en sachant que c’est en production, tout de suite.</Step>
        </Steps>
      </Sub>
    </Chapter>
  );
}
