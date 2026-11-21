/* Servidor estático mínimo para ver o site localmente.
   node servir.js  ->  http://127.0.0.1:8200 */
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = __dirname;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.woff2': 'font/woff2', '.json': 'application/json',
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const alvo = path.join(RAIZ, p);
  if (!alvo.startsWith(RAIZ)) { res.writeHead(403); return res.end('fora da raiz'); }
  fs.stat(alvo, (e, s) => {
    if (e || !s.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('404 ' + p); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(alvo).pipe(res);
  });
}).listen(8200, '127.0.0.1', () => console.log('servindo em http://127.0.0.1:8200'));
