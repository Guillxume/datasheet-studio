#!/usr/bin/env bash
#
# Sauvegarde quotidienne de la base, avec rotation. A LANCER SUR LE SERVEUR :
#
#     ./scripts/sauvegarder-base.sh
#
# A PLANIFIER EN CRON :
#
#     0 3 * * *  /chemin/vers/le/depot/scripts/sauvegarder-base.sh >> \
#                  ~/sauvegardes/datasheet-studio/cron.log 2>&1
#
# POURQUOI UN PG_DUMP SUFFIT. Le Studio ne stocke aucun PDF : il rend et
# renvoie. Tout le reste vit en base, y compris les images et les polices,
# stockees en bytea dans la table `assets`. Un pg_dump est donc une sauvegarde
# complete — templates, versions publiees, assets, boutiques, journal.
#
# POURQUOI DIRECTEMENT CONTRE LE SERVICE "db", ET NON VIA "migrate". pg_dump
# est un outil CLIENT Postgres ; l'image de "migrate" est une image Node (voir
# infra/config/app/Dockerfile) qui ne l'a pas. Le service "db", lui, tourne
# l'image Postgres officielle, qui l'a deja.
#
# `sed` ET NON `. ./.env` POUR LIRE DB_USER/DB_NAME. Un fichier d'environnement
# de compose n'est pas un script shell : infra/.env contient des backticks
# (URL=`...`, exiges par la regle Host() de Traefik) qu'un shell qui le source
# tente d'executer comme une commande.
#
# SUR ECHEC, L'ALERTE PASSE PAR scripts/alerte-sante.ts plutot que de
# reimplementer un envoi de courriel ici : un seul endroit sait comment en
# envoyer un (src/lib/mailer.ts), et il faut qu'il n'y en ait qu'un.

set -euo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPOT/infra"

DB_USER="$(sed -n 's/^DB_USER=//p' .env | head -1)"
DB_NAME="$(sed -n 's/^DB_NAME=//p' .env | head -1)"

DESTINATION="${BACKUP_DIR:-$HOME/sauvegardes/$(basename "$DEPOT")}"
RETENTION_JOURS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$DESTINATION"

FICHIER="$DESTINATION/studio-$(date +%F-%H%M).dump"
ERREUR="$(mktemp)"
trap 'rm -f "$ERREUR"' EXIT

alerter() {
  echo "$1" >&2
  # « || true » : une alerte qui echoue ne doit pas faire echouer le cron une
  # deuxieme fois pour une raison differente de celle qu'on est en train de
  # signaler.
  docker compose run --rm setup tsx scripts/alerte-sante.ts --message "$1" || true
}

if ! docker compose exec -T db pg_dump -U "$DB_USER" -Fc "$DB_NAME" >"$FICHIER" 2>"$ERREUR"; then
  cat "$ERREUR" >&2
  rm -f "$FICHIER"
  alerter "Sauvegarde de $DB_NAME en echec le $(date +%FT%T) : $(tail -n1 "$ERREUR")"
  exit 1
fi

if [ ! -s "$FICHIER" ]; then
  rm -f "$FICHIER"
  alerter "Sauvegarde de $DB_NAME vide le $(date +%FT%T) : pg_dump n'a rien ecrit."
  exit 1
fi

echo "Sauvegarde ecrite : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

# Rotation : ne garder que les N derniers jours.
find "$DESTINATION" -maxdepth 1 -name 'studio-*.dump' -mtime "+$RETENTION_JOURS" -delete
