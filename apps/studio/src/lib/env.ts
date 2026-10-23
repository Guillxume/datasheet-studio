function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get gotenbergUrl(): string {
    return process.env.GOTENBERG_URL ?? "http://gotenberg:3000";
  },
  /** Plafond de taille du multipart de rendu, garde-fou contre un payload aberrant. */
  get maxRequestBytes(): number {
    return Number(process.env.MAX_REQUEST_BYTES ?? 32 * 1024 * 1024);
  },
  /**
   * Rendus simultanes. Voir src/lib/renderQueue.ts : la contrainte est la memoire
   * tenue par les requetes en vol, pas la capacite de Chromium.
   *
   * 4 : de quoi tenir le debit d'une generation en masse sans laisser le nombre de
   * buffers ouverts dependre du nombre de workers de la boutique.
   */
  get maxConcurrentRenders(): number {
    return positive(process.env.MAX_CONCURRENT_RENDERS, 4);
  },
  /** Profondeur de file au-dela de laquelle on repond 429 plutot que d'attendre. */
  get maxQueuedRenders(): number {
    return positive(process.env.MAX_QUEUED_RENDERS, 8);
  },
  /** Attente maximale en file avant de rendre la main a l'appelant. */
  get renderQueueTimeoutMs(): number {
    return positive(process.env.RENDER_QUEUE_TIMEOUT_MS, 20_000);
  },
  /**
   * L'API de l'ERP (Dolibarr), d'ou un book peut tirer le devis du client par sa
   * reference (src/lib/erpQuote.ts). Facultative : sans elle, seul le PDF
   * televerse est propose. La cle est celle d'un utilisateur Dolibarr DEDIE au
   * Studio, en lecture sur les propositions commerciales et leurs documents.
   */
  get erp(): { url: string; apiKey: string } | null {
    const url = (process.env.DOLIBARR_API_URL ?? "").trim();
    const apiKey = (process.env.DOLIBARR_API_KEY ?? "").trim();
    return url !== "" && apiKey !== "" ? { url, apiKey } : null;
  },
};

/**
 * Une valeur de configuration absurde (0, negative, non numerique) ne doit pas
 * bloquer tous les rendus : on retombe sur le defaut.
 */
function positive(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/*
 * Pas de SELF_URL ici, volontairement.
 *
 * Les pictos de template sont lus en base et inlines en data URI au moment du
 * rendu (voir src/lib/render.tsx) : Gotenberg n'a donc jamais besoin de joindre
 * cette application, et il n'y a aucune URL de service a configurer.
 */
