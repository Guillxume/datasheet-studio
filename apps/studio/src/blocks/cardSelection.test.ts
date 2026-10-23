import { test } from "node:test";
import assert from "node:assert/strict";
import { selectCards } from "./registry";

/**
 * LA GRILLE QUI ANNONCE UNE OPTION INEXISTANTE.
 *
 * C'est le seul defaut de ce bloc qui produise un document FAUX plutot que
 * vide, et rien dans le PDF ne le signale. Les fiches de fermetures sont
 * saisies une fois pour les dix-sept vestiaires, mais chaque produit n'en
 * propose qu'une partie : sans filtrage, une fiche annonce un cadenas et deux
 * serrures a code sur un vestiaire qui n'offre que la fermeture a cles. Le
 * client commande une option qui n'existe pas.
 *
 * Les libelles des valeurs sont ceux de l'export du catalogue Acme
 * (« A code electronique », sans accent), ceux des fiches sont ceux qu'on
 * imprime.
 */

/**
 * Le NOM est celui qu'on imprime, `match` la valeur telle que le catalogue la
 * stocke. Les deux different sur trois des quatre fermetures, ce qui est
 * exactement le cas que le champ existe pour traiter.
 */
const FICHES = [
  { name: "Fermeture à clés", match: "Clés", description: "deux clés fournies" },
  { name: "Moraillon porte cadenas", match: "Cadenas", description: "cadenas en option" },
  { name: "Serrure à code manuelle", match: "A code", description: "serrure mécanique" },
  { name: "Serrure à code électronique", match: "A code electronique", description: "clavier" },
];

const groupe = (label: string, valeurs: string[]) => [
  { label, options: valeurs.map((v) => ({ label: v })) },
];

test("seules les fermetures reellement proposees sont affichees", () => {
  const out = selectCards(groupe("Fermeture", ["Clés", "A code"]), FICHES, "Fermeture");

  assert.deepEqual(
    out.map((c) => c.name),
    ["Fermeture à clés", "Serrure à code manuelle"],
    "le cadenas et la serrure electronique ne sont pas proposes par ce produit"
  );
});

test("un produit qui n'offre qu'une fermeture n'en montre qu'une", () => {
  const out = selectCards(groupe("Fermeture", ["Clés"]), FICHES, "Fermeture");

  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Fermeture à clés");
});

test("l'ordre est celui du catalogue, pas celui de la saisie", () => {
  // Les fiches sont saisies dans l'ordre cles, cadenas, code, code
  // electronique. Le produit, lui, decline dans un autre ordre — et c'est le
  // sien qui doit s'imprimer : il reflete la facon dont l'offre est presentee.
  const out = selectCards(groupe("Fermeture", ["A code electronique", "Clés"]), FICHES, "Fermeture");

  assert.deepEqual(
    out.map((c) => c.name),
    ["Serrure à code électronique", "Fermeture à clés"]
  );
});

test("un autre groupe de finitions ne filtre rien de ce groupe-ci", () => {
  // Le produit decline des coloris ET des fermetures : lire le mauvais groupe
  // afficherait des cartes de fermeture nommees d'apres des couleurs, ou rien.
  const finitions = [
    { label: "Coloris des portes", options: [{ label: "Bleu" }, { label: "Gris" }] },
    { label: "Fermeture", options: [{ label: "Cadenas" }] },
  ];

  assert.deepEqual(
    selectCards(finitions, FICHES, "Fermeture").map((c) => c.name),
    ["Moraillon porte cadenas"]
  );
  assert.deepEqual(selectCards(finitions, FICHES, "Coloris des portes"), []);
});

test("le rapprochement absorbe la casse et les accents du catalogue", () => {
  // L'export porte « A code electronique » sans accent ; le nom du groupe peut
  // etre saisi « fermeture » en minuscules dans le template.
  const out = selectCards(groupe("Fermeture", ["A CODE ELECTRONIQUE"]), FICHES, "fermeture");

  assert.deepEqual(
    out.map((c) => c.name),
    ["Serrure à code électronique"]
  );
});

test("une valeur sans fiche saisie est ecartee, pas rendue vide", () => {
  // Une cinquieme fermeture apparaitrait au catalogue avant que quiconque ait
  // ecrit sa documentation. Mieux vaut l'omettre qu'imprimer une carte muette.
  const out = selectCards(groupe("Fermeture", ["Clés", "Monnayeur"]), FICHES, "Fermeture");

  assert.deepEqual(
    out.map((c) => c.name),
    ["Fermeture à clés"]
  );
});

test("sans groupe, la source du payload passe telle quelle", () => {
  const accessoires = [{ name: "Coiffe inclinée" }, { name: "Pieds métal" }];

  assert.deepEqual(
    selectCards(accessoires, FICHES, "").map((c) => c.name),
    ["Coiffe inclinée", "Pieds métal"]
  );
});

test("source vide = toutes les fiches saisies, sans filtrage", () => {
  assert.equal(selectCards("", FICHES, "").length, 4);
  // Et le groupe est sans effet dans ce mode : la saisie fait autorite.
  assert.equal(selectCards("", FICHES, "Fermeture").length, 4);
});

test("aucune source ne sert de repli a une autre", () => {
  // Un produit sans accessoire ne doit PAS se mettre a afficher les fiches
  // saisies : une fiche au hasard du catalogue montrerait une liste que
  // personne n'a voulue la.
  assert.deepEqual(selectCards([], FICHES, ""), []);
  // Et un groupe absent du produit ne retombe pas sur la saisie complete.
  assert.deepEqual(selectCards(groupe("Coloris", ["Bleu"]), FICHES, "Fermeture"), []);
});

/* ------------------------------------------------------------------ OPTIONS */

/**
 * LE CATALOGUE NOMME PAR TYPE ET PAR TAILLE, LA PHOTO DOCUMENTE LE TYPE.
 *
 * « Socle banc L.30cm » jusqu'a « L.120cm » designent le meme objet : six
 * longueurs d'un banc dont la boutique a fourni UNE photo. Le rapprochement
 * exact ne pouvait rien en faire, et la fiche sortait sans ses options.
 */

const OPTIONS = [
  { name: "Socle banc rétractable", match: "Socle banc rétractable", description: "se range sous le vestiaire" },
  { name: "Socle banc", match: "Socle banc", description: "banc fixe à lattes bois" },
  { name: "Pieds", match: "Pieds", description: "époxy ou inox" },
  { name: "Coiffe inclinée", match: "Coiffe", description: "empêche le dépôt d'objets" },
];

test("une fiche repond pour toutes les tailles de son option", () => {
  const out = selectCards(
    groupe("Option socle banc", ["Socle banc L.30cm", "Socle banc L.90cm", "Socle banc L.120cm "]),
    OPTIONS,
    "Option socle banc"
  );

  assert.deepEqual(out.map((c) => c.name), ["Socle banc"], "trois tailles, une seule fiche");
});

test("le prefixe le plus long gagne", () => {
  // Sans cette regle, « Socle banc » repondrait aussi pour le retractable, qui
  // est un autre produit et a sa propre photo.
  const out = selectCards(
    groupe("Option socle banc", ["Socle banc L.30cm", "Socle banc rétractable L30 cm"]),
    OPTIONS,
    "Option socle banc"
  );

  assert.deepEqual(out.map((c) => c.name), ["Socle banc", "Socle banc rétractable"]);
});

test("les valeurs « Sans ... » ne rapprochent rien", () => {
  // Elles designent l'absence d'option : les imprimer annoncerait un produit.
  const out = selectCards(
    groupe("Option socle banc", ["Sans socle banc", "Socle banc L.40cm"]),
    OPTIONS,
    "Option socle banc"
  );

  assert.deepEqual(out.map((c) => c.name), ["Socle banc"]);
});

test("le prefixe s'arrete sur une espace, jamais au milieu d'un mot", () => {
  // « Cle » ne doit pas repondre pour « Cles » : sans frontiere, une fiche d'un
  // ou deux caracteres repondrait pour une bonne partie du catalogue.
  assert.deepEqual(selectCards(groupe("Fermeture", ["Clés"]), [{ name: "Clé", match: "Clé" }], "Fermeture"), []);
});

test("l'egalite exacte reste prioritaire sur le prefixe", () => {
  // « A code » est un prefixe de « A code electronique », mais les deux ont leur
  // fiche : la serrure electronique ne doit pas recevoir la photo de la manuelle.
  const out = selectCards(groupe("Fermeture", ["A code electronique", "A code"]), FICHES, "Fermeture");

  assert.deepEqual(out.map((c) => c.name), ["Serrure à code électronique", "Serrure à code manuelle"]);
});

test("plusieurs groupes alimentent une seule grille", () => {
  // Les options d'un vestiaire vivent dans trois groupes distincts mais forment
  // une seule rubrique : une grille par groupe imposerait trois titres.
  const finitions = [
    { label: "Coiffe inclinée", options: [{ label: "Coiffe L.60cm" }] },
    { label: "Option pieds", options: [{ label: "Pieds inox" }, { label: "Sans option" }] },
    { label: "Coloris", options: [{ label: "Bleu" }] },
  ];

  const out = selectCards(finitions, OPTIONS, "Coiffe inclinée, Option pieds");

  assert.deepEqual(out.map((c) => c.name), ["Coiffe inclinée", "Pieds"]);
});

test("un groupe absent de la liste n'apporte rien", () => {
  const finitions = [{ label: "Coloris", options: [{ label: "Bleu" }] }];

  assert.deepEqual(selectCards(finitions, OPTIONS, "Coiffe inclinée, Option pieds"), []);
});

/* ------------------------------------ OPTIONS DE BUREAU : LE GROUPE PORTE LE SENS */

/**
 * PARFOIS C'EST LE GROUPE QU'ON DOCUMENTE, PAS LA VALEUR.
 *
 * Le catalogue decline « Retour » en « Droit » et « Gauche » : la fiche
 * documente le retour accroche, pas le cote choisi. Rapprocher par valeur
 * obligerait a saisir deux fiches identiques.
 *
 * Et « Voile de fond » se decline en « Voile de fond » et « Sans voile de
 * fond » : un bureau qui ne propose que l'absence ne doit pas allumer la fiche.
 */

const OPTIONS_BUREAU = [
  { name: "Voile de fond", matchGroup: "Voile de fond" },
  { name: "Goulotte", matchGroup: "Goulotte" },
  { name: "Retour accroché", matchGroup: "Retour" },
  { name: "Obturateurs", match: "Obturateurs" },
];

const GROUPES_BUREAU = "Voile de fond, Goulotte, Retour, Option";

test("une fiche se rapproche du groupe quand les valeurs n'en disent rien", () => {
  const finitions = [{ label: "Retour", options: [{ label: "Droit" }, { label: "Gauche" }] }];

  const out = selectCards(finitions, OPTIONS_BUREAU, GROUPES_BUREAU, "Sans");

  assert.deepEqual(out.map((c) => c.name), ["Retour accroché"], "deux cotes, une seule fiche");
});

test("un groupe qui n'offre que l'absence n'allume pas sa fiche", () => {
  const finitions = [{ label: "Voile de fond", options: [{ label: "Sans voile de fond" }] }];

  assert.deepEqual(selectCards(finitions, OPTIONS_BUREAU, GROUPES_BUREAU, "Sans"), []);
});

test("le meme groupe allume sa fiche des qu'une valeur reelle existe", () => {
  const finitions = [
    { label: "Voile de fond", options: [{ label: "Sans voile de fond" }, { label: "Voile de fond " }] },
  ];

  assert.deepEqual(selectCards(finitions, OPTIONS_BUREAU, GROUPES_BUREAU, "Sans").map((c) => c.name), [
    "Voile de fond",
  ]);
});

test("le rapprochement par valeur reste prioritaire sur celui par groupe", () => {
  // « Obturateurs » est une valeur du groupe « Option » ; aucune fiche ne vise
  // ce groupe, mais une fiche vise cette valeur.
  const finitions = [
    { label: "Option", options: [{ label: "Obturateurs" }, { label: "Sans prise" }] },
  ];

  assert.deepEqual(selectCards(finitions, OPTIONS_BUREAU, GROUPES_BUREAU, "Sans").map((c) => c.name), [
    "Obturateurs",
  ]);
});

test("les trois options d'un bureau sortent dans l'ordre du catalogue", () => {
  const finitions = [
    { label: "Goulotte", options: [{ label: "Goulotte simple " }, { label: "Sans Goulotte" }] },
    { label: "Retour", options: [{ label: "Gauche" }] },
    { label: "Voile de fond", options: [{ label: "Voile de fond " }] },
    { label: "Coloris Plateau", options: [{ label: "Blanc" }] },
  ];

  assert.deepEqual(selectCards(finitions, OPTIONS_BUREAU, GROUPES_BUREAU, "Sans").map((c) => c.name), [
    "Goulotte",
    "Retour accroché",
    "Voile de fond",
  ]);
});

test("une fiche peut viser plusieurs libelles du catalogue", () => {
  // La cloison d'un bureau n'est pas nommee : le catalogue decline sa matiere
  // et sa teinte — « Tissu Gris », « Polycarbonate blanc » — a cote de « Sans
  // cloison ». Ce que la fiche documente est sa presence, pas sa couleur.
  const cartes = [{ name: "Cloison séparatrice", match: "Tissu, Polycarbonate" }];
  const finitions = [
    {
      label: "Coloris cloison",
      options: [
        { label: "Sans cloison" },
        { label: "Tissu Gris" },
        { label: "Tissu Vert" },
        { label: "Polycarbonate blanc" },
      ],
    },
  ];

  const out = selectCards(finitions, cartes, "Coloris cloison", "Sans");

  assert.deepEqual(out.map((c) => c.name), ["Cloison séparatrice"], "quatre valeurs, une seule fiche");
});

test("un bureau sans cloison n'allume pas sa fiche", () => {
  const cartes = [{ name: "Cloison séparatrice", match: "Tissu, Polycarbonate" }];
  const finitions = [{ label: "Coloris cloison", options: [{ label: "Sans cloison" }, { label: "Chêne clair" }] }];

  assert.deepEqual(selectCards(finitions, cartes, "Coloris cloison", "Sans"), []);
});

test("un retour non accroche n'est pas une option", () => {
  // Le groupe « Retour » se decline en « Droit » et « Gauche ». J'en avais
  // conclu qu'il designait toujours un retour accroche : c'est faux, un retour
  // peut etre porte autrement, et il fait alors partie du produit.
  const cartes = [{ name: "Retour accroché", match: "Retour accroché" }];

  assert.deepEqual(
    selectCards([{ label: "Retour", options: [{ label: "Droit" }, { label: "Gauche" }] }], cartes, "Retour", "Sans"),
    [],
    "un retour simple ne doit pas allumer la fiche"
  );
});

test("le retour accroche s'allume sur son libelle, suffixe compris", () => {
  // La fiche de reference l'ecrit « Retour accroché (80 x 60 cm) ».
  const cartes = [{ name: "Retour accroché", match: "Retour accroché" }];
  const finitions = [{ label: "Option", options: [{ label: "Retour accroché (80 x 60 cm)" }] }];

  assert.deepEqual(selectCards(finitions, cartes, "Option", "Sans").map((c) => c.name), ["Retour accroché"]);
});

/* --------------------------------- LES OPTIONS VENUES DES CARACTERISTIQUES */

/**
 * LE CATALOGUE DECRIT LA MEME OPTION DE DEUX FACONS.
 *
 * En DECLINAISON quand le client choisit — « Type d'accoudoirs : 1 D, 3 D » — et
 * en CARACTERISTIQUE quand elle est actee — « Accoudoirs : Accoudoirs 3D ». La
 * seconde couvre d'ailleurs plus de produits : 95 contre 39 sur ce catalogue.
 *
 * Ne lire que les declinaisons laissait donc la majorite des fiches sans leurs
 * options, sans que rien ne le signale.
 */

const CARTES_SIEGE = [
  { name: "Accoudoirs 1D", match: "1 D, Accoudoirs 1D" },
  { name: "Accoudoirs multidirectionnels", match: "3 D, Accoudoirs 3D" },
  { name: "Têtière", matchGroup: "Option têtière" },
];

test("une caracteristique alimente les fiches comme une declinaison", () => {
  const caracteristiques = [
    { name: "Accoudoirs", value: "Accoudoirs 3D" },
    { name: "Poids (kg)", value: "20" },
  ];

  const out = selectCards("", CARTES_SIEGE, "Accoudoirs", "Sans", caracteristiques);

  assert.deepEqual(out.map((c) => c.name), ["Accoudoirs multidirectionnels"]);
});

test("une option decrite des deux facons ne sort qu'une fois", () => {
  const finitions = [{ label: "Type d'accoudoirs", options: [{ label: "3 D" }] }];
  const caracteristiques = [{ name: "Accoudoirs", value: "Accoudoirs 3D" }];

  const out = selectCards(finitions, CARTES_SIEGE, "Type d'accoudoirs, Accoudoirs", "Sans", caracteristiques);

  assert.deepEqual(out.map((c) => c.name), ["Accoudoirs multidirectionnels"], "la fiche est imprimee deux fois");
});

test("une caracteristique a valeurs regroupees en produit plusieurs", () => {
  // Le collecteur fusionne les doublons en separant par un saut de ligne.
  const caracteristiques = [{ name: "Accoudoirs", value: "Accoudoirs 1D\nAccoudoirs 3D" }];

  const out = selectCards("", CARTES_SIEGE, "Accoudoirs", "Sans", caracteristiques);

  assert.deepEqual(out.map((c) => c.name), ["Accoudoirs 1D", "Accoudoirs multidirectionnels"]);
});

test("sans source complementaire, le comportement d'avant est intact", () => {
  const finitions = [{ label: "Type d'accoudoirs", options: [{ label: "1 D" }] }];

  assert.deepEqual(
    selectCards(finitions, CARTES_SIEGE, "Type d'accoudoirs", "Sans").map((c) => c.name),
    ["Accoudoirs 1D"]
  );
});

test("une fiche peut se reconnaitre par la valeur ET par le groupe", () => {
  // « Roulettes » se lit a la valeur « Roulettes autobloquantes » dans le groupe
  // « Type piétement », et au groupe « Roulettes » quand une caracteristique
  // repond « Oui ». Deux fiches repeteraient la meme photo.
  const cartes = [{ name: "Roulettes", match: "Roulettes autobloquantes", matchGroup: "Roulettes" }];

  assert.deepEqual(
    selectCards(
      [{ label: "Type piétement", options: [{ label: "Roulettes autobloquantes" }] }],
      cartes,
      "Type piétement, Roulettes",
      "Sans, Non"
    ).map((c) => c.name),
    ["Roulettes"]
  );

  assert.deepEqual(
    selectCards("", cartes, "Type piétement, Roulettes", "Sans, Non", [{ name: "Roulettes", value: "Oui" }]).map(
      (c) => c.name
    ),
    ["Roulettes"]
  );

  // « Non » est une absence : la fiche ne doit pas s'allumer.
  assert.deepEqual(
    selectCards("", cartes, "Roulettes", "Sans, Non", [{ name: "Roulettes", value: "Non" }]),
    []
  );
});

test("une fiche peut viser plusieurs groupes", () => {
  // Le socle d'un vestiaire est decrit dans « Socle casier », « Option socle »
  // ou « Plinthe » selon le produit, et tous se declinent en « Avec » et
  // « Sans ». Trois fiches auraient repete la meme photo.
  const cartes = [{ name: "Socle", matchGroup: "Socle casier, Option socle, Plinthe" }];
  const cibles = "Socle casier, Option socle, Plinthe";

  for (const groupe of ["Socle casier", "Option socle", "Plinthe"]) {
    assert.deepEqual(
      selectCards([{ label: groupe, options: [{ label: "Avec socle " }] }], cartes, cibles, "Sans").map((c) => c.name),
      ["Socle"],
      `le groupe « ${groupe} » n'allume pas la fiche`
    );
  }

  // Les trois a la fois : une seule fiche, pas trois.
  const trois = ["Socle casier", "Option socle", "Plinthe"].map((label) => ({
    label,
    options: [{ label: "Avec" }],
  }));
  assert.deepEqual(selectCards(trois, cartes, cibles, "Sans").map((c) => c.name), ["Socle"]);
});

/* ------------------------------------ LE TROU N'EST PAS UNE OPTION */

/**
 * « Flap » ou « Obturateur » seul designe le passage de cables du plateau — un
 * trou que tout bureau possede. Seule la version CONNECTEE, celle qui porte des
 * prises, s'achete en plus.
 *
 * Le rapprochement par prefixe rendait la distinction intenable : une fiche
 * visant « Flap » attrapait « Flap connecté » comme le trou nu.
 */

const CARTES_PLATEAU = [
  { name: "Flap connecté", match: "Flap connecté" },
  { name: "Obturateur connecté", match: "Obturateur connecté, Avec prise connectée, Insert 2 prises" },
];

test("un flap ou un obturateur nu n'est pas une option", () => {
  const nus = [{ label: "Option", options: [{ label: "Flap" }, { label: "Obturateurs" }] }];

  assert.deepEqual(selectCards(nus, CARTES_PLATEAU, "Option", "Sans"), []);
});

test("connectes, les deux sortent — quel que soit le nom du catalogue", () => {
  const cas: Array<[string, string]> = [
    ["Flap connecté", "Flap connecté"],
    ["Obturateur connecté", "Obturateur connecté"],
    ["Avec prise connectée", "Obturateur connecté"],
    ["Insert 2 prises", "Obturateur connecté"],
  ];

  for (const [valeur, attendu] of cas) {
    assert.deepEqual(
      selectCards([{ label: "Option", options: [{ label: valeur }] }], CARTES_PLATEAU, "Option", "Sans").map(
        (c) => c.name
      ),
      [attendu],
      `« ${valeur} » ne rapproche pas « ${attendu} »`
    );
  }
});

test("le trou et l'option connectee cohabitent sans se confondre", () => {
  // Un bureau qui offre les deux : seule la connectee compte comme option.
  const melange = [{ label: "Option", options: [{ label: "Obturateurs" }, { label: "Flap connecté" }] }];

  assert.deepEqual(
    selectCards(melange, CARTES_PLATEAU, "Option", "Sans").map((c) => c.name),
    ["Flap connecté"]
  );
});
