/**
 * Corps de requete plafonne AU FIL DE LA LECTURE — module pur.
 *
 * POURQUOI L'EN-TETE NE SUFFIT PAS. /api/v1/render refusait d'emblee un
 * `Content-Length` superieur a MAX_REQUEST_BYTES. Mais un envoi « chunked »
 * n'en porte pas : le controle laissait passer, et `formData()` lisait alors
 * TOUT ce qui arrivait, sans limite (audit du 16/10/2026). Les autres routes
 * sont deja plafonnees par le portail de Next (`proxyClientMaxBodySize`) ;
 * /api/v1 sort du portail, il lui faut son propre plafond.
 *
 * EN FLUX ET NON EN TAMPON : la requete rendue lit le corps d'origine a travers
 * un compteur, et echoue au premier octet de trop. Rien n'est copie en plus de
 * ce que `formData()` ou `json()` font deja.
 */
export type CappedRequest = { request: Request; exceeded: () => boolean };

export function capRequestBody(request: Request, maxBytes: number): CappedRequest {
  let total = 0;
  let depasse = false;
  if (request.body === null) return { request, exceeded: () => false };

  const compteur = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        depasse = true;
        controller.error(new Error(`corps de requete au-dela de ${maxBytes} octets`));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const capped = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body.pipeThrough(compteur),
    // Exige par Node des qu'un corps est un flux.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  return { request: capped, exceeded: () => depasse };
}
