import { z } from "zod";

/**
 * Choix du template d'apres le produit — MOTEUR PARTAGE.
 *
 * OU CE MOTEUR A VECU, ET POURQUOI IL A DEMENAGE. Il est ne dans
 * collectors/core/, avec cette justification en tete : « le choix du template
 * appartient au collecteur, pas au Studio ; un identifiant de categorie n'a de
 * sens que dans SA source ».
 *
 * L'argument ne tenait qu'a moitie. Ce moteur ne compare pas des identifiants,
 * il compare des LIBELLES — et le Studio recoit `category_path` dans chaque
 * payload. La vraie raison de sa place, c'etait que le besoin est apparu la
 * d'abord.
 *
 * Ce qui a tranche : un fichier de regles sur un poste de developpeur ne couvre
 * NI le module PrestaShop, NI le bouton de back-office, NI la page d'import. Les
 * regles vivaient au seul endroit qui ne servait pas le cas principal. Elles
 * vivent desormais en base, par boutique (src/lib/templateRulesStore.ts), et ce
 * module-ci porte la seule chose qui doit etre commune : la CORRESPONDANCE.
 *
 * MODULE PUR : ni base, ni systeme de fichiers, ni Next. Le collecteur y ajoute
 * la lecture d'un fichier, le Studio la lecture d'une table, et tous deux
 * obtiennent le meme resultat sur le meme produit — c'est le seul moyen qu'une
 * fiche passee par un collecteur et la meme fiche demandee par un bouton
 * choisissent le meme template.
 */

/**
 * Ce dont la correspondance a besoin, et rien de plus.
 *
 * Un objet plat plutot que le payload entier : c'est ce qui rend ce module
 * utilisable depuis un collecteur (qui a un CollectedProduct) comme depuis la
 * route de rendu (qui a un payload valide), sans que l'un connaisse le type de
 * l'autre.
 */
/**
 * La valeur reservee qui demande au Studio de choisir.
 *
 * Un slug de template ne peut pas valoir « auto » : createTemplate le refuse
 * (src/lib/repository.ts). Sans cette reserve, quelqu'un creerait un template
 * nomme « auto » et la resolution deviendrait ambigue — le contrat dirait deux
 * choses avec le meme mot.
 */
export const AUTO_TEMPLATE = "auto";

export type MatchInput = {
  /** Le fil d'ariane, du plus general au plus precis. */
  categoryPath: readonly string[];
  brand?: string | null;
  /** Reference produit, pour le critere `ref`. */
  ref?: string | null;
};

const ruleSchema = z
  .object({
    /** Prefixe du fil d'ariane. ["Manutention"] attrape tous ses descendants. */
    category: z.array(z.string()).optional(),
    /**
     * Appartenance, sans notion d'ordre : le produit est-il dans l'UNE de ces
     * categories, ou qu'elle figure dans la liste ?
     *
     * Necessaire des que la source ne donne pas un vrai fil d'ariane. Un export
     * PrestaShop liste toutes les categories associees, dans un ordre qui n'est
     * pas hierarchique : "Promo,Bureaux d'entreprise,Gammes de Bureaux..."
     * commence par une categorie transversale, et aucune regle de prefixe ne
     * peut alors s'appliquer.
     */
    category_any: z.array(z.string()).optional(),
    /** Expression reguliere sur la reference de la source. Voir unsafePattern. */
    ref: z
      .string()
      .optional()
      .superRefine((pattern, ctx) => {
        const raison = pattern === undefined ? null : unsafePattern(pattern);
        if (raison) ctx.addIssue({ code: "custom", message: raison });
      }),
    brand: z.string().optional(),
    template: z.string().min(1),
  })
  .refine(
    (rule) =>
      rule.category !== undefined ||
      rule.category_any !== undefined ||
      rule.ref !== undefined ||
      rule.brand !== undefined,
    {
      message: "une regle sans critere s'appliquerait a tout : utiliser \"default\"",
    }
  );

export const templateRulesSchema = z.object({
  default: z.string().min(1).optional(),
  rules: z.array(ruleSchema).default([]),
});

export type TemplateRulesFile = z.infer<typeof templateRulesSchema>;

type CompiledRule = {
  template: string;
  category: string[] | null;
  categoryAny: string[] | null;
  ref: RegExp | null;
  brand: string | null;
  /**
   * Plus une regle porte de criteres, et plus sa categorie est profonde, plus
   * elle est specifique. C'est ce qui donne l'heritage vers les parents sans
   * dependre de l'ordre de declaration : ["Manutention","Transpalettes"] bat
   * ["Manutention"], qui bat le defaut.
   */
  score: number;
  index: number;
};

/**
 * Au-dela, une reference n'est plus une reference : une regle `ref` ne la
 * compare meme pas. C'est la seconde moitie de la protection contre le ReDoS :
 * unsafePattern ecarte les motifs exponentiels, cette borne rend les autres
 * (polynomiaux, comme `\d*\d*\d*X`) instantanes.
 */
export const MAX_REF_LENGTH = 128;

/**
 * Pourquoi ce motif serait dangereux, ou null s'il ne l'est pas.
 *
 * LE RISQUE. Le moteur d'expressions de JavaScript revient en arriere : un motif
 * comme `(a+)+$` essaie toutes les facons de decouper l'entree, et le nombre de
 * facons double a chaque caractere. Trente caracteres suffisent a bloquer le
 * processus plusieurs secondes — tout le Studio, puisque Node n'a qu'un fil. Une
 * regle s'ecrit depuis l'interface, et la reference comparee vient du payload
 * de la boutique (audit du 16/10/2026).
 *
 * CE QUI EST REFUSE : un groupe REPETE (`*`, `+`, `{n,}`, `{n,m}`) qui contient
 * lui-meme une repetition ou une alternative — la forme de tous les motifs
 * exponentiels — et les references arriere (`\1`, `\k<nom>`). Ce qu'on ecrit
 * pour reconnaitre une reference produit (`^TR-\d+$`, `^(PAL|TRP)-`) n'en a
 * jamais besoin.
 */
export function unsafePattern(pattern: string): string | null {
  try {
    new RegExp(pattern);
  } catch (cause) {
    return `expression reguliere invalide : ${cause instanceof Error ? cause.message : cause}`;
  }
  if (/\\[1-9]|\\k</.test(pattern)) {
    return "les references arriere (\\1, \\k<...>) ne sont pas permises";
  }

  // Une pile de groupes ouverts : contient-il une repetition, une alternative ?
  const pile: { repete: boolean; alterne: boolean }[] = [{ repete: false, alterne: false }];
  const repetition = (index: number): boolean => {
    const suite = pattern[index];
    if (suite === "*" || suite === "+") return true;
    // {n} seul ne repete pas au sens qui compte ; {n,} et {n,m} si.
    return suite === "{" && /^\{\d*,\d*\}/.test(pattern.slice(index));
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === "\\") {
      i += 1;
      if (repetition(i + 1)) pile[pile.length - 1].repete = true;
      continue;
    }
    if (c === "[") {
      // Une classe est un seul caractere : son contenu ne compte pas.
      for (i += 1; i < pattern.length && pattern[i] !== "]"; i += 1) if (pattern[i] === "\\") i += 1;
      if (repetition(i + 1)) pile[pile.length - 1].repete = true;
      continue;
    }
    if (c === "(") {
      pile.push({ repete: false, alterne: false });
      continue;
    }
    if (c === "|") {
      pile[pile.length - 1].alterne = true;
      continue;
    }
    if (c === ")") {
      const groupe = pile.pop() ?? { repete: false, alterne: false };
      if (pile.length === 0) pile.push({ repete: false, alterne: false });
      if (repetition(i + 1)) {
        if (groupe.repete || groupe.alterne) {
          return "un groupe repete ne peut contenir ni repetition ni alternative (risque de blocage du Studio)";
        }
        pile[pile.length - 1].repete = true;
      } else if (groupe.repete) {
        pile[pile.length - 1].repete = true;
      }
      continue;
    }
    if (repetition(i + 1)) pile[pile.length - 1].repete = true;
  }
  return null;
}

export class TemplateResolver {
  private readonly rules: CompiledRule[];
  private readonly fallback: string | undefined;

  constructor(file: TemplateRulesFile, fallback?: string) {
    this.fallback = file.default ?? fallback;
    this.rules = file.rules.map((rule, index) => ({
      template: rule.template,
      category: rule.category ? rule.category.map(normalize) : null,
      categoryAny: rule.category_any ? rule.category_any.map(normalize) : null,
      // Un motif dangereux deja en base (saisi avant ce controle) n'est pas
      // compile : la regle ne correspond plus a rien, plutot que de pouvoir
      // bloquer le processus. La saisie, elle, le refuse avec la raison.
      ref: rule.ref ? (unsafePattern(rule.ref) === null ? new RegExp(rule.ref) : NEVER) : null,
      brand: rule.brand ? normalize(rule.brand) : null,
      // Un prefixe dit plus qu'une appartenance a nombre egal de segments : il
      // situe le produit dans l'arbre au lieu de constater une etiquette.
      score:
        (rule.category ? rule.category.length * 10 : 0) +
        (rule.category_any ? 8 : 0) +
        (rule.ref ? 5 : 0) +
        (rule.brand ? 3 : 0),
      index,
    }));
  }

  /**
   * Renvoie null plutot que de deviner : sans template ni defaut, la fiche ne
   * peut pas etre rendue et l'appelant doit le dire clairement, pas retenir un
   * slug au hasard qui repondrait 404 apres coup.
   *
   * LE TEMPLATE IMPOSE N'EST PAS TRAITE ICI. C'etait le cas dans la version
   * collecteur (`if (product.template) return product.template`), et c'etait un
   * melange : ce module decide d'apres les CRITERES, l'appelant decide s'il veut
   * meme lui poser la question. La route de rendu ne l'appelle que sur
   * « template: auto », le collecteur que si la source n'a rien impose.
   */
  resolve(input: MatchInput): string | null {
    const path = (input.categoryPath ?? []).map(normalize);
    const brand = input.brand ? normalize(input.brand) : null;
    const ref = input.ref ?? "";
    const refComparable = ref.length <= MAX_REF_LENGTH;

    let best: CompiledRule | null = null;
    for (const rule of this.rules) {
      if (rule.category && !isPrefix(rule.category, path)) continue;
      if (rule.categoryAny && !rule.categoryAny.some((name) => path.includes(name))) continue;
      if (rule.ref && (!refComparable || !rule.ref.test(ref))) continue;
      if (rule.brand && rule.brand !== brand) continue;
      if (!best || rule.score > best.score || (rule.score === best.score && rule.index < best.index)) {
        best = rule;
      }
    }

    return best?.template ?? this.fallback ?? null;
  }

  /** Les slugs que ce jeu de regles peut produire, pour les verifier d'avance. */
  targets(): string[] {
    const slugs = new Set(this.rules.map((rule) => rule.template));
    if (this.fallback) slugs.add(this.fallback);
    return [...slugs];
  }
}

/** Ne correspond a rien : `$` puis `^` ne se suivent jamais sans le drapeau m. */
const NEVER = /$^/;

function isPrefix(prefix: string[], path: string[]): boolean {
  if (prefix.length > path.length) return false;
  return prefix.every((segment, index) => segment === path[index]);
}

/**
 * Casse et accents ignores : une regle ecrite "Manutention" doit attraper une
 * categorie exportee "MANUTENTION" ou "manutention". La faute de frappe qu'on
 * ne veut PAS pardonner est celle du slug de template, verifie contre
 * GET /api/v1/templates au demarrage.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
