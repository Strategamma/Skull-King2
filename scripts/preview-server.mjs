import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  const requested = new URL(req.url, 'http://localhost').pathname;
  const filename = path.resolve(root, `.${decodeURIComponent(requested === '/' ? '/index.html' : requested)}`);
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Skull King visual preview: http://localhost:${port}`));
