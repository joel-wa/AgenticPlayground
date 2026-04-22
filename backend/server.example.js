const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/ai') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`Echo from example server: ${body}`);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(8080, () => {
  console.log('Example backend listening on http://localhost:8080');
});
