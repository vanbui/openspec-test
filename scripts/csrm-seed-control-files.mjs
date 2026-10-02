import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CONTROL_DIRECTORY = ["apps", "backend", "src", "bootstrap", "controls"];

/*
 * The control files the CSRM seed loads, read from the seed's own declarations so that the verifiers never
 * keep a second list: the vendored catalogues (CONTROL_CATALOGUE_FILES) and the CSRM title file
 * (CONTROL_TITLE_FILE, D-46), which sits beside them and is not a catalogue.
 */
export function readSeedControlFiles(root) {
  const seedSource = readFileSync(
    join(root, "apps", "backend", "src", "bootstrap", "seed-csrm-data.ts"),
    "utf8",
  );
  const catalogueList = seedSource.match(
    /const CONTROL_CATALOGUE_FILES = \[([\s\S]*?)\] as const;/,
  );
  const titleFile = seedSource.match(/const CONTROL_TITLE_FILE = "([^"]+)";/);

  if (!catalogueList || !titleFile) {
    throw new Error(
      "CSRM seed must declare CONTROL_CATALOGUE_FILES and CONTROL_TITLE_FILE",
    );
  }

  const catalogueFiles = [...catalogueList[1].matchAll(/"([^"]+)"/g)].map(
    ([, sourceFile]) => sourceFile,
  );

  if (
    catalogueFiles.length === 0 ||
    new Set(catalogueFiles).size !== catalogueFiles.length ||
    catalogueFiles.includes(titleFile[1])
  ) {
    throw new Error(
      "CSRM seed must list distinct control catalogues, apart from its title file",
    );
  }

  return { catalogueFiles, titleFile: titleFile[1] };
}
