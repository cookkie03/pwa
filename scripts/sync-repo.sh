#!/bin/sh
# Pulls the latest committed version of every webapp in this monorepo.
# Run manually, via cron, or as the "repo-sync" service in each app's
# docker-compose.yml (executed before the app container starts).
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

git config --global --add safe.directory "$REPO_DIR" >/dev/null 2>&1 || true

echo "Syncing $REPO_DIR with origin..."
git -C "$REPO_DIR" fetch origin
git -C "$REPO_DIR" pull --ff-only
echo "Repo up to date: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
