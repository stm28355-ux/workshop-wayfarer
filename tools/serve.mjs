// 手元で開くための小さな静的サーバー（依存なし）。node tools/serve.mjs [ポート=8080]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] ?? 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (path.startsWith('..')) { res.writeHead(403).end(); return; }
  const file = join(root, path || 'index.html');
  try {
    const body = await readFile(file.endsWith('\\') || file.endsWith('/') ? join(file, 'index.html') : file);
    res.writeHead(200, { 'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
