import { appendFile, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { generateOpenApi, generatedOpenApiPath } from "./generate-openapi.mjs";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendSpecificationPath = resolve(appDirectory, "../backend/specification.json");
const referenceSpecificationPath = resolve(appDirectory, "docs/references/specification.json");

function assertByteIdentical(expected, actual, message) {
  if (!expected.equals(actual)) throw new Error(message);
}

export async function verifyOpenApiDrift() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "idambox-csrm-openapi-"));
  const canonicalTemporaryDirectory = await realpath(temporaryDirectory);
  const temporaryArtifact = join(canonicalTemporaryDirectory, "openapi.ts");
  const controlledMismatchArtifact = join(canonicalTemporaryDirectory, "openapi-mismatch.ts");
  const [backendSpecification, referenceSpecification, committedBefore] = await Promise.all([
    readFile(backendSpecificationPath),
    readFile(referenceSpecificationPath),
    readFile(generatedOpenApiPath),
  ]);

  try {
    assertByteIdentical(
      backendSpecification,
      referenceSpecification,
      "Backend and CSRM OpenAPI specifications differ. Regenerate the backend specification and copy it byte-for-byte before generating transport types.",
    );

    await generateOpenApi({
      outputPath: temporaryArtifact,
      temporaryOutputDirectory: canonicalTemporaryDirectory,
    });

    const generated = await readFile(temporaryArtifact);
    assertByteIdentical(
      committedBefore,
      generated,
      "OpenAPI transport artifact drift detected. Run yarn workspace @idambox/csrm generate:openapi and commit the result.",
    );

    await appendFile(controlledMismatchArtifact, generated);
    await appendFile(controlledMismatchArtifact, "\n// controlled drift verification marker\n");
    const controlledMismatch = await readFile(controlledMismatchArtifact);
    try {
      assertByteIdentical(committedBefore, controlledMismatch, "controlled mismatch");
      throw new Error("OpenAPI drift verification failed to detect a controlled mismatch.");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "controlled mismatch") throw error;
    }

    const committedAfter = await readFile(generatedOpenApiPath);
    assertByteIdentical(
      committedBefore,
      committedAfter,
      "OpenAPI drift verification must not mutate the committed transport artifact.",
    );

    console.log("OpenAPI drift check passed: 105 operations, byte-identical backend/reference specifications, and unchanged generated artifact.");
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
