const express = require('express');
const https = require('https');
const app = express();

app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token, x-token');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Podcastr — Ecole Directe Proxy' });
});

// Proxy vers api.ecoledirecte.com
app.all('/ed/*', (req, res) => {
  // Reconstruit le chemin : /ed/login.awp?v=4 → /v3/login.awp?v=4
  const afterEd = req.url.replace(/^\/ed\//, '');
  const fullPath = '/v3/' + afterEd;

  // Construit le body au format attendu par Ecole Directe
  // L'API attend : data=<JSON encodé en URL>
  let bodyToSend = '';
  if (req.method === 'POST') {
    if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
      // Body JSON envoyé par l'app → on le réemballe
      const dataObj = req.body.data !== undefined ? req.body.data : req.body;
      const dataStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
      bodyToSend = 'data=' + encodeURIComponent(dataStr);
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      bodyToSend = req.body;
    } else {
      // Body vide → Ecole Directe attend quand même data={}
      bodyToSend = 'data=' + encodeURIComponent('{}');
    }
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'ecoledirecte/3.17 (iPhone)',
    'Host': 'api.ecoledirecte.com',
  };

  if (req.headers['x-token']) headers['X-Token'] = req.headers['x-token'];
  if (bodyToSend) headers['Content-Length'] = Buffer.byteLength(bodyToSend);

  const options = {
    hostname: 'api.ecoledirecte.com',
    path: fullPath,
    method: req.method,
    headers
  };

  console.log(`→ ${req.method} https://api.ecoledirecte.com${fullPath}`);
  console.log(`  body: ${bodyToSend.substring(0, 120)}`);

  const proxyReq = https.request(options, (proxyRes) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = proxyRes.statusCode;

    let data = '';
    proxyRes.setEncoding('utf8');
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      console.log(`← ${proxyRes.statusCode} (${data.length} chars)`);
      res.end(data);
    });
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.status(500).json({ error: e.message });
  });

  if (bodyToSend) proxyReq.write(bodyToSend);
  proxyReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy Ecole Directe démarré sur le port ${PORT}`);
});
