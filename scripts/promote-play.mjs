import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidate = resolve(root, 'dist-candidate');
const destination = resolve(root, 'dist-play');
const staging = resolve(root, '.dist-play-staging');
const manifest = JSON.parse(await readFile(resolve(candidate, 'build-info.json'), 'utf8'));
const sourceHash = createHash('sha256');
const safeFile = (base, path) => {
  const absolute = resolve(base, path);
  if (!absolute.startsWith(`${base}${sep}`)) throw new Error('Manifest path leaves the snapshot directory.');
  return absolute;
};

for (const file of [...manifest.sourceFiles].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
  const body = await readFile(safeFile(root, file.path));
  if (createHash('sha256').update(body).digest('hex') !== file.sha256) throw new Error(`Source changed after candidate validation: ${file.path}`);
}
// Match the publisher's byte-wise path ordering for the combined fingerprint.
for (const path of manifest.sourceFiles.map(file => file.path).sort()) sourceHash.update(path).update('\0').update(await readFile(safeFile(root, path))).update('\0');
if (sourceHash.digest('hex') !== manifest.sourceSha256) throw new Error('Candidate source fingerprint does not match current source.');
for (const file of [...manifest.buildFiles, ...(manifest.retainedAssets || [])]) {
  const body = await readFile(safeFile(candidate, file.path));
  if (createHash('sha256').update(body).digest('hex') !== file.sha256) throw new Error(`Candidate asset failed verification: ${file.path}`);
}
if (dirname(staging) !== root || dirname(destination) !== root) throw new Error('Refusing to replace a directory outside the owned workspace.');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(candidate, staging, { recursive: true });
await rm(destination, { recursive: true, force: true });
await rename(staging, destination);
console.log('Exact validated candidate promoted to dist-play; no rebuild performed.');
console.log(`Source SHA256: ${manifest.sourceSha256}\nBuild SHA256: ${manifest.buildSha256}`);
console.log('The running production process remains unchanged until its deliberate restart.');
