#!/usr/bin/env bash
#
# TuniOrder one-shot VPS deploy (Ubuntu/Debian, Nginx already installed).
#
# Usage (on the VPS):
#   sudo bash deploy.sh tuni.yourdomain.com you@email.com
#                       └── full subdomain   └── email for Let's Encrypt (optional;
#                                                omit to skip HTTPS for now)
#
# Idempotent: safe to re-run to redeploy the latest code.
#
set -euo pipefail

# ─── Args & config ─────────────────────────────────────────────────────────
DOMAIN="${1:-}"
EMAIL="${2:-}"
REPO="${REPO:-https://github.com/kidsavagez/POStuni.git}"
APP_DIR="${APP_DIR:-/var/www/tuni}"
PORT="${PORT:-4009}"
APP_NAME="tuni-backend"

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash deploy.sh <full-domain> [email-for-https]" >&2
  echo "Example: sudo bash deploy.sh tuni.example.com admin@example.com" >&2
  exit 1
fi

# Use sudo only if we are not already root
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

# ─── 1. Node.js 20 (only if missing or < 18) ────────────────────────────────
need_node() {
  command -v node >/dev/null 2>&1 || return 0
  [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 18 ]
}
if need_node; then
  say "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
else
  say "Node.js $(node -v) already present — skipping."
fi

# ─── 2. PM2 (process manager) ───────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  say "Installing PM2..."
  $SUDO npm install -g pm2
fi

# ─── 3. Clone or update the repo ────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  say "Updating existing checkout at $APP_DIR..."
  $SUDO git -C "$APP_DIR" pull --ff-only
else
  say "Cloning $REPO → $APP_DIR..."
  $SUDO mkdir -p "$(dirname "$APP_DIR")"
  $SUDO git clone "$REPO" "$APP_DIR"
fi

# ─── 4. Backend: env + dependencies ─────────────────────────────────────────
say "Configuring backend..."
cd "$APP_DIR/backend"
if [ ! -f .env ]; then
  $SUDO cp .env.example .env
  # Generate a strong JWT secret
  $SUDO sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
  # Lock CORS to the production domain
  echo "FRONTEND_URL=https://$DOMAIN" | $SUDO tee -a .env >/dev/null
  echo "  .env created (random JWT_SECRET, FRONTEND_URL=https://$DOMAIN)"
else
  echo "  .env already exists — leaving it untouched."
fi
$SUDO npm install --omit=dev

# ─── 5. Frontend: build with /api base ──────────────────────────────────────
say "Building frontend..."
cd "$APP_DIR/frontend"
echo "VITE_API_URL=/api" | $SUDO tee .env.production >/dev/null
$SUDO npm install
$SUDO npm run build

# ─── 6. Nginx site ──────────────────────────────────────────────────────────
say "Writing Nginx site for $DOMAIN..."
NGINX_CONF="/etc/nginx/sites-available/tuni"
$SUDO tee "$NGINX_CONF" >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    root $APP_DIR/frontend/dist;
    index index.html;

    # SPA: serve static files, fall back to index.html
    location / {
        try_files \$uri /index.html;
    }

    # API → Node backend
    location /api {
        proxy_pass http://localhost:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
$SUDO ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/tuni
$SUDO nginx -t
$SUDO systemctl reload nginx

# ─── 7. Start/restart the backend under PM2 ─────────────────────────────────
say "Starting backend on port $PORT via PM2..."
cd "$APP_DIR/backend"
if $SUDO pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  $SUDO pm2 restart "$APP_NAME" --update-env
else
  $SUDO pm2 start server.js --name "$APP_NAME"
fi
$SUDO pm2 save
# Enable PM2 on boot (best-effort)
$SUDO env PATH="$PATH" pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true

# ─── 8. HTTPS via Let's Encrypt (optional) ──────────────────────────────────
if [ -n "$EMAIL" ]; then
  say "Setting up HTTPS for $DOMAIN..."
  if ! command -v certbot >/dev/null 2>&1; then
    $SUDO apt-get update -y
    $SUDO apt-get install -y certbot python3-certbot-nginx
  fi
  $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
else
  say "Skipping HTTPS (no email given). Run later with:"
  echo "  sudo apt-get install -y certbot python3-certbot-nginx"
  echo "  sudo certbot --nginx -d $DOMAIN"
fi

say "Done! → http://$DOMAIN  (https:// once the cert is issued)"
echo "Default login: admin@tuni.com / Admin@123  (change it after first login)"
