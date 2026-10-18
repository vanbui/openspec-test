import { execFile } from "node:child_process";
import { constants, type Stats } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseSourceToken } from "./token-service";

const execute = promisify(execFile);
export type DevTokenExportOptions = {
  repositoryRoot: string;
  filesystem?: typeof fs;
};
const failure = () => new Error("IAM_SCIM_DEV_EXPORT_FAILED");
function absent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function same(left: Stats | null, right: Stats | null): boolean {
  return left === null ? right === null : right !== null && left.dev === right.dev && left.ino === right.ino
    && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs && left.mode === right.mode;
}

/** No shell, no env content in Git arguments or error diagnostics. */
async function assertIgnoredUntracked(root: string, relative: string): Promise<void> {
  const tracked = await execute("git", ["-C", root, "ls-files", "--", relative]);
  if (tracked.stdout !== "") throw failure();
  await execute("git", ["-C", root, "check-ignore", "--quiet", "--", relative]);
}

function upsert(text: string, token: string): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  let replaced = false;
  const result = text.replace(/^[\t ]*(?:export[\t ]+)?MIDPOINT_SCIM_TOKEN[\t ]*=[^\r\n]*(?:\r?\n|$)/gm, (line) => {
    if (replaced) return "";
    replaced = true;
    const ending = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
    return `MIDPOINT_SCIM_TOKEN=${token}${ending}`;
  });
  return replaced ? result : `${result}${result && !result.endsWith("\n") ? newline : ""}MIDPOINT_SCIM_TOKEN=${token}${newline}`;
}

/**
 * Cooperating exporters reserve one exclusive directory before reading the destination.
 * Parent ownership and permissions exclude writes by other users; identity snapshots
 * refuse changes by other processes. Secret staging stays inside the owner-only lock.
 */
export async function writeDevelopmentToken(token: string, options: DevTokenExportOptions): Promise<void> {
  const io = options.filesystem ?? fs;
  let root: string;
  try { root = await io.realpath(options.repositoryRoot); } catch { throw failure(); }
  const parent = path.join(root, "docker");
  const destination = path.join(parent, ".env");
  const lock = path.join(parent, ".env.scim-lock");
  const temporary = path.join(lock, "token");
  let reserved = false;
  let parentSnapshot: Stats | undefined;
  async function checkParent() {
    const current = await io.lstat(parent);
    if (!current.isDirectory() || current.isSymbolicLink() || (current.mode & 0o022) !== 0
      || process.getuid && current.uid !== process.getuid()) throw failure();
    if (parentSnapshot && (current.dev !== parentSnapshot.dev || current.ino !== parentSnapshot.ino)) throw failure();
    return current;
  }
  async function snapshot(): Promise<Stats | null> {
    try {
      const current = await io.lstat(destination);
      if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1
        || process.getuid && current.uid !== process.getuid()) throw failure();
      return current;
    } catch (error) { if (absent(error)) return null; throw error; }
  }
  try {
    if (!parseSourceToken(token)) throw failure();
    parentSnapshot = await checkParent();
    await assertIgnoredUntracked(root, "docker/.env");
    await assertIgnoredUntracked(root, "docker/.env.scim-lock/token");
    // Fail closed on contention or a stale lock; never remove a lock we did not create.
    await io.mkdir(lock, { mode: 0o700 });
    reserved = true;
    await checkParent();
    const before = await snapshot();
    let text = "";
    if (before) {
      const handle = await io.open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (!same(before, await handle.stat())) throw failure();
        text = await handle.readFile("utf8");
      } finally { await handle.close(); }
    }
    const staged = await io.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try {
      await staged.chmod(before ? before.mode & 0o600 : 0o600);
      await staged.writeFile(upsert(text, token), "utf8");
      await staged.sync();
    } finally { await staged.close(); }
    await assertIgnoredUntracked(root, "docker/.env");
    await checkParent();
    if (!same(before, await snapshot())) throw failure();
    await io.rename(temporary, destination);
    await checkParent();
  } catch { throw failure(); }
  finally {
    if (reserved) {
      // A replaced parent is not ours to clean. Never follow it to remove another process's files.
      try { await checkParent(); await io.rm(temporary, { force: true }); await io.rmdir(lock); }
      catch { /* Staging stays private if the original parent was moved. */ }
    }
  }
}
