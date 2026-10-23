import qrcode from "qrcode-generator";

/**
 * Generation de QR code, SYNCHRONE et sans dependance native.
 *
 * L'ancien module PrestaShop generait le QR avec mpdf/qrcode. Le nouveau module
 * n'a aucune dependance Composer, la generation revient donc au Studio.
 *
 * Le choix de qrcode-generator plutot que du paquet `qrcode`, plus connu, est
 * dicte par une contrainte du pipeline : `qrcode` n'expose qu'une API a promesses,
 * alors que le rendu des blocs est synchrone. Ici, tout est synchrone, donc le QR
 * peut etre produit dans le bloc lui-meme — ce qui le fait apparaitre a l'identique
 * dans l'apercu de l'editeur et dans le PDF, sans etape de preparation.
 *
 * Sortie en SVG : net a toute taille d'impression, contrairement a un PNG dont il
 * faudrait deviner la resolution.
 */

export type QrOptions = {
  /** Couleur des modules. Un QR clair sur fond sombre reste lisible si le contraste est respecte. */
  dark?: string;
  /** Fond. Laisser vide pour un QR transparent. */
  light?: string;
  /** Marge blanche en modules. La norme recommande 4 ; 2 suffit en pratique sur un imprime. */
  margin?: number;
};

const COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|var\(--[a-zA-Z0-9-]+\))$/;

const safeColor = (value: string | undefined, fallback: string): string =>
  value !== undefined && value !== "" && COLOR.test(value) ? value : fallback;

/**
 * @returns data URI SVG, ou null si le contenu est vide ou trop long pour un QR
 */
export function qrSvgDataUri(text: string, options: QrOptions = {}): string | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }

  try {
    // typeNumber 0 = choix automatique de la version selon la longueur.
    // Correction 'M' : le compromis usuel, ~15 % de redondance, suffisant pour un
    // document imprime qui peut etre plie ou legerement sali.
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const margin = Math.max(0, Math.min(8, options.margin ?? 2));
    const size = count + margin * 2;

    let path = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) {
          path += `M${col + margin} ${row + margin}h1v1h-1z`;
        }
      }
    }

    const light = options.light !== undefined && options.light !== "" ? safeColor(options.light, "") : "";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
      (light !== "" ? `<rect width="${size}" height="${size}" fill="${light}"/>` : "") +
      `<path d="${path}" fill="${safeColor(options.dark, "#000000")}"/>` +
      `</svg>`;

    // encodeURIComponent plutot que base64 : fonctionne a l'identique dans Node et
    // dans le navigateur, sans dependre de btoa ni de Buffer.
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  } catch {
    // Un contenu trop long depasse la capacite maximale d'un QR. Le bloc
    // s'effacera plutot que de faire echouer la fiche entiere.
    return null;
  }
}
