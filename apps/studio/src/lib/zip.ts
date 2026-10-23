/**
 * Ecriture d'une archive ZIP, en memoire, sans dependance.
 *
 * POURQUOI ELLE EXISTE. La page d'import (src/app/(studio)/import) rend les fiches une
 * par une depuis le NAVIGATEUR, puis les rassemble : c'est donc l'onglet qui
 * doit produire le fichier livre. Le besoin tient en une page — quatre
 * structures decrites par APPNOTE.TXT, un CRC-32, et rien d'autre — la ou une
 * bibliotheque d'archivage apporterait la compression, le chiffrement, la
 * lecture, le multi-volume, et un arbre de dependances a auditer dans un depot
 * qui n'en porte que huit.
 *
 * STOCKAGE SEUL, method 0, et c'est un choix : un PDF est deja compresse en
 * interne (ses flux le sont), le deflater a nouveau coute du temps de calcul
 * dans l'onglet pour un gain qui se compte en pourcents. Le rapport et le
 * mapping, eux, sont minuscules. La seule consequence visible est la taille
 * annoncee par le systeme de fichiers, pas le temps de telechargement.
 *
 * CE QU'ELLE NE FAIT PAS, ecrit ici pour que la limite se voie avant de se
 * heurter a elle : ni ZIP64, ni dossiers, ni horodatage par entree. Les trois
 * bornes de l'entete classique (4 Gio par fichier, 4 Gio d'offset, 65 535
 * entrees) sont donc VERIFIEES et levent une erreur explicite — une archive
 * silencieusement tronquee est le pire des resultats possibles, puisqu'elle
 * s'ouvre.
 */

export type ZipEntry = {
  /** Chemin dans l'archive. Encode en UTF-8, drapeau 0x0800 arme. */
  name: string;
  data: Uint8Array;
};

/** 65 535 : le champ « nombre d'entrees » de l'EOCD est sur 16 bits. */
const MAX_ENTRIES = 0xffff;
/** 4 Gio : les champs de taille et d'offset sont sur 32 bits. */
const MAX_32 = 0xffffffff;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/**
 * Drapeau « nom de fichier en UTF-8 ».
 *
 * Sans lui, un nom accentue — et une reference produit en porte souvent — est
 * relu dans la page de code locale par l'Explorateur de Windows, qui affiche
 * alors des caracteres de remplacement. Le fichier s'ouvre, il est juste
 * illisible dans la liste.
 */
const FLAG_UTF8 = 0x0800;

const encoder = new TextEncoder();

/**
 * Ecrivain incremental : chaque fichier rend ses octets des qu'il est ajoute.
 *
 * C'EST LE SERVEUR QUI EN A BESOIN. /consultation compose un zip de fiches
 * telechargees une a une depuis la boutique : en les ajoutant au fur et a
 * mesure, la reponse part pendant que les suivantes se telechargent, et une
 * seule fiche a la fois est en memoire. `zipParts`, qui recoit tout d'un coup,
 * n'est plus qu'une boucle sur cet ecrivain — un seul endroit ecrit le format.
 */
export class ZipWriter {
  private readonly central: Uint8Array[] = [];
  private offset = 0;
  private readonly time: number;
  private readonly dosDate: number;

  constructor(date: Date = new Date()) {
    const dos = toDosTime(date);
    this.time = dos.time;
    this.dosDate = dos.date;
  }

  /** En-tete local et contenu du fichier, a ecrire tels quels. */
  add(entry: ZipEntry): Uint8Array[] {
    if (this.central.length >= MAX_ENTRIES) {
      throw new Error(`Archive limitee a ${MAX_ENTRIES} entrees (ZIP64 non implemente).`);
    }

    const name = encoder.encode(entry.name);
    const size = entry.data.length;
    if (size > MAX_32) {
      throw new Error(`"${entry.name}" depasse 4 Gio (ZIP64 non implemente).`);
    }
    if (this.offset > MAX_32) {
      throw new Error("Archive au-dela de 4 Gio (ZIP64 non implemente).");
    }

    const crc = crc32(entry.data);
    const { time, dosDate } = this;

    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, SIG_LOCAL, true);
    view.setUint16(4, 20, true); // version minimale pour extraire : 2.0
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, 0, true); // methode : stocke
    view.setUint16(10, time, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true); // taille compressee = taille reelle
    view.setUint32(22, size, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true); // pas de champ « extra »
    local.set(name, 30);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, SIG_CENTRAL, true);
    // Version d'ecriture. 20 (et non 0x031e ou autre) : l'octet haut porte le
    // systeme d'origine, et 0 = MS-DOS/FAT est le seul qui n'induise aucun
    // decodage d'attributs Unix par le decompresseur.
    recordView.setUint16(4, 20, true);
    recordView.setUint16(6, 20, true);
    recordView.setUint16(8, FLAG_UTF8, true);
    recordView.setUint16(10, 0, true);
    recordView.setUint16(12, time, true);
    recordView.setUint16(14, dosDate, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, size, true);
    recordView.setUint32(24, size, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint16(30, 0, true); // extra
    recordView.setUint16(32, 0, true); // commentaire
    recordView.setUint16(34, 0, true); // numero de disque
    recordView.setUint16(36, 0, true); // attributs internes
    recordView.setUint32(38, 0, true); // attributs externes
    recordView.setUint32(42, this.offset, true);
    record.set(name, 46);
    this.central.push(record);

    this.offset += local.length + size;
    return [local, entry.data];
  }

  /** Repertoire central et fin d'archive, apres le dernier fichier. */
  finish(): Uint8Array[] {
    const count = this.central.length;
    const centralSize = this.central.reduce((total, record) => total + record.length, 0);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, SIG_EOCD, true);
    eocdView.setUint16(4, 0, true); // disque courant
    eocdView.setUint16(6, 0, true); // disque du debut du repertoire central
    eocdView.setUint16(8, count, true);
    eocdView.setUint16(10, count, true);
    eocdView.setUint32(12, centralSize, true);
    eocdView.setUint32(16, this.offset, true);
    eocdView.setUint16(20, 0, true); // commentaire d'archive

    return [...this.central, eocd];
  }
}

/**
 * L'archive, en morceaux, dans l'ordre ou ils doivent etre ecrits.
 *
 * En morceaux et NON en un seul Uint8Array : un lot de plusieurs centaines de
 * fiches se compte en centaines de mega-octets, et concatener demanderait de
 * tenir l'archive DEUX fois en memoire au moment de la copie. `new Blob(parts)`
 * accepte directement ce tableau, et c'est le navigateur qui assemble.
 */
export function zipParts(entries: readonly ZipEntry[], date: Date = new Date()): Uint8Array[] {
  // Verifie AVANT d'ecrire quoi que ce soit, comme avant l'ecrivain : un lot
  // trop gros echoue d'entree, pas apres avoir calcule 65 535 CRC.
  if (entries.length > MAX_ENTRIES) {
    throw new Error(
      `Archive limitee a ${MAX_ENTRIES} entrees (ZIP64 non implemente) — ${entries.length} demandees.`
    );
  }

  const writer = new ZipWriter(date);
  const parts: Uint8Array[] = [];
  for (const entry of entries) parts.push(...writer.add(entry));
  return [...parts, ...writer.finish()];
}

/** Version d'un seul bloc, pour les tests et les petites archives. */
export function buildZip(entries: readonly ZipEntry[], date?: Date): Uint8Array {
  const parts = zipParts(entries, date);
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Horodatage MS-DOS : une date sur 16 bits depuis 1980, une heure sur 16 bits
 * a la seconde paire pres. C'est le seul horodatage que porte l'entete
 * classique — la precision qui manque est celle du format, pas un raccourci.
 *
 * Une date anterieure a 1980 est ramenee au 1er janvier 1980 : l'annee est
 * codee sur 7 bits sans signe, et une soustraction negative produirait une
 * date aberrante qu'aucun decompresseur ne signale.
 */
function toDosTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * CRC-32 (polynome 0xEDB88320), par table.
 *
 * La table est construite au premier appel et non a l'import : ce module est
 * charge par la page d'import, qui ne produit une archive qu'a la fin d'un lot.
 */
let table: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (table === null) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[n] = value >>> 0;
    }
  }
  return table;
}

export function crc32(data: Uint8Array): number {
  const lookup = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = lookup[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
