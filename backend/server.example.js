const http = require('http');
const MAX_REQUEST_SIZE_BYTES = 1024 * 1024;

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/ai') {
    let totalBytes = 0;
    let rejected = false;
    let body = '';
    req.on('data', (chunk) => {
      if (rejected) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_REQUEST_SIZE_BYTES) {
        rejected = true;
        res.writeHead(413, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        });
        res.end('Request body too large');
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (rejected) return;
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(`Echo from example server: ${body}`);
    });
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('Not found');
});

server.listen(8080, () => {
  console.log('Example backend listening on http://localhost:8080');
});
