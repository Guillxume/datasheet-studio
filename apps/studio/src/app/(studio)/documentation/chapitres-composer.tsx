import { VARIABLES } from "@/lib/variables";
import { SAMPLE_PROFILES } from "@/lib/sampleProfiles";
import { Chapter, Code, DocTable, Key, List, Note, P, Step, Steps, Sub, Ui } from "./doc";

/**
 * Documentation, deuxieme partie : l'editeur, la composition, les blocs et les
 * donnees. La liste des tokens et celle des profils sont LUES dans le code
 * (src/lib/variables.ts, src/lib/sampleProfiles.ts) : un token ou un profil
 * ajoute apparait ici sans qu'on y pense.
 */

export function Editeur() {
  return (
    <Chapter id="editeur" no="05" title="Le tour de l'éditeur">
      <P>
        <Ui>Éditer</Ui>, à l’accueil, ouvre l’éditeur en plein écran. La flèche en haut à gauche ramène à
        l’accueil. Le navigateur prévient si vous partez avec des modifications non enregistrées.
      </P>

      <Sub title="La barre du haut">
        <DocTable
          head={["Élément", "À quoi il sert"]}
          rows={[
            [
              <><Ui>Corps</Ui>, <Ui>En-tête (répété)</Ui>, <Ui>Pied de page (répété)</Ui>, <Ui>Feuille de style</Ui></>,
              "Les quatre parties du template. On n'en édite qu'une à la fois. Un composant n'a que le Corps.",
            ],
            [
              <><Ui>Données d’exemple</Ui> / <Ui>Tokens</Ui></>,
              "Données d'exemple : la page montre un vrai produit fictif, à la vraie taille. Tokens : la page montre les {{tokens}} et on peut écrire les titres et paragraphes directement sur la page. Composez la mise en page en Données d'exemple.",
            ],
            [<Ui key="p">Profil</Ui>, "Le produit fictif affiché (voir le chapitre 8). Changez-en souvent."],
            [<Ui key="z">Zoom</Ui>, "100, 85, 70 ou 55 %. Ne change rien au document."],
            [
              "La mesure",
              "« ≈ 2 pages · dernière page remplie à 64 % · … mm de contenu » : ce que la fiche occupera, recalculé en continu. Dans un en-tête ou un pied : la hauteur occupée face à la hauteur réservée.",
            ],
            [<Ui key="v">Variables</Ui>, "La liste des tokens : un clic en copie un, à coller dans un champ."],
            [<Ui key="c">Contrôler les 7 profils</Ui>, "Rend le template sur chaque profil et dit, pour chacun, le nombre de pages et les avertissements (chapitre 13)."],
            [<Ui key="a">Aperçu PDF</Ui>, "Le vrai PDF, par le même moteur que la production, à côté de la page. Il se rafraîchit seul après chaque modification."],
            [<><Ui>Enregistrer</Ui> (<Key>Ctrl</Key>/<Key>⌘</Key> + <Key>S</Key>)</>, "Enregistre le brouillon. Les boutiques ne le voient pas."],
            [<Ui key="pu">Publier</Ui>, "Enregistre puis met le brouillon en ligne, pour toutes les boutiques qui utilisent ce template. Voir le chapitre 13 avant de cliquer."],
          ]}
        />
        <Note kind="warning" title="Le bouton orange « Publish » au-dessus de la page n'est pas « Publier »">
          <p className="m-0">
            Il appartient à l’outil de composition et <strong>enregistre seulement</strong>, comme{" "}
            <Ui>Enregistrer</Ui>. Pour mettre en ligne, c’est le bouton <Ui>Publier</Ui> de la barre du haut.
          </p>
        </Note>
      </Sub>

      <Sub title="Les trois colonnes">
        <List>
          <li>
            <strong>À gauche</strong> : <Ui>Blocs</Ui>, la palette des blocs à poser, rangés par catégorie ; et{" "}
            <Ui>Calques</Ui>, l’arbre de tous les blocs du template (chapitre 6).
          </li>
          <li>
            <strong>Au centre</strong> : la page, à l’échelle. Les bandes hachurées en haut et en bas sont la place
            réservée à l’en-tête et au pied de page répétés ; ils y sont dessinés tels qu’ils sortiront.
          </li>
          <li>
            <strong>À droite</strong> : les réglages du bloc sélectionné. Sans sélection, les réglages de la page :
            format, marges, bandes réservées, espacement entre les blocs (chapitre 9).
          </li>
        </List>
      </Sub>

      <Sub title="Ce que la page vous signale">
        <List>
          <li>
            Un cadre rouge <Ui>absent du PDF</Ui> : ce bloc ne sortira pas pour ce profil, et le cadre dit pourquoi
            (« Ce produit n’a aucune image dans le jeu de données choisi »). Ce n’est pas forcément une erreur
            : un produit sans schéma n’imprime pas de schéma.
          </li>
          <li>
            Un ruban <Ui>débordement : cette page prendra 2 feuilles</Ui> : le contenu d’une page dépasse sa
            hauteur, la suite partira sur une feuille de plus.
          </li>
          <li>
            Une bande d’en-tête hachurée « … mm réservés à l’en-tête — mais cette zone est vide » : de la
            place perdue sur chaque page.
          </li>
          <li>
            Les étiquettes bleues des conteneurs (<Ui>COLONNES 2 — HAUTEUR AUTO</Ui>) : un clic sélectionne le
            conteneur, <Code>⧉</Code> le duplique, <Code>✕</Code> le supprime.
          </li>
        </List>
      </Sub>
    </Chapter>
  );
}

export function Composer() {
  return (
    <Chapter id="composer" no="06" title="Composer une fiche">
      <Sub title="Les pages">
        <List>
          <li>Le corps est fait de pages. <Ui>+ Ajouter une page</Ui>, sous la dernière, en ajoute une.</li>
          <li>
            Une page peut ne s’imprimer que si un champ est rempli : sélectionnez-la, <Ui>Quand imprimer cette
            page</Ui> → <Ui>Seulement si un champ est rempli</Ui>, et indiquez le <Ui>Champ a tester</Ui> — par
            exemple <Code>{"{{accessories.0.name}}"}</Code> pour une page d’accessoires qui ne doit pas sortir vide.
          </li>
          <li>
            Le contenu trop long d’une page continue sur une feuille suivante : une page du Studio peut donner
            plusieurs feuilles imprimées.
          </li>
        </List>
      </Sub>

      <Sub title="Poser, déplacer, sélectionner">
        <Steps>
          <Step>
            <strong>Poser</strong> : glisser un bloc de la palette <Ui>Blocs</Ui> sur la page. Une zone qui s’éclaire
            en pointillés bleus est celle qui le recevra.
          </Step>
          <Step>
            <strong>Déplacer</strong> : glisser le bloc sur la page, ou — plus précis — sa ligne dans <Ui>Calques</Ui>.
          </Step>
          <Step>
            <strong>Sélectionner</strong> : cliquer le bloc. Un conteneur (Colonnes, Panneau, Groupe) se sélectionne
            par son étiquette bleue, ou dans <Ui>Calques</Ui>. Le fil en haut du panneau de droite (<Ui>Page › Colonnes
            › Titre</Ui>) remonte d’un niveau.
          </Step>
        </Steps>
        <Note title="Poser un bloc sous des Colonnes">
          <p className="m-0">
            Une colonne s’agrandit pour accueillir le bloc qu’on survole. Pour le poser <em>après</em> les
            Colonnes, descendez franchement dessous, jusqu’à ce que toute la page s’éclaire — ou passez par{" "}
            <Ui>Calques</Ui>, qui ne se trompe jamais.
          </p>
        </Note>
      </Sub>

      <Sub title="La barre d'action du bloc sélectionné">
        <List>
          <li>La flèche à gauche sélectionne le conteneur parent.</li>
          <li>
            <Ui>Grouper avec le bloc suivant</Ui> : réunit le bloc et son voisin du dessous dans un <strong>Groupe</strong>,
            qui se déplace, se duplique et se supprime comme un seul bloc. Sur un Groupe, la même action y fait entrer
            le voisin suivant. Un Groupe n’ajoute rien à l’impression : ni fond, ni marge.
          </li>
          <li><Ui>Dégrouper</Ui> rend ses blocs au Groupe, à sa place.</li>
          <li>
            <Ui>Créer un composant à partir de ce bloc</Ui> : voir le chapitre 12.
          </li>
          <li>Dupliquer, Supprimer.</li>
        </List>
      </Sub>

      <Sub title="Le panneau Calques">
        <List>
          <li>Tous les blocs du template en arbre, avec une icône par type et le début de leur texte.</li>
          <li>
            <strong>Glisser une ligne</strong> la déplace : un trait orange montre où elle tombera. Moitié haute
            d’une ligne : avant ce bloc ; moitié basse : après lui, ou dans le conteneur s’il est déplié.
          </li>
          <li>
            <Key>Alt</Key> + <Key>↑</Key> / <Key>↓</Key> sur une ligne la monte ou la descend.
          </li>
          <li>Un clic sélectionne le bloc sur la page ; le survol l’entoure.</li>
          <li><Ui>Tout déplier</Ui> / <Ui>Tout replier</Ui> en haut du panneau.</li>
          <li>
            Les dépôts impossibles sont refusés (le curseur l’indique) : un conteneur dans lui-même, un bloc hors
            d’une page.
          </li>
        </List>
      </Sub>

      <Sub title="Raccourcis clavier">
        <DocTable
          head={["Touches", "Effet"]}
          rows={[
            [<><Key>Ctrl</Key>/<Key>⌘</Key> + <Key>Z</Key></>, "Annuler"],
            [<><Key>Ctrl</Key>/<Key>⌘</Key> + <Key>Maj</Key> + <Key>Z</Key>, ou <Key>Ctrl</Key> + <Key>Y</Key></>, "Rétablir"],
            [<><Key>Ctrl</Key>/<Key>⌘</Key> + <Key>S</Key></>, "Enregistrer le brouillon"],
            [<><Key>Suppr</Key> ou <Key>⌫</Key></>, "Supprimer le bloc sélectionné"],
            [<><Key>Alt</Key> + <Key>↑</Key> / <Key>↓</Key></>, "Dans Calques : monter ou descendre le bloc"],
          ]}
        />
      </Sub>
    </Chapter>
  );
}

export function Blocs() {
  return (
    <Chapter id="blocs" no="07" title="Les blocs">
      <P>
        Chaque bloc se règle dans le panneau de droite. Les couleurs acceptent une valeur (<Code>#4a453b</Code>) ou une
        variable (<Code>var(--color-primary)</Code>, la couleur principale de la boutique) ; les tailles sont en
        millimètres (mm) ou, pour le texte et les traits, en points (pt).
      </P>

      <Sub title="Structure — disposer">
        <DocTable
          head={["Bloc", "Usage", "À savoir"]}
          rows={[
            [<strong key="1">Colonnes</strong>, "Mettre des blocs côte à côte (2 ou 3 colonnes).", "« Répartition » : 50/50, 1/2, 2/1, 1/3, 3/1. « Étirer sur toute la hauteur » pour un bandeau latéral coloré qui descend jusqu'en bas. Filet optionnel entre les colonnes."],
            [<strong key="2">Panneau (fond, bordure)</strong>, "Un encadré : fond coloré ou image, bordure, arrondi, marge intérieure.", "« Hauteur fixe » en fait un bandeau. Sert de fond aux Éléments positionnés."],
            [<strong key="3">Groupe</strong>, "Réunir des blocs pour les déplacer ensemble, ou en faire un composant.", "N'imprime rien de plus que ses blocs."],
            [<strong key="4">Élément positionné</strong>, "Poser un élément librement par-dessus son conteneur : un logo dans un coin, un QR sur une image de fond.", "Ancrage (9 points) + décalages en mm. À placer dans un Panneau."],
            [<strong key="5">Espace</strong>, "Ajouter — ou retirer — de la hauteur entre deux blocs.", "Une hauteur négative resserre."],
            [<strong key="6">Filet</strong>, "Un trait horizontal ou vertical.", "Épaisseur en pt, couleur, marge."],
            [<strong key="7">Saut de page</strong>, "Forcer la suite sur la feuille suivante.", "Peut ne couper que si un champ est rempli."],
          ]}
        />
      </Sub>

      <Sub title="Contenu — écrire et illustrer">
        <DocTable
          head={["Bloc", "Usage", "À savoir"]}
          rows={[
            [<strong key="1">Titre</strong>, "Un titre (H1 à H3).", "Accepte les tokens : « {{product.name}} »."],
            [<strong key="2">Paragraphe</strong>, "Du texte simple, tokens compris.", "Du HTML y sortirait tel quel : utiliser Texte riche."],
            [<strong key="3">Texte riche (HTML)</strong>, "La description longue du produit.", "Contenu : {{product.description_html}}. Jusqu'à 3 colonnes de texte."],
            [<strong key="4">Image</strong>, "Un logo, un picto, un visuel.", "Pleine largeur par défaut : réduire la largeur pour un logo, borner la « Hauteur maximale » pour une photo. Bordure, espace intérieur et arrondi réglables."],
          ]}
        />
      </Sub>

      <Sub title="Produit — ce qui vient de la boutique">
        <DocTable
          head={["Bloc", "Usage", "À savoir"]}
          rows={[
            [<strong key="1">Tableau de caractéristiques</strong>, "Les caractéristiques du produit.", "En 2 colonnes, il est deux fois moins haut. Regroupe les caractéristiques de même nom. Fond, zébrage, filets, gras réglables."],
            [<strong key="2">Galerie d'images</strong>, "Les photos du produit.", "« Ignorer les N premières » + « Nombre maximum » choisissent lesquelles ; colonnes, cadre, hauteur maximale."],
            [<strong key="3">Schéma coté</strong>, "Le schéma du produit.", "Borner la hauteur maximale : un schéma en portrait mange sinon la page."],
            [<strong key="4">Bandeau de pictos</strong>, "Les pictos de certification (CE, TÜV, garantie…).", "Une ligne par badge : le badge envoyé par la boutique, le picto à afficher. « garantie » reconnaît toutes les garanties."],
            [<strong key="5">Grille d'informations</strong>, "Des couples libellé / valeur avec icône (coordonnées…).", "Saisie à la main, tokens acceptés."],
            [<strong key="6">QR code</strong>, "Un QR vers la fiche produit.", "Contenu : {{product.url}}. Aucune image à fournir."],
          ]}
        />
      </Sub>

      <Sub title="Choix et détails — ce que le client choisit">
        <DocTable
          head={["Bloc", "Usage", "À savoir"]}
          rows={[
            [<strong key="1">Nuancier de finitions</strong>, "Les coloris et finitions proposés, en pastilles.", "Couleur ou texture par libellé quand la boutique ne l'envoie pas ; « Libellé imprimé » remplace un libellé de back-office peu présentable."],
            [<strong key="2">Bandeau de points clés</strong>, "Des arguments en pictos + libellés (livré monté, garantie 10 ans…).", "Une ligne par badge, avec le libellé imprimé ; un picto absent laisse le libellé seul."],
            [<strong key="3">Grille de fiches</strong>, "Des fiches avec photo : accessoires, options, fermetures.", "Source : les accessoires du produit, ou des fiches saisies à la main filtrées par une finition. Cadre des images : 1,5 pt pour un trait régulier à l'écran."],
          ]}
        />
      </Sub>

      <Sub title="Bandeaux et composants">
        <DocTable
          head={["Bloc", "Usage", "À savoir"]}
          rows={[
            [<strong key="1">Bandeau d’en-tête</strong>, "Un en-tête prêt à l'emploi : titre, logo, fond.", "Raccourci : un Panneau composé à la main donne plus de liberté."],
            [<strong key="2">Bandeau de pied de page</strong>, "Un pied prêt à l'emploi, avec numérotation.", "Idem."],
            [<strong key="3">Numérotation</strong>, "« Page 1 / 3 ».", "Ne fonctionne que dans l'en-tête ou le pied de page."],
            [<strong key="4">Composant</strong>, "Placer un composant (chapitre 12).", "Choisir le composant dans la liste."],
          ]}
        />
      </Sub>
    </Chapter>
  );
}

export function Donnees() {
  const groups = VARIABLES.reduce<Record<string, typeof VARIABLES>>((into, variable) => {
    (into[variable.group] ??= []).push(variable);
    return into;
  }, {});

  return (
    <Chapter id="donnees" no="08" title="Les données du produit">
      <Sub title="Les tokens">
        <P>
          Un token est un emplacement entre doubles accolades, remplacé au rendu par la donnée du produit :{" "}
          <Code>{"{{product.name}}"}</Code> devient « Transpalette manuel 2500 kg ». Il se colle dans n’importe
          quel champ texte, seul ou dans une phrase : <Code>{"Réf. {{product.sku}}"}</Code>.
        </P>
        <List>
          <li>
            Les tokens marqués <strong>liste</strong> (<Code>{"{{features}}"}</Code>, <Code>{"{{images}}"}</Code>…)
            alimentent un bloc répété — tableau, galerie, bandeau — et ne s’écrivent pas dans une phrase.
          </li>
          <li>
            Dans une liste, un élément se désigne par son rang : <Code>{"{{images.0.src}}"}</Code> la première image,{" "}
            <Code>{"{{images.last.src}}"}</Code> la dernière, <Code>{"{{images.last-1.src}}"}</Code> l’avant-dernière.
          </li>
          <li>
            Le bouton <Ui>Variables</Ui> de l’éditeur affiche cette liste ; un clic copie le token.
          </li>
        </List>
        <DocTable
          head={["Groupe", "Token", "Ce que c'est"]}
          rows={Object.entries(groups).flatMap(([group, items]) =>
            items.map((variable, index) => [
              index === 0 ? <strong key={group}>{group}</strong> : "",
              <Code key={variable.token}>{variable.token}</Code>,
              variable.kind === "list" ? `${variable.label} (liste)` : variable.label,
            ])
          )}
        />
      </Sub>

      <Sub title="Les profils d'exemple">
        <P>
          Le sélecteur <Ui>Profil</Ui> change le produit fictif affiché. Un template se juge sur tous : celui qui tient
          sur le profil typique passe souvent à deux pages sur le profil dense.
        </P>
        <DocTable
          head={["Profil", "Ce qu'il éprouve"]}
          rows={SAMPLE_PROFILES.map((profile) => [<strong key={profile.id}>{profile.label}</strong>, profile.purpose])}
        />
      </Sub>

      <Sub title="Badges et finitions : ce que la boutique envoie">
        <List>
          <li>
            Les <strong>badges</strong> sont des clés courtes posées par la boutique : <Code>ce</Code>,{" "}
            <Code>tuv</Code>, <Code>garantie:3-ans</Code>, <Code>livre-monte</Code>… Le Bandeau de pictos et le
            Bandeau de points clés font correspondre chaque clé à un picto et à un libellé. La correspondance se fait
            sur le début : <Code>garantie</Code> reconnaît <Code>garantie:3-ans</Code> comme <Code>garantie:5-ans</Code>.
          </li>
          <li>
            Les <strong>finitions</strong> arrivent avec les libellés du back-office (« A code electronique »). Le
            rapprochement ignore casse, accents et espaces en trop ; le <Ui>Libellé imprimé</Ui> dit ce que la fiche
            affiche.
          </li>
        </List>
      </Sub>

      <Sub title="Les couleurs de la boutique">
        <P>
          Écrivez <Code>var(--color-primary)</Code> et <Code>var(--color-secondary)</Code> plutôt qu’une couleur
          fixe : chaque boutique y met la sienne, et un même template de bibliothèque sert ainsi plusieurs marques. Une
          couleur fixe ne se justifie que si elle doit être la même partout.
        </P>
      </Sub>
    </Chapter>
  );
}
