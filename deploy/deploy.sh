#!/usr/bin/env bash
set -euo pipefail

# Configurable via environment variables
REPO_DIR="${REPO_DIR:-/srv/sticker-repo}"
WEB_ROOT="${WEB_ROOT:-/var/www/sticker-repo}"
BRANCH="${BRANCH:-main}"

echo "==> Pulling latest from $BRANCH"
git -C "$REPO_DIR" fetch origin
git -C "$REPO_DIR" checkout "$BRANCH"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
cd "$REPO_DIR"
npm ci --prefer-offline

echo "==> Running checks (types + lint + build)"
npm run check

echo "==> Building"
npm run build

echo "==> Copying dist to $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete dist/ "$WEB_ROOT/"

echo "==> Done. Site is live at $WEB_ROOT"
