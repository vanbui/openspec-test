#!/usr/bin/env node
// Validates a complete HR CSV snapshot before docker/midpoint/hr-publish.sh replaces the
// live Identity Source file. The CSV connector does not detect duplicate keys: a second row
// with the same employeeNumber silently replaces the first person (renaming or terminating
// them), so a snapshot is accepted whole or not at all (P4-05, P4-06).
//
//   node docker/midpoint/hr-validate.mjs <file.csv>
//
// Exit 0 when valid; otherwise 1 with one line per problem (row numbers count the header as
// row 1). Row-level activation problems (unknown status, malformed dates) are not refused
// here: midPoint disables such a person (100-resource-hr-csv.xml).
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const HEADER = ['employeeNumber', 'givenName', 'familyName', 'preferredName', 'email', 'username',
  'department', 'jobTitle', 'status', 'startDate', 'endDate'];

/** RFC 4180 records: comma-separated, double-quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text) {
  const records = []; let record = []; let field = ''; let quoted = false; let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === '"') throw new Error('a quote inside an unquoted field');
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field); records.push(record); record = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('an unterminated quoted field');
  if (field !== '' || record.length) { record.push(field); records.push(record); }
  return records.filter(r => !(r.length === 1 && r[0] === ''));
}

export function validateSnapshot(text) {
  let records;
  try { records = parseCsv(text); } catch (error) { return [`not valid CSV: ${error.message}`]; }
  const problems = [];
  if (!records.length || records[0].join(',') !== HEADER.join(',')) {
    return [`the header must be exactly: ${HEADER.join(',')}`];
  }
  const seen = { employeeNumber: new Map(), username: new Map(), email: new Map() };
  records.slice(1).forEach((fields, index) => {
    const row = index + 2;
    if (fields.length !== HEADER.length) { problems.push(`row ${row}: ${fields.length} fields, expected ${HEADER.length}`); return; }
    const value = name => fields[HEADER.indexOf(name)].trim();
    for (const name of Object.keys(seen)) {
      const v = value(name);
      if (!v) { problems.push(`row ${row}: ${name} is empty`); continue; }
      const key = v.toLowerCase();
      if (seen[name].has(key)) problems.push(`row ${row}: duplicate ${name} "${v}" (first in row ${seen[name].get(key)})`);
      else seen[name].set(key, row);
    }
    if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) problems.push(`row ${row}: email "${value('email')}" is not an address`);
  });
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) { process.stderr.write('usage: hr-validate.mjs <file.csv>\n'); process.exit(2); }
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { process.stderr.write(`hr-validate: cannot read ${file}\n`); process.exit(1); }
  const problems = validateSnapshot(text);
  for (const problem of problems) process.stderr.write(`hr-validate: ${file}: ${problem}\n`);
  process.exit(problems.length ? 1 : 0);
}
