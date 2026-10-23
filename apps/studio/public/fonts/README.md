# Polices du Studio

## IBM Plex Sans — l'interface du back-office

- **Fichier** : `ibm-plex-sans-variable.woff2` — variable sur l'axe de graisse
  (100 a 700), un seul fichier pour toutes les graisses utilisees
- **Sous-ensemble** : latin
- **Provenance** : paquet npm `@fontsource-variable/ibm-plex-sans`, version 5.3.0
- **Licence** : SIL Open Font License 1.1 — texte integral dans
  `LICENSE-IBMPlexSans.txt`
- **Consommee par** : `--font-ui` dans `src/app/tokens.css`. Sert uniquement le
  back-office (barre de sections, panneaux, boites de dialogue) — jamais les
  fiches PDF, voir plus bas.

## Jost — reservee aux fiches imprimees

- **Fichiers** : `jost-400.woff2` (regulier), `jost-500.woff2` (medium)
- **Sous-ensemble** : latin
- **Provenance** : paquet npm `@fontsource/jost`, version 5.3.0
- **Licence** : SIL Open Font License 1.1 — texte integral dans `LICENSE-Jost.txt`
- **Consommee par** : `scripts/install-typography.ts`, qui la televerse dans la
  bibliotheque d'assets d'un template pour en faire la police DU DOCUMENT rendu
  (`--font-body` dans la feuille du template — rien a voir avec `--font-ui`
  ci-dessus). C'est un choix de mise en page pour une fiche donnee, independant
  de la police du back-office qui la compose.

## Les deux licences

Ni l'une ni l'autre n'est decorative : la OFL exige que sa notice accompagne
les fichiers de police partout ou ils sont redistribues. Ne pas les supprimer,
et les conserver si ces fichiers sont copies ailleurs.

La OFL autorise l'usage commercial, la modification et l'embarquement dans un
document. Elle interdit la vente des fichiers de police seuls et impose que toute
version modifiee soit renommee.

## Installer Jost dans la bibliotheque du Studio (pour une fiche imprimee)

```sh
npx tsx scripts/install-typography.ts --template <slug-du-template>
```

Sans argument, le script liste les templates disponibles et n'ecrit rien.
