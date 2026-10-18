#!/bin/sh
# Renders one numbered midPoint object to stdout, inside the midpoint containers
# (installed as /opt/midpoint/bin/idambox-render.sh).
#
#   idambox-render.sh /opt/midpoint/objects-src/110-resource-idambox-scim.xml
#
# The only placeholder is @@MIDPOINT_SCIM_TOKEN@@: the dev Identity Source's
# SCIM bearer token, read from the container environment (docker/.env, written by
# `pnpm --dir apps/backend scim:token "midPoint (dev)" rotate --write-dev-env`).
# The token is checked against the exact issued format (which holds no XML
# special characters), so it is substituted without escaping or evaluation. Any
# other @@...@@ placeholder, a missing or malformed token, or an unreadable file
# fails with a non-zero exit code and no output, so a broken token never replaces
# a working one. The token itself is never printed to stderr.
set -eu

src="${1:?usage: idambox-render.sh <object.xml>}"
[ -f "${src}" ] && [ -r "${src}" ] || { echo "render: cannot read ${src}" >&2; exit 1; }

placeholder='@@MIDPOINT_SCIM_TOKEN@@'
others="$(grep -o '@@[A-Za-z0-9_]*@@' "${src}" | grep -v -x -F "${placeholder}" || true)"
if [ -n "${others}" ]; then
  echo "render: $(basename "${src}"): unsupported placeholder $(printf '%s' "${others}" | head -1)" >&2
  exit 1
fi

if ! grep -q -F "${placeholder}" "${src}"; then
  cat "${src}"
  exit 0
fi

token="${MIDPOINT_SCIM_TOKEN:-}"
if ! printf '%s' "${token}" | grep -q -x -E 'idb_scim_v1\.[a-z0-9]{24}\.[A-Za-z0-9_-]{43}'; then
  echo "render: $(basename "${src}"): MIDPOINT_SCIM_TOKEN is missing or malformed; issue it with scim:token --write-dev-env and recreate the midpoint containers (docker/README.md)" >&2
  exit 1
fi

# The token matches [A-Za-z0-9._-] only, so it is safe as a sed replacement
# (no '#', '&', '\' or newline).
sed "s#${placeholder}#${token}#g" "${src}"
