import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Empreintes de mots de passe.
 *
 * SCRYPT ET NON BCRYPT/ARGON2, pour une raison d'exploitation et non de gout :
 * `node:crypto` le fournit, donc aucune dependance native a compiler dans une
 * image Alpine. Les deux autres imposent soit un binding natif (bcrypt), soit un
 * paquet supplementaire — pour un gain nul a ces parametres.
 *
 * LES PARAMETRES SONT STOCKES DANS L'EMPREINTE. C'est ce qui permet de les
 * durcir plus tard sans invalider les comptes existants : une empreinte ancienne
 * se verifie avec SES parametres, et se reecrit au prochain changement de mot de
 * passe. Une constante globale obligerait a tout reinitialiser.
 *
 * `maxmem` EST OBLIGATOIRE ICI, et c'est le piege du module : scrypt consomme
 * 128 * N * r octets, soit 33,5 Mo a N=32768 — au-dessus du plafond par defaut
 * de 32 Mo. Sans cette option, l'appel echoue avec un « memory limit exceeded »
 * qui ne dit rien du parametre en cause.
 */

const N = 32768;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;
const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

/**
 * Verifie un mot de passe contre une empreinte stockee.
 *
 * `stored` accepte `null` — le cas d'un compte invite dont le mot de passe n'a
 * jamais ete choisi. La fonction rend `false`, mais APRES avoir tout de meme
 * derive une empreinte : sans cela, un compte inexistant repondrait en une
 * microseconde la ou un compte reel prend une centaine de millisecondes, ce qui
 * suffit a enumerer les adresses connues.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parsed = stored === null ? null : parse(stored);

  if (parsed === null) {
    await scrypt(password, Buffer.alloc(SALT_BYTES), KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
    return false;
  }

  const derived = await scrypt(password, parsed.salt, parsed.hash.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: MAXMEM,
  });

  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}

function parse(stored: string): { N: number; r: number; p: number; salt: Buffer; hash: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, n, r, p, salt, hash] = parts;
  const parsed = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    salt: Buffer.from(salt, "base64url"),
    hash: Buffer.from(hash, "base64url"),
  };

  // Une empreinte tronquee ou bricolee ne doit pas faire lever scrypt : elle
  // doit simplement ne valider aucun mot de passe.
  const sane =
    Number.isInteger(parsed.N) && parsed.N > 1 &&
    Number.isInteger(parsed.r) && parsed.r > 0 &&
    Number.isInteger(parsed.p) && parsed.p > 0 &&
    parsed.salt.length > 0 && parsed.hash.length > 0;

  return sane ? parsed : null;
}

/*
 * La POLITIQUE de mot de passe (longueur minimale, controles de forme) vit dans
 * src/lib/passwordPolicy.ts et non ici : le formulaire d'activation en a besoin
 * cote navigateur, et ce module-ci importe `node:crypto`. Voir l'explication en
 * tete de ce fichier-la.
 */
export { MIN_PASSWORD_LENGTH, passwordProblem } from "./passwordPolicy";
