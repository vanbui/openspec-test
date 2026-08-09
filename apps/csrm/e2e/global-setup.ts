import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));

export default async function globalSetup() {
  await new Promise<void>((resolve, reject) => {
    const build = execFile("yarn", ["build"], { cwd: appRoot }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    build.stdout?.pipe(process.stdout);
    build.stderr?.pipe(process.stderr);
  });
}
