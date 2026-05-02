const express = require('express');
const https = require('https');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — autorise ton app PWA
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Podcastr — Ecole Directe Proxy' });
});

// Proxy générique vers api.ecoledirecte.com
app.all('/ed/*', (req, res) => {
  const path = req.params[0];
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const fullPath = '/v3/' + path + query;

  let body = '';
  if (req.method === 'POST') {
    // Reconstruit le body
    if (req.body && typeof req.body === 'object') {
      const data = req.body.data || JSON.stringify(req.body);
      body = `data=${encodeURIComponent(typeof data === 'string' ? data : JSON.stringify(data))}`;
    }
  }

  const options = {
    hostname: 'api.ecoledirecte.com',
    path: fullPath,
    method: req.method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    }
  };

  // Passe le token si présent
  if (req.headers['x-token']) options.headers['X-Token'] = req.headers['x-token'];
  if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

  const proxyReq = https.request(options, (proxyRes) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.status(500).json({ error: e.message });
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy Ecole Directe démarré sur le port ${PORT}`);
});