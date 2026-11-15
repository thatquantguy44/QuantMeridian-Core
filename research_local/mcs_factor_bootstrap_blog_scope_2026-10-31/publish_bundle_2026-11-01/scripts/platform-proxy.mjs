import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Research capture only. Forward the real app and real API without fabricating
// output. The UI has no path-count selector, so rewrite that one request field.
const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:3011');
  const isMcs = url.pathname === '/api/simulations/mcs';
  if (isMcs) url.searchParams.set('paths', '10000');
  const upstream = http.request({
    hostname: '127.0.0.1', port: 3000,
    path: url.pathname + url.search, method: req.method,
    headers: { ...req.headers, host: 'localhost:3000' },
  }, (reply) => {
    res.writeHead(reply.statusCode ?? 502, reply.headers);
    if (isMcs) {
      const chunks = [];
      reply.on('data', (part) => chunks.push(part));
      reply.on('end', () => {
        const body = Buffer.concat(chunks);
        const capturePath = path.join(bundle, 'evidence', 'platform-captured-response.json');
        // Freeze the first anchor-off response. Vite development reloads can
        // later request default anchor-on data; those must not overwrite it.
        if (url.searchParams.get('fomcAnchor') === '0' && !fs.existsSync(capturePath)) {
          fs.writeFileSync(capturePath, body);
        }
        fs.appendFileSync(path.join(bundle, 'evidence', 'platform-requests.jsonl'), JSON.stringify({
          capturedAt: new Date().toISOString(), incoming: req.url,
          forwarded: url.pathname + url.search, status: reply.statusCode,
        }) + '\n');
      });
    }
    reply.pipe(res);
  });
  upstream.on('error', (err) => { res.writeHead(502); res.end('Local platform unavailable'); console.error(err.message); });
  req.pipe(upstream);
});
server.listen(3011, '127.0.0.1', () => console.log('Research proxy: http://127.0.0.1:3011; real MCS API requests use 10000 paths.'));
