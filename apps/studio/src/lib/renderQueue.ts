/**
 * Plafond de rendus simultanes.
 *
 * LE PROBLEME EST DE MEMOIRE, pas de vitesse. Un rendu met en memoire les assets
 * joints (jusqu'a MAX_REQUEST_BYTES, 32 Mo par defaut), les recopie dans le
 * multipart envoye a Gotenberg, puis bufferise le PDF produit : environ trois fois
 * le poids du payload, pendant toute la duree du rendu. Rien ne limitait le nombre
 * de rendus en vol.
 *
 * Or la generation en masse cote boutique tire autant de requetes que de workers,
 * et Gotenberg fait la queue EN INTERNE : le Studio garde donc tous ces buffers
 * ouverts pendant que Chromium traite les rendus un par un. Le pic de memoire
 * n'est pas borne par la capacite de rendu, il est borne par le nombre de requetes
 * que la boutique veut bien envoyer.
 *
 * D'ou ce sas, place AVANT la lecture du corps de la requete : une requete en
 * attente n'a encore rien mis en memoire, son corps reste dans le socket.
 *
 * PORTEE : un processus. Le compose ne deploie qu'un service `app`, mais avec
 * plusieurs replicas le plafond effectif serait multiplie d'autant — il faudrait
 * alors le porter cote Gotenberg.
 */

import { env } from "./env";

export type RenderSlot = {
  /** Idempotent : un double appel ne libere pas deux places. */
  release: () => void;
};

export type Acquired = {
  slot: RenderSlot;
  /** Temps passe en file. Journalise, pour distinguer un rendu lent d'une attente. */
  queuedMs: number;
};

type Waiter = {
  resolve: (value: Acquired | null) => void;
  timer: ReturnType<typeof setTimeout>;
  since: number;
};

export class RenderLimiter {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
    private readonly maxWaitMs: number
  ) {}

  /**
   * @returns une place, ou `null` si le moteur est sature — file pleine, ou
   *          attente trop longue. L'appelant doit repondre 429 plutot que de
   *          patienter indefiniment : une requete qui attend tient un socket, et
   *          une boutique qui reessaie plus tard coute moins cher qu'un processus
   *          qui s'effondre.
   */
  acquire(): Promise<Acquired | null> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve({ slot: this.makeSlot(), queuedMs: 0 });
    }

    if (this.waiting.length >= this.maxQueued) {
      return Promise.resolve(null);
    }

    return new Promise<Acquired | null>((resolve) => {
      const since = Date.now();
      const waiter: Waiter = {
        resolve,
        since,
        timer: setTimeout(() => {
          const at = this.waiting.indexOf(waiter);
          if (at !== -1) this.waiting.splice(at, 1);
          resolve(null);
        }, this.maxWaitMs),
      };

      this.waiting.push(waiter);
    });
  }

  private makeSlot(): RenderSlot {
    let released = false;

    return {
      release: () => {
        if (released) return;
        released = true;

        // La place est TRANSMISE au premier en attente, sans repasser par
        // `active`. Decrementer puis laisser le prochain arrivant incrementer
        // permettrait a une requete neuve de doubler toute la file.
        const next = this.waiting.shift();
        if (next) {
          clearTimeout(next.timer);
          next.resolve({ slot: this.makeSlot(), queuedMs: Date.now() - next.since });
          return;
        }

        this.active -= 1;
      },
    };
  }

  /** Etat instantane, pour le journal et les diagnostics. */
  get stats(): { active: number; waiting: number; maxConcurrent: number; maxQueued: number } {
    return {
      active: this.active,
      waiting: this.waiting.length,
      maxConcurrent: this.maxConcurrent,
      maxQueued: this.maxQueued,
    };
  }
}

/**
 * LE sas, partage par le rendu de production et l'apercu de l'editeur.
 *
 * Un seul plafond, parce qu'il n'y a qu'un Gotenberg : donner sa propre reserve a
 * l'editeur reviendrait a mentir sur la ressource. La consequence est assumee — un
 * apercu peut attendre pendant une generation en masse — et elle est dite a
 * l'integrateur plutot que masquee.
 */
export const renderLimiter = new RenderLimiter(
  env.maxConcurrentRenders,
  env.maxQueuedRenders,
  env.renderQueueTimeoutMs
);
