import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = 3001;
const ORIGIN = `http://${HOST}:${PORT}`;
const READINESS_DEADLINE_MS = 15_000;
const REQUEST_TIMEOUT_MS = 1_000;
const RETRY_DELAY_MS = 200;
const TERMINATION_GRACE_MS = 1_000;
const MAX_OUTPUT_CHARS = 8_000;
const PAGE_TITLE = "Cyber Risk Manager";
const SUPPORTING_COPY = "Your cyber risk management workspace is ready.";
const APP_DIRECTORY = fileURLToPath(new URL("..", import.meta.url));

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createBoundedOutput() {
  let value = "";

  return {
    append(chunk) {
      value = `${value}${chunk.toString()}`.slice(-MAX_OUTPUT_CHARS);
    },
    read() {
      return value || "(no output captured)";
    },
  };
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once("exit", resolve);
  });
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([waitForExit(child), delay(TERMINATION_GRACE_MS)]);

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([waitForExit(child), delay(TERMINATION_GRACE_MS)]);
  }

  if (child.exitCode === null && child.signalCode === null) {
    throw new Error("Production server did not terminate after SIGTERM and SIGKILL.");
  }
}

function assertPortReleased() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();

    listener.once("error", (error) => {
      reject(new Error(`Port ${PORT} is unavailable: ${error.message}`));
    });
    listener.listen(PORT, HOST, () => {
      listener.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });
}

async function fetchPage() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(ORIGIN, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseHtmlText(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function assertRenderedPage(html) {
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    normaliseHtmlText(match[1]),
  );
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
    normaliseHtmlText(match[1]),
  );

  if (headings.length !== 1 || headings[0] !== PAGE_TITLE) {
    throw new Error(
      `Expected exactly one h1 named "${PAGE_TITLE}", received ${JSON.stringify(headings)}.`,
    );
  }

  if (!paragraphs.includes(SUPPORTING_COPY)) {
    throw new Error(`Expected supporting sentence "${SUPPORTING_COPY}" in a paragraph.`);
  }
}

async function waitForReady(child, output) {
  const deadline = Date.now() + READINESS_DEADLINE_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Production server exited before becoming ready.\n${output.read()}`);
    }

    try {
      const response = await fetchPage();

      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received HTTP ${response.status}.`);
      }

      assertRenderedPage(await response.text());
      return;
    } catch (error) {
      lastError = error;
      await delay(RETRY_DELAY_MS);
    }
  }

  throw new Error(
    `Production server did not satisfy the runtime contract within ${READINESS_DEADLINE_MS}ms. Last error: ${lastError?.message ?? "unknown"}\n${output.read()}`,
  );
}

async function verifyRuntime() {
  await assertPortReleased();

  const output = createBoundedOutput();
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", HOST, "--port", String(PORT)],
    {
      cwd: APP_DIRECTORY,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.append(chunk));
  child.stderr.on("data", (chunk) => output.append(chunk));

  let verificationError;
  try {
    await waitForReady(child, output);
    console.log("Runtime verification passed: HTTP 200, exact foundation copy, and bounded cleanup.");
  } catch (error) {
    verificationError = error;
  }

  let cleanupError;
  try {
    await terminateChild(child);
    await assertPortReleased();
    console.log(`Runtime verification cleanup passed: port ${PORT} released.`);
  } catch (error) {
    cleanupError = error;
  }

  if (verificationError && cleanupError) {
    throw new Error(`${verificationError.message}\nCleanup failure: ${cleanupError.message}`);
  }
  if (verificationError) {
    throw verificationError;
  }
  if (cleanupError) {
    throw cleanupError;
  }
}

verifyRuntime().catch((error) => {
  console.error(`Runtime verification failed: ${error.message}`);
  process.exitCode = 1;
});
