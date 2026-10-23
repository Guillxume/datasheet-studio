import { readFile } from "node:fs/promises";
import {
  TemplateResolver,
  templateRulesSchema,
  type MatchInput,
  type TemplateRulesFile,
} from "@/lib/templateRules";
import type { CollectedProduct } from "./types";

/**
 * Regles de template, cote collecteur : la lecture du fichier, et rien d'autre.
 *
 * LA CORRESPONDANCE A DEMENAGE dans src/lib/templateRules.ts, partagee avec le
 * Studio. La raison est en tete de ce module-la : un fichier de regles sur un
 * poste de developpeur ne couvrait ni le module PrestaShop, ni le bouton de
 * back-office, ni la page d'import. Le moteur devait etre commun pour qu'une
 * fiche passee par un collecteur et la meme fiche demandee par un bouton
 * choisissent le meme template.
 *
 * Ce qui reste ici est ce qui n'a de sens QUE cote collecteur : lire un fichier
 * JSON, et savoir qu'un `product.template` fourni par la source court-circuite
 * tout.
 *
 * Le fichier de regles garde donc toute sa valeur, et son sens s'est precise :
 * il signifie desormais « je passe outre les regles du Studio ».
 *
 *   {
 *     "default": "fiche-technique-01",
 *     "rules": [
 *       { "category": ["Manutention", "Transpalettes"], "template": "fiche-transpalette" },
 *       { "category": ["Manutention"], "template": "fiche-manutention" },
 *       { "category_any": ["Bureaux Droits Individuels"], "template": "fiche-bureau" },
 *       { "ref": "^TPM-", "template": "fiche-transpalette" }
 *     ]
 *   }
 */

export { templateRulesSchema, type TemplateRulesFile };

/** Le produit collecte, reduit a ce dont la correspondance a besoin. */
export function matchInputOf(product: CollectedProduct): MatchInput {
  return {
    categoryPath: product.data.product.category_path ?? [],
    brand: product.data.product.brand ?? null,
    ref: product.ref,
  };
}

export class FileTemplateResolver {
  private readonly moteur: TemplateResolver;

  /**
   * MEME SIGNATURE QU'AVANT LE DEMENAGEMENT, deliberement : onze tests et deux
   * appels dans run.ts construisent cette classe directement. Les reecrire pour
   * passer un moteur plutot qu'un fichier de regles aurait ete du bruit dans le
   * diff, et aurait fait relire onze tests qui n'ont aucune raison de changer.
   */
  constructor(file: TemplateRulesFile, fallback?: string) {
    this.moteur = new TemplateResolver(file, fallback);
  }

  static async load(path: string | undefined, fallback?: string): Promise<FileTemplateResolver> {
    if (!path) {
      return new FileTemplateResolver({ rules: [] }, fallback);
    }

    const parsed = templateRulesSchema.safeParse(JSON.parse(await readFile(path, "utf8")));
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`)
        .join(" ; ");
      throw new Error(`regles de template invalides (${path}) — ${issues}`);
    }

    return new FileTemplateResolver(parsed.data, fallback);
  }

  /**
   * Un template impose par la SOURCE court-circuite les regles.
   *
   * Ce court-circuit vit ici et non dans le moteur : le moteur decide d'apres
   * les criteres, l'appelant decide s'il veut meme lui poser la question. La
   * route de rendu du Studio a le meme choix a faire, avec une autre reponse
   * (« template: auto »), et melanger les deux dans le moteur obligeait chacun
   * a subir la convention de l'autre.
   */
  resolve(product: CollectedProduct): string | null {
    if (product.template) return product.template;
    return this.moteur.resolve(matchInputOf(product));
  }

  /** Les slugs que ce jeu de regles peut produire, pour les verifier d'avance. */
  targets(): string[] {
    return this.moteur.targets();
  }
}

/**
 * Ancien nom, conserve pour que les appels existants continuent de compiler.
 * `FileTemplateResolver` dit ce que la classe fait — lire un fichier — la ou
 * `TemplateResolver` designe maintenant le moteur partage.
 */
export { FileTemplateResolver as TemplateResolver };
