// Static SPA server for dist/ with a stub /api/geo. Usage: node serve.mjs <distDir> <port>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const dir = process.argv[2];
const port = Number(process.argv[3] ?? 8130);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  if (path === '/api/geo') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ country: 'KR', region: '11' }));
    return;
  }
  let file = join(dir, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${dir} on ${port}`));
