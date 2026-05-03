const express = require('express');
const https = require('https');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token, x-token');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'ED Proxy' }));

app.all('/ed/*', (req, res) => {
  // Reconstruit le chemin
  const afterEd = req.params[0];
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const path = '/v3/' + afterEd + (qs && !afterEd.includes('?') ? qs : '');

  // Construit le body au format EXACT attendu par Ecole Directe
  // Toujours : data=<JSON encodé>
  let dataObj = {};
  if (req.body) {
    if (req.body.data !== undefined) {
      dataObj = req.body.data;
    } else {
      dataObj = req.body;
    }
  }
  const dataStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
  const body = 'data=' + encodeURIComponent(dataStr);

  const options = {
    hostname: 'api.ecoledirecte.com',
    path: path,
    method: req.method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'ecoledirecte/3.17.2 CFNetwork/1492.0.1 Darwin/23.3.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Host': 'api.ecoledirecte.com',
      'Origin': 'https://www.ecoledirecte.com',
      'Referer': 'https://www.ecoledirecte.com/'
    }
  };

  // Token si présent
  const token = req.headers['x-token'] || req.headers['X-Token'];
  if (token) options.headers['X-Token'] = token;

  console.log('→', req.method, 'https://api.ecoledirecte.com' + path);
  console.log('  body:', body.substring(0, 200));

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    proxyRes.setEncoding('utf8');
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      console.log('←', proxyRes.statusCode, data.substring(0, 200));
      res.status(proxyRes.statusCode)
         .setHeader('Content-Type', 'application/json; charset=utf-8')
         .setHeader('Access-Control-Allow-Origin', '*')
         .send(data);
    });
  });

  proxyReq.on('error', e => {
    console.error('Proxy error:', e.message);
    res.status(500).json({ error: e.message });
  });

  proxyReq.write(body);
  proxyReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ ED Proxy sur port', PORT));
