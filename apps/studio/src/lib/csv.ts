/**
 * Lecteur CSV, ecrit ici plutot qu'ajoute en dependance.
 *
 * Le besoin tient en une page — RFC 4180 : guillemets, guillemets doubles a
 * l'interieur, sauts de ligne dans un champ, CRLF, BOM — et cette page est plus
 * facile a relire qu'un arbre de dependances a auditer dans un depot qui n'en
 * porte que huit. Un CSV exporte d'Excel casse d'ailleurs precisement sur ces
 * quatre points-la, qui sont donc testes.
 *
 * En flux, et pas en une bouchee : un export de catalogue se compte en dizaines
 * de milliers de lignes, et le lot doit rendre sa premiere fiche avant d'avoir
 * lu la derniere.
 *
 * VIT DANS src/lib ET NON DANS collectors/ : la page d'import (src/app/(studio)/import)
 * lit le fichier choisi DANS LE NAVIGATEUR pour en montrer les colonnes avant
 * qu'une seule fiche ne soit rendue. Deux lecteurs CSV, c'est deux facons de
 * couper un champ cite — donc un apercu qui ne montre pas ce que le lot
 * enverra. Le collecteur CSV l'importe par "@/lib/csv".
 *
 * Corollaire : aucun import de node:*. Le flux d'entree est une
 * AsyncIterable<string>, que `createReadStream` cote Node et `Blob.stream()`
 * cote navigateur savent tous les deux fournir.
 */

const DELIMITERS = [";", ",", "\t", "|"] as const;

/**
 * Un export francais d'Excel utilise le point-virgule, un export anglo-saxon la
 * virgule, un export d'ERP la tabulation. Demander a l'utilisateur de le
 * declarer serait une question dont la reponse est ecrite dans le fichier.
 *
 * Compte les separateurs HORS guillemets sur la premiere ligne : un titre de
 * colonne « Poids, net » ne doit pas faire elire la virgule.
 */
export function detectDelimiter(firstLine: string): string {
  let best = ",";
  let bestCount = 0;
  for (const candidate of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const char = firstLine[i];
      if (char === '"') {
        quoted = !quoted;
      } else if (char === candidate && !quoted) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export class CsvParser {
  private delimiter: string | null;
  private field = "";
  private row: string[] = [];
  private quoted = false;
  /** Un guillemet vient d'etre lu dans un champ cite : fin de champ ou echappement ? */
  private pendingQuote = false;
  private started = false;
  private buffered = "";

  constructor(delimiter?: string) {
    this.delimiter = delimiter ?? null;
  }

  push(chunk: string): string[][] {
    let text = chunk;

    // Le BOM d'Excel (U+FEFF), sinon la premiere colonne s'appelle "\uFEFFproduct.name"
    // et ne correspond a rien. Defaut classique, invisible a l'oeil.
    if (!this.started) {
      if (text.startsWith("\uFEFF")) text = text.slice(1);
      this.started = true;
    }

    // Le separateur se lit sur la premiere ligne : tant qu'elle n'est pas
    // complete, on met de cote plutot que de deviner.
    if (this.delimiter === null) {
      this.buffered += text;
      const end = this.buffered.search(/\r?\n/);
      if (end === -1) return [];
      this.delimiter = detectDelimiter(this.buffered.slice(0, end));
      text = this.buffered;
      this.buffered = "";
    }

    const rows: string[][] = [];
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (this.pendingQuote) {
        this.pendingQuote = false;
        if (char === '"') {
          this.field += '"';
          continue;
        }
        this.quoted = false;
      }

      if (this.quoted) {
        if (char === '"') this.pendingQuote = true;
        else this.field += char;
        continue;
      }

      if (char === '"' && this.field === "") {
        this.quoted = true;
        continue;
      }
      if (char === this.delimiter) {
        this.row.push(this.field);
        this.field = "";
        continue;
      }
      if (char === "\n") {
        this.row.push(this.field);
        rows.push(this.row);
        this.row = [];
        this.field = "";
        continue;
      }
      if (char === "\r") {
        continue; // CRLF : le \n qui suit termine la ligne
      }
      this.field += char;
    }
    return rows;
  }

  end(): string[][] {
    if (this.buffered !== "") {
      // Fichier d'une seule ligne, sans saut final.
      const rows = this.push("\n");
      return rows;
    }
    if (this.field === "" && this.row.length === 0) return [];
    this.row.push(this.field);
    const row = this.row;
    this.row = [];
    this.field = "";
    return [row];
  }
}

/** Version en une bouchee, pour les tests et les petits fichiers. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const parser = new CsvParser(delimiter);
  return [...parser.push(text), ...parser.end()];
}

/**
 * Lignes d'un flux de texte. Les lignes vides sont ecartees : un export se
 * termine tres souvent par un saut de ligne, qui produirait sinon une derniere
 * ligne fantome et un produit sans nom.
 */
export async function* streamCsvRows(
  chunks: AsyncIterable<string>,
  delimiter?: string
): AsyncGenerator<string[]> {
  const parser = new CsvParser(delimiter);
  for await (const chunk of chunks) {
    for (const row of parser.push(chunk)) {
      if (!isBlank(row)) yield row;
    }
  }
  for (const row of parser.end()) {
    if (!isBlank(row)) yield row;
  }
}

function isBlank(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}
