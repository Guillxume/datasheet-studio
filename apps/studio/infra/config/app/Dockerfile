# syntax=docker/dockerfile:1

# Image du Studio, construite DEPUIS LA RACINE DU DEPOT (contexte = monorepo) :
#
#   docker build -f apps/studio/infra/config/app/Dockerfile --target app .
#
# Cibles :
#   tools  sources, node_modules et tsx — migrations, amorce de demonstration,
#          scripts d'exploitation (docker compose run --rm setup ...)
#   app    sortie standalone de Next, sans devDependencies — ce qui tourne.
#
# Le design system (@guillxume/ui) est un paquet du workspace : il est construit
# ici, avant le Studio, qui le consomme depuis son dist/. Aucun registre prive,
# aucun jeton.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo


# --- Dependances -------------------------------------------------------------
#
# Les seuls manifestes d'abord : tant qu'aucun package.json ni le lockfile ne
# change, cette couche reste en cache et une modification de source ne relance
# pas l'installation.
#
# node_modules A PLAT (node-linker=hoisted), dans l'image seulement. Avec la
# disposition par liens de pnpm, la sortie standalone de Next ne recopiait que
# le lien de `next` : les paquets que le serveur charge a l'execution
# (react-dom/server pour le HTML des fiches) manquaient, et chaque rendu
# repondait 500 « Cannot find package 'react-dom' ». A plat, le tracage de
# Next retrouve la disposition qu'il attend.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/
COPY packages/ui/patches packages/ui/patches
COPY apps/studio/package.json apps/studio/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --config.node-linker=hoisted


# --- Build -------------------------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1

# DATABASE_URL de facade, requise par le BUILD et jamais utilisee.
#
# POURQUOI. src/lib/db.ts cree son client a l'import (`export const sql = ...`)
# et lit donc DATABASE_URL a l'evaluation du module. `next build` evalue les
# modules des routes pour en collecter les metadonnees : sans la variable, le
# build echoue sur « Variable d'environnement manquante » (src/lib/env.ts).
#
# POURQUOI C'EST SANS DANGER. postgres.js n'ouvre aucune connexion a la
# construction du client, et toutes les routes qui touchent la base sont en
# `force-dynamic` : rien n'est prerendu, aucune requete ne part pendant le
# build. La cible `app` repart d'une image neuve et ne la recopie pas.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build

COPY . .
RUN pnpm --filter @guillxume/ui build && pnpm --filter @guillxume/studio build


# --- Outils : migrations et scripts, depuis le reseau interne ---------------
#
# tsx appele par son chemin, pas par `pnpm exec` : corepack a installe pnpm
# pour root, et l'utilisateur `node` le retelechargerait a chaque lancement.
FROM build AS tools
ENV NODE_ENV=development
ENV PATH=/repo/apps/studio/node_modules/.bin:/repo/node_modules/.bin:$PATH
WORKDIR /repo/apps/studio
USER node
CMD ["tsx", "scripts/migrate.ts"]


# --- Application : sortie standalone ----------------------------------------
FROM node:22-alpine AS app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# qpdf assemble les books SUR LE DISQUE et rend leur sommaire cliquable
# (src/lib/qpdf.ts). Absent, le book retombe sur Gotenberg, sommaire sans liens.
RUN apk add --no-cache qpdf

# Un utilisateur non root : le conteneur n'a besoin d'ecrire nulle part, le
# Studio ne stocke aucun PDF.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app

# EN MONOREPO, LA SORTIE STANDALONE REPRODUIT L'ARBORESCENCE DU DEPOT : Next
# trace depuis la racine du workspace (celle du lockfile), le serveur est donc
# dans apps/studio/ et les node_modules a cote de la racine.
COPY --from=build --chown=nextjs:nodejs /repo/apps/studio/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/studio/.next/static ./apps/studio/.next/static

# public/ N'EST PAS INCLUS DANS LA SORTIE STANDALONE, et il faut le copier a la
# main. L'oubli ne casse rien de visible au build : les polices de l'interface
# repondent alors 404, le navigateur retombe en silence sur la pile systeme.
COPY --from=build --chown=nextjs:nodejs /repo/apps/studio/public ./apps/studio/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/studio/server.js"]
