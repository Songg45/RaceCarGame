import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.slice(2).some(argument => argument !== '--candidate')) throw new Error('Only --candidate is supported.');
const candidate = process.argv.includes('--candidate');
const destination = resolve(root, candidate ? 'dist-candidate' : 'dist-play');
const staging = resolve(root, candidate ? '.dist-candidate-staging' : '.dist-play-staging');
const verifyOwnedPath = path => {
  if (dirname(path) !== root || ![destination, staging].includes(path)) throw new Error('Refusing to replace a path outside the owned play output.');
};

async function directoryFiles(directory, prefix = '') {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) paths.push(...await directoryFiles(resolve(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) paths.push(relative);
  }
  return paths.sort();
}

async function fingerprint(base, paths) {
  const combined = createHash('sha256'), files = [];
  for (const path of [...paths].sort()) {
    const body = await readFile(resolve(base, path));
    combined.update(path).update('\0').update(body).update('\0');
    files.push({ path, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
  }
  return { sha256: combined.digest('hex'), files };
}

const sourcePaths = ['index.html', 'package.json', 'package-lock.json', ...await directoryFiles(resolve(root, 'src'), 'src/'), ...await directoryFiles(resolve(root, 'scripts'), 'scripts/')];
const sourceBefore = await fingerprint(root, sourcePaths);

const build = spawnSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);
const sourceAfter = await fingerprint(root, sourcePaths);
if (sourceAfter.sha256 !== sourceBefore.sha256) throw new Error('Source changed during build. Stable play was not published.');
const built = await fingerprint(resolve(root, 'dist'), await directoryFiles(resolve(root, 'dist')));

verifyOwnedPath(staging);
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(resolve(root, 'dist'), staging, { recursive: true });
const retainedAssets = [];
let priorBuild;
try { priorBuild = JSON.parse(await readFile(resolve(root, 'dist-play/build-info.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const file of priorBuild?.buildFiles || []) {
  if (!file.path.startsWith('assets/') || file.path.includes('..') || built.files.some(current => current.path === file.path)) continue;
  const body = await readFile(resolve(root, 'dist-play', file.path));
  if (createHash('sha256').update(body).digest('hex') !== file.sha256) throw new Error(`Previous production asset failed verification: ${file.path}`);
  await mkdir(dirname(resolve(staging, file.path)), { recursive: true });
  await writeFile(resolve(staging, file.path), body);
  retainedAssets.push(file);
}
await writeFile(resolve(staging, 'build-info.json'), JSON.stringify({
  publishedAt: new Date().toISOString(), sourceSha256: sourceAfter.sha256, buildSha256: built.sha256,
  sourceFiles: sourceAfter.files, buildFiles: built.files, retainedAssets,
}, null, 2));
verifyOwnedPath(destination);
await rm(destination, { recursive: true, force: true });
await rename(staging, destination);
console.log(candidate ? 'Candidate snapshot prepared in dist-candidate; production is unchanged.' : 'Stable play snapshot published to dist-play.');
console.log(`Source SHA256: ${sourceAfter.sha256}`);
console.log(`Build SHA256: ${built.sha256}`);
console.log(`Retained previous production assets: ${retainedAssets.length}`);
console.log('An already running play server keeps its existing snapshot. Restart it deliberately to load this version.');
