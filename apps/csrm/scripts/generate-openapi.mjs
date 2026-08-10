import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specificationPath = resolve(appDirectory, "docs/references/specification.json");
export const generatedOpenApiPath = resolve(
  appDirectory,
  "src/lib/api/generated/openapi.ts",
);
const require = createRequire(import.meta.url);
const openApiTypescriptCli = resolve(
  dirname(require.resolve("openapi-typescript/package.json")),
  "bin/cli.js",
);
const expectedOperationCount = 103;

function countOperations(specification) {
  const methods = new Set([
    "delete",
    "get",
    "head",
    "options",
    "patch",
    "post",
    "put",
    "trace",
  ]);

  return Object.values(specification.paths).flatMap(Object.keys).filter((method) => methods.has(method)).length;
}

async function assertSpecification() {
  const specification = JSON.parse(await readFile(specificationPath, "utf8"));
  const operationCount = countOperations(specification);

  if (specification.openapi !== "3.1.0" || operationCount !== expectedOperationCount) {
    throw new Error(
      `Expected OpenAPI 3.1.0 with ${expectedOperationCount} operations; found ${specification.openapi} with ${operationCount}.`,
    );
  }

  return operationCount;
}

function assertOutputPath(outputPath, temporaryOutputDirectory) {
  const resolvedOutput = resolve(outputPath);
  const isCommittedOutput = resolvedOutput === generatedOpenApiPath;
  const isTemporaryOutput =
    temporaryOutputDirectory &&
    (resolvedOutput === temporaryOutputDirectory ||
      resolvedOutput.startsWith(`${temporaryOutputDirectory}/`));

  if (!isCommittedOutput && !isTemporaryOutput) {
    throw new Error("OpenAPI output must be the committed artifact or an approved temporary comparison file.");
  }

  return resolvedOutput;
}

export async function generateOpenApi({
  outputPath = generatedOpenApiPath,
  temporaryOutputDirectory,
} = {}) {
  const operationCount = await assertSpecification();
  const output = assertOutputPath(outputPath, temporaryOutputDirectory && (await realpath(temporaryOutputDirectory)));
  await mkdir(dirname(output), { recursive: true });

  const result = spawnSync(
    process.execPath,
    [openApiTypescriptCli, specificationPath, "--output", output],
    { cwd: appDirectory, stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error("openapi-typescript generation failed.");
  }

  console.log(`Generated ${operationCount} OpenAPI operations at ${output}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateOpenApi().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
