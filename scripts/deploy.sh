#!/usr/bin/env bash
# One-command deploy to Cloudflare Pages.
#   npm run deploy
#
# Builds the app and uploads dist/ to the "the-rebuild" Pages project.
# XDG_CONFIG_HOME defaults to a writable dir (this machine's ~/.config is
# root-owned, so Wrangler's token lives in ~/.local/xdg). If you've set
# XDG_CONFIG_HOME yourself, that value is respected.
set -euo pipefail

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.local/xdg}"

npm run build
npx --yes wrangler@latest pages deploy dist \
  --project-name the-rebuild \
  --branch main \
  --commit-dirty true
