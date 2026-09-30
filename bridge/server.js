const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const DEBUG = process.env.BRIDGE_DEBUG === '1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.obj': 'text/plain; charset=utf-8',
};

function sendError(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

function resolveStaticPath(requestUrl) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/dual-sr6.html';
  }

  const filePath = path.resolve(ROOT, `.${pathname}`);

  // Keep requests inside the project root.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendError(response, 405, 'Method Not Allowed');
    return;
  }

  const filePath = resolveStaticPath(request.url);

  if (!filePath) {
    sendError(response, 400, 'Bad Request');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      sendError(response, 404, 'Not Found');
      return;
    }

    const resolved = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;

    fs.readFile(resolved, (readError, content) => {
      if (readError) {
        sendError(response, 404, 'Not Found');
        return;
      }

      const type = MIME_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : content);
    });
  });
});

const wss = new WebSocketServer({ server });

function broadcast(sender, data, isBinary) {
  for (const client of wss.clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  }
}

wss.on('connection', (socket, request) => {
  const origin = request.socket.remoteAddress;
  console.log(`[bridge] client connected (${origin}), total: ${wss.clients.size}`);

  socket.on('message', (data, isBinary) => {
    if (DEBUG) {
      console.log(`[bridge] <- ${data.length} bytes from ${origin}`);
    }

    broadcast(socket, data, isBinary);
  });

  socket.on('close', () => {
    console.log(`[bridge] client disconnected (${origin}), total: ${wss.clients.size}`);
  });

  socket.on('error', (error) => {
    console.error(`[bridge] socket error (${origin}):`, error.message);
  });
});

server.listen(PORT, () => {
  console.log(`[bridge] serving ${ROOT} at http://localhost:${PORT}`);
  console.log(`[bridge] point MultiFunPlayer's WebSocket output at ws://localhost:${PORT}`);
});
