#!/usr/bin/env bash
# Pull the latest code and restart the app. Run on the server as `ubuntu`:
#   /var/www/apps/coffee-cost-report/deploy/update.sh
#
# data/ is gitignored and never touched here, so uploaded MB51 data and the
# STD / unit-weight masters survive every deploy.

set -euo pipefail

APP_DIR="/var/www/apps/coffee-cost-report"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
# Full install (not --omit=dev): the build needs typescript + tailwind.
npm ci

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart coffee-cost-report

sleep 3
sudo systemctl status coffee-cost-report --no-pager --lines=10

echo "==> Done: https://www.cpr-one.com/coffee-cost-report"
