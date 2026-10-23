/**
 * Variables disponibles dans les templates.
 *
 * SOURCE UNIQUE, consommee par deux endroits qui doivent dire la meme chose :
 *   - GET /api/v1/schema, pour l'aide du back-office PrestaShop ;
 *   - le panneau « Variables » de l'editeur.
 *
 * Deux descriptions divergentes du meme contrat feraient ecrire a un integrateur
 * un token qui ne resoudra jamais.
 *
 * Tenu a jour a la main, en miroir de src/lib/payload.ts.
 */

export type VariableKind = "text" | "html" | "image" | "list";

export type Variable = {
  token: string;
  label: string;
  kind: VariableKind;
  group: string;
};

export const VARIABLES: Variable[] = [
  { group: "Produit", token: "{{product.name}}", label: "Nom du produit", kind: "text" },
  { group: "Produit", token: "{{product.sku}}", label: "Référence", kind: "text" },
  { group: "Produit", token: "{{product.gtin}}", label: "Code-barres (EAN/GTIN)", kind: "text" },
  { group: "Produit", token: "{{product.mpn}}", label: "Référence fabricant", kind: "text" },
  { group: "Produit", token: "{{product.brand}}", label: "Marque", kind: "text" },
  { group: "Produit", token: "{{product.url}}", label: "URL de la fiche produit", kind: "text" },
  { group: "Produit", token: "{{product.description_short}}", label: "Accroche", kind: "text" },
  { group: "Produit", token: "{{product.description_html}}", label: "Description longue", kind: "html" },

  { group: "Prix", token: "{{product.price.formatted}}", label: "Prix formaté — à utiliser", kind: "text" },
  { group: "Prix", token: "{{product.price.amount}}", label: "Montant brut", kind: "text" },
  { group: "Prix", token: "{{product.price.currency}}", label: "Devise", kind: "text" },

  { group: "Listes", token: "{{features}}", label: "Caractéristiques", kind: "list" },
  { group: "Listes", token: "{{images}}", label: "Images produit", kind: "list" },
  { group: "Listes", token: "{{badges}}", label: "Badges (CE, garantie, TÜV…)", kind: "list" },
  { group: "Listes", token: "{{category_path}}", label: "Fil d'Ariane des catégories", kind: "list" },

  { group: "Choix client", token: "{{finishes}}", label: "Groupes de finitions (coloris, fermeture…)", kind: "list" },
  { group: "Choix client", token: "{{accessories}}", label: "Accessoires en option", kind: "list" },

  // Libelles courts et symetriques : le panneau de l'editeur rend ce texte en
  // `white-space: nowrap` avec ellipsis dans une colonne de 15rem. Une phrase
  // explicative y serait coupee en plein milieu — elle va dans les notes.
  { group: "Images", token: "{{images.0.src}}", label: "Première image", kind: "image" },
  { group: "Images", token: "{{images.last.src}}", label: "Dernière image", kind: "image" },
  { group: "Images", token: "{{images.last-1.src}}", label: "Avant-dernière image", kind: "image" },
  { group: "Images", token: "{{schema_image.src}}", label: "Schéma coté", kind: "image" },
  { group: "Images", token: "{{detail_image.src}}", label: "Visuel des détails (légendes incrustées)", kind: "image" },
  { group: "Images", token: "{{shop.logo}}", label: "Logo de la boutique", kind: "image" },

  { group: "Boutique", token: "{{shop.name}}", label: "Nom de la boutique", kind: "text" },
  { group: "Boutique", token: "{{shop.url}}", label: "URL de la boutique", kind: "text" },
  { group: "Boutique", token: "{{shop.company.address}}", label: "Adresse", kind: "text" },
  { group: "Boutique", token: "{{shop.company.phone}}", label: "Téléphone", kind: "text" },
  { group: "Boutique", token: "{{shop.company.email}}", label: "Courriel", kind: "text" },
  { group: "Boutique", token: "{{shop.company.legal}}", label: "Mentions légales", kind: "text" },
];

export const VARIABLE_NOTES = [
  "Un token seul dans un champ renvoie la valeur typee : {{features}} alimente un tableau.",
  'Un token dans une phrase est interpole : "Ref. {{product.sku}}".',
  "Les couleurs de la boutique s'ecrivent var(--color-primary) et var(--color-secondary).",
  "Un picto de la bibliotheque s'ecrit /assets/shared/<cle> ou /assets/<boutique>/<cle>.",
  "Pictos et couleurs des finitions se reglent SUR LE BLOC, pas dans le payload : la boutique n'envoie que les libelles.",
  "« last » designe le dernier element d'une liste : {{images.last.src}}, {{features.last.value}} ; « last-1 » l'avant-dernier : {{images.last-1.src}}. Un indice fixe suppose que toutes les fiches ont le meme nombre d'images, ce qui n'est vrai sur aucun catalogue.",
  "ATTENTION : « last » designe la derniere image RECUE, pas la derniere du produit. La boutique tronque son envoi (reglage « Images produit maximum » du connecteur) : avec un plafond a 6, un produit qui en a 10 fait de la 6e sa derniere. Relever le plafond si des produits depassent.",
  "Les champs custom.* dependent de la boutique et ne sont pas listes ici.",
];
