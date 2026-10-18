#!/bin/bash
# Claude Cloud environment setup for IdamBox CSRM.
# Toolchain (mirrors the verified local workstation, 2026-10-12):
#   Node 24.21.0 (repo engines: >=24.19.0 <25), pnpm 11.24.0 (packageManager),
#   GSD Core 1.15.0 (@opengsd/gsd-core — replaces the deprecated get-shit-done-cc),
#   Playwright 1.58.2 Chromium (matches apps/csrm @playwright/test).
# Keycloak and ClamAV (docker/) are not needed: the example env runs CSRM in
# dev-identity mode with the development attachment scanner.
set -uo pipefail

NODE_VERSION=24.21.0
PNPM_VERSION=11.24.0
GSD_CORE_VERSION=1.15.0
PLAYWRIGHT_VERSION=1.58.2

export PATH="/opt/node24/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

# --- Node 24 ---------------------------------------------------------------
if [ "$(/opt/node24/bin/node -v 2>/dev/null)" != "v${NODE_VERSION}" ]; then
  rm -rf /opt/node24 && mkdir -p /opt/node24
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C /opt/node24 --strip-components=1 || exit 1
fi

# --- Global CLIs -----------------------------------------------------------
# Remove the deprecated GSD package if the base image has it, then install gsd-core.
npm uninstall -g get-shit-done-cc >/dev/null 2>&1 || true
npm install -g "pnpm@${PNPM_VERSION}" "@opengsd/gsd-core@${GSD_CORE_VERSION}" "playwright@${PLAYWRIGHT_VERSION}" || exit 1

# Expose Node 24 and the global CLIs on the default PATH. Setup-script exports do
# not carry into the Claude session, and GSD hooks resolve node via
# `command -v node`, /usr/local/bin/node or /usr/bin/node.
for bin in /opt/node24/bin/*; do ln -sf "$bin" "/usr/local/bin/$(basename "$bin")"; done

# --- GSD Core for Claude Code (global: ~/.claude skills, agents, hooks) ----
# The installer also scans for and removes legacy get-shit-done-cc artifacts.
gsd-core --claude --global < /dev/null || exit 1

# --- Playwright Chromium (e2e uses Desktop Chrome devices only) -------------
playwright install-deps chromium > /tmp/playwright-deps.log 2>&1 &
playwright_deps_pid=$!
playwright install chromium > /tmp/playwright-browser.log 2>&1 &
playwright_browser_pid=$!
pnpm_install_pid=""

# --- Repo bootstrap (only when the repo is already checked out here) --------
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/pnpm-workspace.yaml" ]; then
  cd "$REPO_ROOT" || exit 1
  pnpm install --frozen-lockfile > /tmp/pnpm-install.log 2>&1 &
  pnpm_install_pid=$!

  # Local env files are gitignored; create dev ones from the committed examples
  # with throwaway Strapi secrets. Never overwrite an existing file.
  if [ ! -f apps/backend/.env ] && [ -f apps/backend/.env.example ]; then
    rand() { openssl rand -base64 32 | tr -d '\n'; }
    sed -e "s|^APP_KEYS=.*|APP_KEYS=\"$(rand),$(rand)\"|" \
        -e "s|^API_TOKEN_SALT=.*|API_TOKEN_SALT=$(rand)|" \
        -e "s|^ADMIN_JWT_SECRET=.*|ADMIN_JWT_SECRET=$(rand)|" \
        -e "s|^TRANSFER_TOKEN_SALT=.*|TRANSFER_TOKEN_SALT=$(rand)|" \
        -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand)|" \
        -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(rand)|" \
        apps/backend/.env.example > apps/backend/.env
  fi
  if [ ! -f apps/csrm/.env.local ] && [ -f apps/csrm/.env.local.example ]; then
    cp apps/csrm/.env.local.example apps/csrm/.env.local
  fi
fi

# A bare wait discards each child's exit status. Keep every required install's
# status so a failed environment bootstrap cannot be reported as successful.
setup_failed=0
if ! wait "$playwright_deps_pid"; then
  echo "Chromium system dependency installation failed; see /tmp/playwright-deps.log" >&2
  setup_failed=1
fi
if ! wait "$playwright_browser_pid"; then
  echo "Chromium installation failed; see /tmp/playwright-browser.log" >&2
  setup_failed=1
fi
if [ -n "$pnpm_install_pid" ] && ! wait "$pnpm_install_pid"; then
  echo "Repository dependency installation failed; see /tmp/pnpm-install.log" >&2
  setup_failed=1
fi
if [ "$setup_failed" -ne 0 ]; then
  tail -n 20 /tmp/playwright-deps.log /tmp/playwright-browser.log /tmp/pnpm-install.log 2>/dev/null >&2
  exit 1
fi
chmod -R a+rX /opt/ms-playwright 2>/dev/null || true
# Also serve browsers from the default cache path in case PLAYWRIGHT_BROWSERS_PATH
# is not set in the environment's variables.
mkdir -p "$HOME/.cache" && [ ! -e "$HOME/.cache/ms-playwright" ] \
  && ln -s /opt/ms-playwright "$HOME/.cache/ms-playwright"

# --- Summary (visible in the setup log) ------------------------------------
echo "node $(node -v) | pnpm $(pnpm -v) | gsd-core $(cat "$HOME/.claude/gsd-core/VERSION" 2>/dev/null || echo missing) | playwright $(playwright --version 2>/dev/null)"
tail -n 3 /tmp/playwright-browser.log /tmp/pnpm-install.log 2>/dev/null
exit 0
