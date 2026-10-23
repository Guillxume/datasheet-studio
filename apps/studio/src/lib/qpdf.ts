import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tocPatch, type TocPatchInput } from "./bookToc";

/**
 * qpdf, l'outil en ligne de commande, pour assembler le book et le retoucher
 * SUR LE DISQUE (voir src/lib/bookToc.ts pour le pourquoi). Installe dans
 * l'image du Studio (infra/config/app/Dockerfile) ; sur un poste,
 * `brew install qpdf`.
 *
 * ABSENT, RIEN NE CASSE : qpdfAvailable() le dit, et le book retombe sur la
 * fusion de Gotenberg — sommaire imprime avec ses numeros, sans liens.
 *
 * `--warning-exit-0` partout : qpdf sort en 3 quand il a du rattraper une
 * structure imparfaite mais a bien ecrit le fichier, et un PDF de boutique un
 * peu de travers ne doit pas faire echouer un book.
 */

const run = promisify(execFile);
const BIN = process.env.QPDF_BIN || "qpdf";
/** Un book de deux cents fiches se fusionne en quelques secondes ; au-dela, quelque chose est coince. */
const TIMEOUT_MS = 120_000;
/** Le JSON demande est restreint a quelques objets : quelques megaoctets au plus. */
const MAX_JSON_BYTES = 64 * 1024 * 1024;

let available: Promise<boolean> | null = null;

export function qpdfAvailable(): Promise<boolean> {
  available ??= run(BIN, ["--version"], { timeout: 5_000 }).then(
    () => true,
    () => false
  );
  return available;
}

/** Assemble des PDF dans l'ordre, en gardant leurs liens (la fusion de Gotenberg les jette). */
export async function qpdfMerge(paths: string[], out: string): Promise<void> {
  await run(BIN, ["--warning-exit-0", "--empty", "--pages", ...paths, "--", out], { timeout: TIMEOUT_MS });
}

/** Le nombre de pages, quand la lecture rapide de src/lib/pdf.ts n'a pas su (PDF d'une autre origine). */
export async function qpdfPageCount(path: string): Promise<number | null> {
  try {
    const { stdout } = await run(BIN, ["--warning-exit-0", "--show-npages", path], { timeout: 30_000 });
    const pages = Number(stdout.trim());
    return Number.isInteger(pages) && pages > 0 ? pages : null;
  } catch {
    return null;
  }
}

type QpdfJson = {
  pages?: { object: string }[];
  qpdf?: [{ maxobjectid: number }, Record<string, { value?: unknown }>];
};

/** « 12 0 R » -> « 12,0 », la forme qu'attend --json-object. */
const objectOption = (ref: string) => `--json-object=${ref.replace(/^(\d+) (\d+) R$/, "$1,$2")}`;

async function readJson(path: string, keys: string[], objects: string[]): Promise<QpdfJson> {
  const { stdout } = await run(
    BIN,
    [
      "--warning-exit-0",
      "--json=2",
      "--json-stream-data=none",
      ...keys.map((key) => `--json-key=${key}`),
      ...objects.map(objectOption),
      path,
    ],
    { timeout: TIMEOUT_MS, maxBuffer: MAX_JSON_BYTES }
  );
  return JSON.parse(stdout) as QpdfJson;
}

const valueOf = (json: QpdfJson, ref: string): Record<string, unknown> | undefined => {
  const value = json.qpdf?.[1][ref === "trailer" ? "trailer" : `obj:${ref}`]?.value;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
};
const isRef = (value: unknown): value is string => typeof value === "string" && /^\d+ \d+ R$/.test(value);

/**
 * Le sommaire rendu cliquable, et le document dote de ses signets : lit dans le
 * book fusionne ce qu'il faut — les objets page, le catalogue, les liens des
 * pages du sommaire — puis applique la retouche de tocPatch dans un nouveau
 * fichier. Lecture CIBLEE (--json-object) : quelques objets, jamais tout le
 * book, quelle que soit sa taille.
 */
export async function qpdfApplyToc(
  merged: string,
  out: string,
  patchPath: string,
  toc: { first: number; count: number; outline: TocPatchInput["outline"] }
): Promise<{ links: number; broken: number }> {
  const overview = await readJson(merged, ["pages", "qpdf"], ["trailer"]);
  const pages = (overview.pages ?? []).map((page) => page.object);
  const root = valueOf(overview, "trailer")?.["/Root"];
  if (!isRef(root) || pages.length === 0) throw new Error("qpdf : structure du book illisible");

  const tocPages = pages.slice(toc.first - 1, toc.first - 1 + toc.count);
  const first = await readJson(merged, ["qpdf"], [root, ...tocPages]);

  // /Annots est un tableau, ou la reference d'un tableau : on suit au besoin.
  const annotRefs: string[] = [];
  const indirectArrays: string[] = [];
  for (const page of tocPages) {
    const annots = valueOf(first, page)?.["/Annots"];
    if (Array.isArray(annots)) annotRefs.push(...annots.filter(isRef));
    else if (isRef(annots)) indirectArrays.push(annots);
  }
  if (indirectArrays.length > 0) {
    const arrays = await readJson(merged, ["qpdf"], indirectArrays);
    for (const ref of indirectArrays) {
      const value = arrays.qpdf?.[1][`obj:${ref}`]?.value;
      if (Array.isArray(value)) annotRefs.push(...value.filter(isRef));
    }
  }

  const annots = annotRefs.length > 0 ? await readJson(merged, ["qpdf"], annotRefs) : { qpdf: undefined };
  const annotations = annotRefs.flatMap((ref) => {
    const value = valueOf(annots as QpdfJson, ref);
    return value ? [{ ref, value }] : [];
  });
  const actionRefs = annotations.map((annotation) => annotation.value["/A"]).filter(isRef);
  const actionsJson = actionRefs.length > 0 ? await readJson(merged, ["qpdf"], actionRefs) : null;
  const actions = Object.fromEntries(
    actionRefs.flatMap((ref) => {
      const value = actionsJson ? valueOf(actionsJson, ref) : undefined;
      return value ? [[ref, value]] : [];
    })
  );

  const { patch, links, broken } = tocPatch({
    maxObjectId: overview.qpdf?.[0].maxobjectid ?? 0,
    pages,
    root: { ref: root, value: valueOf(first, root) ?? {} },
    annotations,
    actions,
    outline: toc.outline,
  });
  await writeFile(patchPath, JSON.stringify(patch));
  await run(BIN, ["--warning-exit-0", merged, `--update-from-json=${patchPath}`, out], { timeout: TIMEOUT_MS });
  return { links, broken };
}
