/**
 * Publishes every public package whose current version is not on npm yet.
 * Uses `bun publish`, which rewrites `workspace:` ranges to real versions,
 * then lets Changesets create the git tags.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const root = join(import.meta.dir, "..");
const packagesDir = join(root, "packages");

for (const dir of readdirSync(packagesDir)) {
  const cwd = join(packagesDir, dir);
  const pkg = await Bun.file(join(cwd, "package.json")).json();
  if (pkg.private) continue;

  const published = await $`npm view ${`${pkg.name}@${pkg.version}`} version`.quiet().nothrow();
  if (published.exitCode === 0 && published.stdout.toString().trim() === pkg.version) {
    console.log(`${pkg.name}@${pkg.version} is already published`);
    continue;
  }

  console.log(`Publishing ${pkg.name}@${pkg.version}`);
  await $`bun publish --access public`.cwd(cwd);
}

await $`bunx changeset tag`.cwd(root);
