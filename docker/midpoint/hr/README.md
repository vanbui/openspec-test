# Reference HR Identity Source

`reference.csv` is a fictitious workforce snapshot for local development. All people and addresses are fictitious; email addresses use `hr.idambox.test`. The HR Identity Source owns the identity attributes and activation of sourced users. IdamBox Roles remain managed inside IdamBox.

## Columns (D19)

Keep this exact header and column order in UTF-8 CSV; quote values containing commas or double quotes using standard CSV quoting:

```csv
employeeNumber,givenName,familyName,preferredName,email,username,department,jobTitle,status,startDate,endDate
```

| Column | Meaning |
| --- | --- |
| `employeeNumber` | Stable person identifier, preserved as text including leading zeroes; the Identity's name and correlation key. Must be unique. |
| `givenName` | Given name. |
| `familyName` | Family name. |
| `preferredName` | Optional display name; falls back to given and family names, then username. |
| `email` | Primary email address. Must be unique. |
| `username` | IdamBox User's username. Must be unique. |
| `department` | Department; a move replaces the previous value. |
| `jobTitle` | Job title. |
| `status` | `active` or `terminated`. Only `active` can enable the Identity. |
| `startDate` | Optional inclusive start date, `YYYY-MM-DD`, at 00:00 UTC. |
| `endDate` | Optional exclusive end date, `YYYY-MM-DD`, at 00:00 UTC. |

An Identity is enabled only when `status` is exactly `active` and the current time is within the supplied date bounds. A blank date leaves that bound open. A terminated or unknown status, malformed date, or end date on or before the start date disables the Identity and its sourced IdamBox User. For example, `endDate=2026-10-17` disables at the beginning of 17 October UTC. The validity scan applies date transitions every five minutes even when the CSV has not changed.

## Publish a change

Edit a copy of the full snapshot, keeping the D19 header. From the repository root:

```bash
docker/midpoint/hr-publish.sh path/to/hr.csv
```

Before replacing anything, `hr-publish.sh` validates the whole snapshot with `docker/midpoint/hr-validate.mjs` (Node): the exact header, eleven fields in every row, and a non-empty `employeeNumber`, `username` and `email` that are each unique, ignoring case. A refused snapshot leaves the live file as it was. This matters because the CSV connector does not detect duplicates: a second row with the same `employeeNumber` silently replaces the first person, renaming or terminating them. Replacing `var/hr/hr.csv` by any other means bypasses this check.

The script refuses a wrong header before calling Docker. It streams the file unchanged into the `midpoint` container and atomically replaces `/opt/midpoint/var/hr/hr.csv`, so synchronization cannot read a partially written snapshot. It validates the header, not every row; check the values before publishing.

HR live sync applies changes every five minutes, and HR reconciliation repairs drift nightly at 01:00 UTC. Removing a row deactivates its Identity and sourced IdamBox User; it never deletes either. Publish a complete snapshot each time.

The initial setup seeds `reference.csv` once into midPoint's home at `var/hr/hr.csv`, only if that file is absent. Editing the committed reference does not replace the live file; publish the snapshot explicitly.
