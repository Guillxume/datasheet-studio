/*
 * ESSAI @guillxume/ui — le plugin Tailwind vient du package.
 *
 * Il passe sur TOUTES les feuilles du Studio. Seule src/app/essai-ui/ui.css
 * importe Tailwind ; les autres traversent Lightning CSS, qui ajoute des replis
 * aux `color-mix()` de Puck (bloc @supports) et quelques prefixes. Les regles du
 * Studio sortent identiques : verifie en comparant les CSS de `next build`
 * avant et apres.
 */
export { default } from "@guillxume/ui/postcss.config";
