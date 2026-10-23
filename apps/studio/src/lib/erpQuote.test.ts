import { test } from "node:test";
import assert from "node:assert/strict";
import { ErpQuoteError, fetchErpQuote, normalizeQuoteReference, parseEntities, quoteDocumentPath } from "./erpQuote";
import { MAX_QUOTE_BYTES } from "./bookQuote";

const CONFIG = { url: "https://erp.exemple/api/index.php/", apiKey: "cle-studio", entities: ["9"] };
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n");

type Reply = { status: number; body?: unknown };

/**
 * Un faux Dolibarr : une reponse par route, et le journal des appels. Une route
 * peut etre propre a une entite : « 4|/proposals/ref/ ».
 */
function erp(routes: Record<string, Reply>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });
    const route =
      Object.keys(routes).find((key) => key.includes("|") && key.startsWith(`${headers.dolapientity}|`) && url.includes(key.split("|")[1])) ??
      Object.keys(routes).find((key) => !key.includes("|") && url.includes(key));
    const reply = route ? routes[route] : { status: 501 };
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const PROPOSAL = {
  ref: "D-MA-051341",
  date: 1760659200,
  statut: "1",
  last_main_doc: "propale/D-MA-051341/D-MA-051341.pdf",
};

test("un devis se lit par sa reference, puis son PDF, avec la cle et l'entite de la boutique", async () => {
  const { fetchImpl, calls } = erp({
    "/proposals/ref/": { status: 200, body: PROPOSAL },
    "/documents/download": { status: 200, body: { filename: "D-MA-051341.pdf", content: PDF.toString("base64"), encoding: "base64" } },
  });
  const quote = await fetchErpQuote(CONFIG, " D-MA-051341 ", fetchImpl);

  assert.equal(quote.ref, "D-MA-051341");
  assert.equal(quote.date, "2025-10-17");
  assert.equal(quote.status, 1);
  assert.equal(quote.filename, "devis-D-MA-051341.pdf");
  assert.deepEqual(Buffer.from(quote.pdf), PDF);

  assert.equal(calls[0].url, "https://erp.exemple/api/index.php/proposals/ref/D-MA-051341");
  assert.equal(
    calls[1].url,
    "https://erp.exemple/api/index.php/documents/download?modulepart=propal&original_file=D-MA-051341%2FD-MA-051341.pdf"
  );
  for (const call of calls) {
    assert.equal(call.headers.dolapikey, "cle-studio");
    assert.equal(call.headers.dolapientity, "9");
  }
});

test("le chemin du PDF vient de last_main_doc, a defaut du nommage de Dolibarr", () => {
  assert.equal(quoteDocumentPath("D-1", "propale/D-1/D-1.pdf"), "D-1/D-1.pdf");
  // Donnees d'une autre entite : le prefixe d'entite precede « propale/ ».
  assert.equal(quoteDocumentPath("D-1", "9/propale/D-1/D-1-signe.pdf"), "D-1/D-1-signe.pdf");
  assert.equal(quoteDocumentPath("D-1", ""), "D-1/D-1.pdf");
  assert.equal(quoteDocumentPath("D-1", null), "D-1/D-1.pdf");
});

test("une reference qui sortirait du chemin d'URL est refusee avant tout appel", async () => {
  assert.equal(normalizeQuoteReference("(PROV42)"), "(PROV42)");
  assert.equal(normalizeQuoteReference("../../documents"), null);
  assert.equal(normalizeQuoteReference("D-1?x=1"), null);
  assert.equal(normalizeQuoteReference(""), null);

  const { fetchImpl, calls } = erp({});
  await assert.rejects(fetchErpQuote(CONFIG, "D-1/../x", fetchImpl), (error: ErpQuoteError) => error.status === 422);
  assert.equal(calls.length, 0);
});

test("chaque echec dit ce qui est en cause, avec le bon statut", async () => {
  const cases: [Record<string, Reply>, number, RegExp][] = [
    [{ "/proposals/ref/": { status: 404 } }, 404, /Aucun devis « D-1 »/],
    [{ "/proposals/ref/": { status: 401 } }, 502, /refuse l'accès du Studio/],
    [{ "/proposals/ref/": { status: 200, body: PROPOSAL }, "/documents/download": { status: 404 } }, 409, /pas encore de PDF/],
    [
      { "/proposals/ref/": { status: 200, body: PROPOSAL }, "/documents/download": { status: 200, body: { content: Buffer.from("<html>").toString("base64") } } },
      422,
      /n'est pas un PDF/,
    ],
    [
      { "/proposals/ref/": { status: 200, body: PROPOSAL }, "/documents/download": { status: 200, body: { content: "A".repeat(MAX_QUOTE_BYTES * 2) } } },
      422,
      /trop lourd/,
    ],
  ];
  for (const [routes, status, message] of cases) {
    const { fetchImpl } = erp(routes);
    await assert.rejects(fetchErpQuote(CONFIG, "D-1", fetchImpl), (error: ErpQuoteError) => {
      assert.equal(error.status, status, String(message));
      assert.match(error.message, message);
      return true;
    });
  }
});

test("un ERP injoignable n'est pas confondu avec un devis absent", async () => {
  const fetchImpl = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(fetchErpQuote(CONFIG, "D-1", fetchImpl), (error: ErpQuoteError) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /ne répond pas/);
    return true;
  });
});

test("les entites d'une boutique se saisissent « 4, 9, 12 », sans doublon, dans l'ordre", () => {
  assert.deepEqual(parseEntities("4, 9; 12  4"), ["4", "9", "12"]);
  assert.deepEqual(parseEntities("4"), ["4"]);
  assert.deepEqual(parseEntities("  "), []);
  assert.deepEqual(parseEntities(undefined), []);
  // Refuse plutot que lire a moitie.
  assert.equal(parseEntities("4, acme"), null);
  assert.equal(parseEntities(Array.from({ length: 21 }, (_, index) => index + 1).join(",")), null);
});

test("un devis de grand compte est trouve dans une autre entite de la boutique, et son PDF lu dans celle-ci", async () => {
  const { fetchImpl, calls } = erp({
    "4|/proposals/ref/": { status: 404 },
    "9|/proposals/ref/": { status: 200, body: PROPOSAL },
    "9|/documents/download": { status: 200, body: { content: PDF.toString("base64") } },
  });
  const quote = await fetchErpQuote({ ...CONFIG, entities: ["4", "9"] }, "D-MA-051341", fetchImpl);
  assert.equal(quote.entity, "9");
  assert.deepEqual(
    calls.map((call) => `${call.headers.dolapientity} ${new URL(call.url).pathname.split("/").slice(-2).join("/")}`),
    ["4 ref/D-MA-051341", "9 ref/D-MA-051341", "9 documents/download"]
  );
});

test("une reference presente dans deux entites n'est pas tranchee au hasard", async () => {
  const { fetchImpl } = erp({ "/proposals/ref/": { status: 200, body: PROPOSAL } });
  await assert.rejects(fetchErpQuote({ ...CONFIG, entities: ["4", "9"] }, "D-MA-051341", fetchImpl), (error: ErpQuoteError) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /plusieurs entités ERP \(4, 9\)/);
    return true;
  });
});

test("absent partout : le message nomme les entites cherchees ; une entite en panne interdit de conclure", async () => {
  const absent = erp({ "/proposals/ref/": { status: 404 } });
  await assert.rejects(fetchErpQuote({ ...CONFIG, entities: ["4", "9"] }, "D-1", absent.fetchImpl), (error: ErpQuoteError) => {
    assert.equal(error.status, 404);
    assert.match(error.message, /entités 4, 9/);
    return true;
  });

  const panne = erp({ "4|/proposals/ref/": { status: 404 }, "9|/proposals/ref/": { status: 403 } });
  await assert.rejects(fetchErpQuote({ ...CONFIG, entities: ["4", "9"] }, "D-1", panne.fetchImpl), (error: ErpQuoteError) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /refuse l'accès/);
    return true;
  });
});
