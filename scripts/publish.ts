/**
 * Publishes every public package whose current version is not on npm yet.
 * `bun pm pack` rewrites `workspace:` ranges to real versions, and `npm publish`
 * uploads the tarball through npm trusted publishing (OIDC, no token needed).
 * Tags and GitHub releases are created by release-please.
 */

import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const packagesDir = join(import.meta.dir, "..", "packages");
const outDir = mkdtempSync(join(tmpdir(), "seintje-publish-"));

for (const dir of readdirSync(packagesDir)) {
  const cwd = join(packagesDir, dir);
  const pkg = await Bun.file(join(cwd, "package.json")).json();
  if (pkg.private) continue;

  const latest = await $`npm view ${pkg.name} version`.quiet().nothrow();
  const npmVersion = latest.exitCode === 0 ? latest.stdout.toString().trim() : null;
  if (npmVersion && Bun.semver.order(npmVersion, pkg.version) > 0) {
    throw new Error(`${pkg.name}@${npmVersion} on npm is newer than package.json (${pkg.version})`);
  }

  const published = await $`npm view ${`${pkg.name}@${pkg.version}`} version`.quiet().nothrow();
  if (published.exitCode === 0 && published.stdout.toString().trim() === pkg.version) {
    console.log(`${pkg.name}@${pkg.version} is already published`);
    continue;
  }

  console.log(`Publishing ${pkg.name}@${pkg.version}`);
  const tarball = (await $`bun pm pack --destination ${outDir} --quiet`.cwd(cwd).text()).trim();
  await $`npm publish ${tarball} --access public`.cwd(cwd);
}
