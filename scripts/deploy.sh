#!/usr/bin/env bash
# One-command deploy to Cloudflare Pages.
#   npm run deploy
#
# Runs the unit tests, builds the app, and uploads dist/ to the "the-rebuild"
# Pages project. If a test fails, nothing is built or uploaded.
#
# Wrangler is pinned to 4.86.0, the last release that runs on Node 20 (the
# version in .nvmrc). It's also the version the deploy workflow ends up with on
# Node 20, so a manual deploy and an automatic one use the same tool.
#
# Wrangler keeps its login under XDG_CONFIG_HOME. When that isn't set, this
# script points it at ~/.local/xdg; a value you've set yourself is respected.
set -euo pipefail

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.local/xdg}"

npm test
npm run build
npx --yes wrangler@4.86.0 pages deploy dist \
  --project-name the-rebuild \
  --branch main
