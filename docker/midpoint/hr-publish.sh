#!/bin/bash
# Publishes an HR CSV snapshot as the live Identity Source file in the running
# midpoint container (var/hr/hr.csv), replacing it atomically: the HR live sync
# (every 5 minutes) never reads a half-written file.
#
#   docker/midpoint/hr-publish.sh docker/midpoint/hr/reference.csv
#
# The file must keep the reference header (docker/midpoint/hr/README.md) and pass
# docker/midpoint/hr-validate.mjs; anything else is refused before the file is replaced.
set -eu
export MSYS_NO_PATHCONV=1

src="${1:?usage: hr-publish.sh <file.csv>}"
[ -f "${src}" ] || { echo "hr-publish: no such file: ${src}" >&2; exit 1; }

expected='employeeNumber,givenName,familyName,preferredName,email,username,department,jobTitle,status,startDate,endDate'
header="$(head -n 1 "${src}" | tr -d '\r')"
if [ "${header}" != "${expected}" ]; then
  echo "hr-publish: ${src}: the header must be exactly: ${expected}" >&2
  exit 1
fi

# The whole snapshot must be valid (unique, non-empty employeeNumber, username and email):
# the CSV connector would let a duplicate row silently replace a person.
node "$(dirname "$0")/hr-validate.mjs" "${src}" || { echo "hr-publish: ${src} refused; the live HR file is unchanged" >&2; exit 1; }

docker exec -i midpoint sh -c 'set -eu; umask 022; tmp=/opt/midpoint/var/hr/.hr.csv.publishing; cat > "$tmp"; mv -f "$tmp" /opt/midpoint/var/hr/hr.csv' < "${src}"
echo "hr-publish: published ${src} as the live HR file ($(($(wc -l < "${src}") - 1)) rows)"
