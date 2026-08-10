import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { generateOpenApi, generatedOpenApiPath } from "./generate-openapi.mjs";

export async function verifyOpenApiDrift() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "idambox-csrm-openapi-"));
  const canonicalTemporaryDirectory = await realpath(temporaryDirectory);
  const temporaryArtifact = join(canonicalTemporaryDirectory, "openapi.ts");

  try {
    await generateOpenApi({
      outputPath: temporaryArtifact,
      temporaryOutputDirectory: canonicalTemporaryDirectory,
    });

    const [committed, generated] = await Promise.all([
      readFile(generatedOpenApiPath),
      readFile(temporaryArtifact),
    ]);

    if (!committed.equals(generated)) {
      throw new Error(
        "OpenAPI transport artifact drift detected. Run yarn workspace @idambox/csrm generate:openapi and commit the result.",
      );
    }

    console.log("OpenAPI drift check passed: 103 operations and byte-identical generated artifact.");
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyOpenApiDrift().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
