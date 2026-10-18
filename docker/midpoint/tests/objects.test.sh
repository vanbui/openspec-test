#!/bin/bash
# Offline structural and safety checks for every numbered object and D19 data.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
python3 - "${HERE}/.." <<'PY'
import csv
import re
import sys
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

base = Path(sys.argv[1])
failures = 0


def check(label, passed):
    global failures
    print(('PASS ' if passed else 'FAIL ') + label)
    failures += not passed


def local(tag):
    return tag.rsplit('}', 1)[-1]


objects = sorted((base / 'objects').glob('[0-9][0-9][0-9]-*.xml'))
check('numbered objects exist', bool(objects))
oids = set()
ns = {
    'c': 'http://midpoint.evolveum.com/xml/ns/public/common/common-3',
    'cap': 'http://midpoint.evolveum.com/xml/ns/public/resource/capabilities-3',
}
restricted = re.compile(r'(?i)(?:^|[^a-z0-9])(?:roles?|password|externalSubject)(?:$|[^a-z0-9])')
idambox_found = False
for path in objects:
    raw = path.read_text(encoding='utf-8')
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        check(f'{path.name}: well-formed XML', False)
        continue
    check(f'{path.name}: well-formed XML', True)
    oid = root.get('oid', '')
    try:
        fixed = str(uuid.UUID(oid)) == oid
    except ValueError:
        fixed = False
    check(f'{path.name}: unique fixed OID', fixed and oid not in oids)
    oids.add(oid)
    clear_values = [node for node in root.iter() if local(node.tag) == 'clearValue']
    # The Phase 1 discovery spike talks to an unauthenticated stub and carries a
    # documented non-secret placeholder; every other clearValue is the token slot.
    allowed = {'@@MIDPOINT_SCIM_TOKEN@@'} | ({'spike-placeholder-no-auth'} if path.name == '110-resource-scim-spike.xml' else set())
    check(f'{path.name}: clearValue uses only the token placeholder', all(
        node.text in allowed and len(node) == 0 for node in clear_values
    ))
    check(f'{path.name}: no literal SCIM token', not re.search(r'idb_scim_v1\.[a-z0-9]{24}\.[A-Za-z0-9_-]{43}', raw))
    unsafe = False
    # Inspect the enclosing property and all mapping paths, including mappings
    # below credentials; XML comments do not participate in these checks.
    def inspect(node, ancestors=()):
        global unsafe
        if local(node.tag) == 'outbound':
            context = [local(parent.tag) for parent in ancestors]
            for parent in ancestors:
                context.extend(child.text or '' for child in parent if local(child.tag) == 'ref')
            context.extend(child.text or '' for child in node.iter() if local(child.tag) in ('path', 'ref', 'code'))
            if any(restricted.search(value) for value in context):
                unsafe = True
        for child in node:
            inspect(child, ancestors + (node,))
    inspect(root)
    check(f'{path.name}: no roles/password/externalSubject outbound mapping', not unsafe)
    if oid == '11000000-0000-4000-8000-000000000110':
        idambox_found = True
        enabled = root.findall('c:capabilities/c:configured/cap:delete/cap:enabled', ns)
        check('IdamBox resource disables delete', len(enabled) == 1 and enabled[0].text == 'false')
check('IdamBox resource exists', idambox_found)

header = 'employeeNumber,givenName,familyName,preferredName,email,username,department,jobTitle,status,startDate,endDate'.split(',')
with (base / 'hr/reference.csv').open(encoding='utf-8', newline='') as stream:
    reader = csv.reader(stream, strict=True)
    check('reference CSV has exactly the D19 header', next(reader, None) == header)
    rows = list(reader)
check('reference CSV contains complete rows', bool(rows) and all(len(row) == len(header) for row in rows))
if all(len(row) == len(header) for row in rows):
    records = [dict(zip(header, row)) for row in rows]
    for key in ('employeeNumber', 'username', 'email'):
        values = [record[key].strip().casefold() for record in records]
        check(f'reference CSV has nonblank unique {key}', all(values) and len(values) == len(set(values)))
    check('reference CSV uses only fictitious idambox.test addresses', all(
        re.fullmatch(r'[^@\s]+@(?:[a-z0-9-]+\.)*idambox\.test', record['email'])
        for record in records
    ))
print(f'{failures} FAILED' if failures else 'ALL PASS')
sys.exit(1 if failures else 0)
PY
