import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const options = { port: 4173, directory: 'dist-play' };
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index], value = process.argv[index + 1];
  if (flag === '--port') options.port = Number(value);
  else if (flag === '--directory') options.directory = value;
  else throw new Error('Supported options: --port <number> --directory <dist-play|dist-candidate>.');
}
if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535 || !['dist-play', 'dist-candidate'].includes(options.directory)) throw new Error('Invalid local snapshot server options.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', options.directory);
const files = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function loadSnapshot(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name), key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await loadSnapshot(path, key);
    else if (entry.isFile()) files.set(key, { body: await readFile(path), type: types[extname(entry.name)] || 'application/octet-stream' });
  }
}

try {
  await loadSnapshot(root);
  if (!files.has('/index.html')) throw new Error('The snapshot is missing index.html.');
} catch (error) {
  console.error(`Cannot load stable play snapshot: ${error.message}`);
  console.error('Run npm run build:play first.');
  process.exit(1);
}

// Read once at startup: no file watcher, HMR client or disk reads during play.
// Publishing another build cannot change the bytes served by this process.
const buildInfo = JSON.parse(files.get('/build-info.json')?.body.toString() || '{}');
const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  let path;
  try { path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end('Invalid URL'); return; }
  const key = path === '/' ? '/index.html' : path;
  const file = files.get(key);
  if (!file) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); return; }
  response.writeHead(200, {
    'Content-Type': file.type, 'Content-Length': file.body.length,
    'Cache-Control': key === '/index.html' || key === '/build-info.json' ? 'no-store' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ...(buildInfo.sourceSha256 ? { 'X-Split-Grid-Source': buildInfo.sourceSha256, 'X-Split-Grid-Build': buildInfo.buildSha256 } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : file.body);
});

server.on('error', error => { console.error(`Stable play server: ${error.message}`); process.exitCode = 1; });
server.listen(options.port, '127.0.0.1', () => {
  const bytes = [...files.values()].reduce((sum, file) => sum + file.body.length, 0);
  console.log(`${options.directory === 'dist-candidate' ? 'Candidate QA' : 'Stable play'}: http://127.0.0.1:${options.port}/ (${files.size} files, ${(bytes / 1024).toFixed(0)} KiB snapshot)`);
  if (buildInfo.sourceSha256) console.log(`Source SHA256: ${buildInfo.sourceSha256}\nBuild SHA256: ${buildInfo.buildSha256}`);
  console.log('No HMR. Source edits and builds do not interrupt this play session.');
});
