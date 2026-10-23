import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildZip, crc32, zipParts, ZipWriter } from "./zip";

/**
 * Une archive mal formee s'OUVRE quand meme : la plupart des decompresseurs
 * reparent en silence ce qu'ils peuvent. Un test qui se contente de relire ce
 * que le writer vient d'ecrire ne prouve donc rien — il verifie que deux
 * erreurs symetriques s'annulent.
 *
 * D'ou les deux niveaux ici :
 *   - un lecteur ecrit dans CE fichier, d'apres la specification et non d'apres
 *     l'implementation, qui refuse toute deviation ;
 *   - `unzip` du systeme quand il est present, qui est le juge reel.
 */

const text = (value: string) => new TextEncoder().encode(value);
const decoder = new TextDecoder();

/** Lecteur minimal : EOCD, repertoire central, puis les entetes locaux. */
function readZip(zip: Uint8Array): Array<{ name: string; content: string }> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "signature EOCD");
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);

  const entries: Array<{ name: string; content: string }> = [];
  for (let i = 0; i < count; i += 1) {
    assert.equal(view.getUint32(at, true), 0x02014b50, "signature d'entree centrale");
    const flags = view.getUint16(at + 8, true);
    assert.equal(flags & 0x0800, 0x0800, "drapeau UTF-8 arme");
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength));

    // L'entete local doit repeter ce que le repertoire central annonce : c'est
    // la premiere chose qu'un decompresseur compare, et la premiere a diverger
    // quand un offset est calcule a un octet pres.
    assert.equal(view.getUint32(offset, true), 0x04034b50, `signature locale de ${name}`);
    assert.equal(view.getUint32(offset + 14, true), crc, `CRC local de ${name}`);
    assert.equal(view.getUint32(offset + 22, true), size, `taille locale de ${name}`);
    const localNameLength = view.getUint16(offset + 26, true);
    assert.equal(
      decoder.decode(zip.subarray(offset + 30, offset + 30 + localNameLength)),
      name,
      "nom repete a l'identique"
    );

    const start = offset + 30 + localNameLength + view.getUint16(offset + 28, true);
    const data = zip.subarray(start, start + size);
    assert.equal(crc32(data), crc, `CRC annonce pour ${name}`);

    entries.push({ name, content: decoder.decode(data) });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}

test("CRC-32 sur le vecteur de reference", () => {
  // "123456789" -> 0xCBF43926, la valeur de controle publiee du CRC-32.
  assert.equal(crc32(text("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("relit ce qui a ete ecrit, nom et contenu", () => {
  const zip = buildZip([
    { name: "TPM-2500.pdf", data: text("%PDF-1.4 premier") },
    { name: "rapport.csv", data: text("ref;statut\nTPM-2500;ok\n") },
  ]);

  assert.deepEqual(readZip(zip), [
    { name: "TPM-2500.pdf", content: "%PDF-1.4 premier" },
    { name: "rapport.csv", content: "ref;statut\nTPM-2500;ok\n" },
  ]);
});

test("un nom accentue survit au tour complet", () => {
  // Le drapeau UTF-8 existe pour ce cas : une reference produit porte souvent
  // un accent, et sans lui l'Explorateur de Windows le remplace.
  const zip = buildZip([{ name: "Établi-métallique.pdf", data: text("x") }]);

  assert.equal(readZip(zip)[0].name, "Établi-métallique.pdf");
});

test("une entree vide reste une entree", () => {
  // Un PDF de zero octet ne devrait pas arriver, mais une archive qui perd
  // silencieusement une entree serait pire que celle qui la garde vide.
  const entries = readZip(buildZip([{ name: "vide.pdf", data: new Uint8Array(0) }]));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].content, "");
});

test("les morceaux mis bout a bout valent l'archive d'un bloc", () => {
  // zipParts existe pour ne pas tenir l'archive deux fois en memoire : les deux
  // chemins doivent rendre exactement le meme octet.
  const entries = [
    { name: "a.pdf", data: text("aaaa") },
    { name: "b.pdf", data: text("bbbbbb") },
  ];
  const fixedDate = new Date(2024, 4, 17, 10, 30, 0);

  const parts = zipParts(entries, fixedDate);
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }

  assert.deepEqual(joined, buildZip(entries, fixedDate));
});

test("une date anterieure a 1980 ne produit pas une archive aberrante", () => {
  // L'annee DOS est sur 7 bits sans signe : la soustraction doit etre bornee,
  // sinon la date deborde sur le mois sans qu'aucun outil ne le signale.
  const zip = buildZip([{ name: "a.pdf", data: text("x") }], new Date(1970, 0, 1));
  const view = new DataView(zip.buffer);
  const dosDate = view.getUint16(12, true);

  assert.equal(dosDate >> 9, 0, "annee ramenee a 1980");
  assert.equal((dosDate >> 5) & 0x0f, 1, "mois de janvier");
});

test("les bornes du format sont refusees, pas tronquees", () => {
  const entries = Array.from({ length: 65_536 }, (_, index) => ({
    name: `${index}.pdf`,
    data: new Uint8Array(0),
  }));

  assert.throws(() => zipParts(entries), /65535 entrees/);
});

/**
 * Le juge reel. `unzip` n'est pas garanti present (image de base minimale), le
 * cas est donc saute plutot que rouge — mais quand il est la, c'est lui qui
 * decide.
 */
const hasUnzip = (() => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

test("unzip du systeme accepte l'archive et rend les octets", { skip: !hasUnzip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-zip-"));
  const path = join(dir, "lot.zip");
  writeFileSync(
    path,
    buildZip([
      { name: "TPM-2500.pdf", data: text("%PDF-1.4 contenu") },
      { name: "Établi.pdf", data: text("deuxieme") },
      { name: "rapport.csv", data: text("ref;statut\n") },
    ])
  );

  // -t verifie les CRC de toutes les entrees ; -p en ressort une.
  execFileSync("unzip", ["-t", path], { stdio: "ignore" });
  assert.equal(execFileSync("unzip", ["-p", path, "TPM-2500.pdf"]).toString(), "%PDF-1.4 contenu");
});

/**
 * L'ECRIVAIN INCREMENTAL EST LE MEME FORMAT, OCTET POUR OCTET. /consultation
 * l'alimente au fil des telechargements ; la page d'import passe par
 * zipParts. Une divergence entre les deux ne se verrait qu'a l'ouverture d'un
 * des deux zips.
 */
test("ZipWriter, alimente fichier par fichier, ecrit la meme archive que zipParts", () => {
  const date = new Date(2026, 9, 7, 10, 30, 12);
  const entries = [
    { name: "fiche-technique-poteau-901.pdf", data: text("%PDF-1.7 premier") },
    { name: "fiches-manquantes.txt", data: text("Réf. 902 : HTTP 404\n") },
  ];

  const writer = new ZipWriter(date);
  const parts: Uint8Array[] = [];
  for (const entry of entries) parts.push(...writer.add(entry));
  parts.push(...writer.finish());

  const concat = (chunks: Uint8Array[]) => {
    const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  };

  const incremental = concat(parts);
  assert.deepEqual(incremental, buildZip(entries, date));
  assert.deepEqual(
    readZip(incremental).map((entry) => entry.name),
    entries.map((entry) => entry.name)
  );
});
