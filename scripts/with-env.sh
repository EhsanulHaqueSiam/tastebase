#!/bin/sh
# Loads the repo's gitignored .env into the environment, then runs the command. Alchemy reads
# ALCHEMY_PROFILE (and app secrets) from the environment; its --env-file does not cover the profile.
root=$(cd "$(dirname "$0")/.." && pwd)
if [ -f "$root/.env" ]; then set -a; . "$root/.env"; set +a; fi
exec "$@"
