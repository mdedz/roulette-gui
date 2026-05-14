import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(cors());
  app.use(express.json());

  // In-memory store for last 100 spins
  let spins: number[] = [];
  const MAX_SPINS = 100;

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('Client connected');
    // Send initial state
    ws.send(JSON.stringify({ type: 'INIT', data: spins }));

    ws.on('close', () => console.log('Client disconnected'));
  });

  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.get('/api/tracking/health', async (_req, res) => {
    const trackingApiBaseUrl = (
      process.env.TRACKING_API_URL ||
      process.env.REACT_APP_API_URL ||
      'http://100.109.227.119:8765'
    ).replace(/\/$/, '');
    const targetUrl = `${trackingApiBaseUrl}/api/tracking/health`;

    console.log(`[tracking-health] GET ${targetUrl}`);

    try {
      const upstream = await fetch(targetUrl, { cache: 'no-store' });
      const contentType = upstream.headers.get('content-type') || '';
      const body = await upstream.text();

      res.status(upstream.status);

      if (contentType.includes('application/json')) {
        res.type('application/json').send(body);
      } else {
        res.type('text/plain').send(body);
      }
    } catch (error) {
      console.error('[tracking-health] proxy failed:', error);
      res.status(502).json({ status: 'CRITICAL', tracking_health_score: 0, error: 'Tracking health backend unreachable' });
    }
  });

  app.post('/api/spins', (req, res) => {
    const { number } = req.body;
    
    if (typeof number !== 'number' || number < 0 || number > 36) {
      return res.status(400).json({ error: 'Invalid number. Must be between 0 and 36.' });
    }

    spins.unshift(number);
    if (spins.length > MAX_SPINS) {
      spins = spins.slice(0, MAX_SPINS);
    }

    broadcast({ type: 'NEW_SPIN', data: number });
    res.status(201).json({ success: true, number });
  });

  app.get('/api/history', (req, res) => {
    res.json(spins);
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 4173);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
