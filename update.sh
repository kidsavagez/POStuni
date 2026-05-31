#!/usr/bin/env bash
#
# Fast code-only redeploy for TuniOrder.
#
# Pulls the latest code, rebuilds the frontend, and restarts the backend.
# Does NOT touch Nginx or SSL — your Let's Encrypt cert stays in place and
# auto-renews on its own (certbot installs a renewal timer). Use this for
# every routine update; only re-run deploy.sh when infra/TLS changes.
#
# Usage (on the VPS, from anywhere):
#   sudo bash /var/www/tuni/update.sh
#
set -euo pipefail

# Wrap everything in a function so the whole script is parsed into memory
# before running — that way `git pull` updating this file mid-run is harmless.
main() {
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  APP_NAME="tuni-backend"
  if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi
  say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

  # The repo is root-owned (cloned via sudo); tell git that's trusted.
  $SUDO git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$APP_DIR" \
    || $SUDO git config --global --add safe.directory "$APP_DIR"

  say "Pulling latest code..."
  $SUDO git -C "$APP_DIR" pull --ff-only

  say "Installing backend dependencies..."
  ( cd "$APP_DIR/backend" && $SUDO npm install --omit=dev )

  say "Building frontend..."
  ( cd "$APP_DIR/frontend" && $SUDO npm install && $SUDO npm run build )

  say "Restarting backend..."
  if $SUDO pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    $SUDO pm2 restart "$APP_NAME" --update-env
  else
    ( cd "$APP_DIR/backend" && $SUDO pm2 start server.js --name "$APP_NAME" )
  fi
  $SUDO pm2 save

  say "Done — updated without touching Nginx or SSL."
}

main "$@"
