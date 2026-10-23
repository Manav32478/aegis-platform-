// ============================================================================
// Aegis demo E-commerce store — the app you "protect" with Aegis.
//
// This is a deliberately tiny, self-contained store so you can deploy it to
// Render + Vercel + Cloud Run and then watch Aegis keep it alive.
//
// The ONLY thing Aegis needs from any app is this contract:
//   GET /health  →  {"status":"ok","cloud":"...","requests":N,"uptimeSeconds":N}
// Everything else here (the shop) is just a realistic app on top.
//
// Run:  CLOUD_NAME=local node server.js   →  http://localhost:3000
// ============================================================================

const express = require('express');

const app = express();
const CLOUD_NAME = process.env.CLOUD_NAME || 'local';
const START = Date.now();
let requests = 0;

app.use(express.json());
app.use((req, res, next) => {
  requests += 1;
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------------------
// Inventory + orders (in-memory for the demo; a real store uses a shared DB)
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { id: 1, name: 'Wireless Headphones', price: 2499, stock: 42 },
  { id: 2, name: 'Smart Watch', price: 3999, stock: 17 },
  { id: 3, name: 'Mechanical Keyboard', price: 3299, stock: 9 },
  { id: 4, name: 'USB-C Docking Station', price: 4999, stock: 23 },
];
const orders = [];

// ---- THE AEGIS CONTRACT (this is what the monitor probes every 5 min) ------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cloud: CLOUD_NAME,
    requests,
    uptimeSeconds: Math.round((Date.now() - START) / 1000),
    timestamp: Date.now(),
  });
});

// ---- the shop ---------------------------------------------------------------
app.get('/', (req, res) => {
  const items = PRODUCTS.map(
    (p) => `<li style="margin:8px 0"><strong>${p.name}</strong> — ₹${p.price} <em style="color:#888">(${p.stock} left)</em></li>`
  ).join('');
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Aegis Store — ${CLOUD_NAME}</title></head>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 20px;color:#1a1a2e">
  <p style="background:#4f8cff;color:#fff;display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px">
    served by <strong>${CLOUD_NAME}</strong> · request #${requests}
  </p>
  <h1>🛍️ Aegis Store</h1>
  <p>This exact page is running on 3 clouds. If this one dies, the next request
     is served by another cloud and you would never notice. Reload me!</p>
  <ul>${items}</ul>
  <p style="color:#888;font-size:12px">backed by Aegis self-healing multi-cloud · <a href="/health">/health</a> · <a href="/api/products">/api/products</a></p>
</body></html>`);
});

app.get('/api/products', (req, res) => res.json({ cloud: CLOUD_NAME, products: PRODUCTS }));

app.post('/api/order', (req, res) => {
  const { productId, qty } = req.body || {};
  const product = PRODUCTS.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: 'unknown product' });
  if (product.stock < (qty || 1)) return res.status(409).json({ error: 'out of stock' });
  product.stock -= qty || 1;
  const order = { id: orders.length + 1, productId: product.id, qty: qty || 1, placedOn: CLOUD_NAME, at: new Date().toISOString() };
  orders.push(order);
  res.json({ ok: true, order });
});

app.get('/api/orders', (req, res) => res.json({ cloud: CLOUD_NAME, orders }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[${CLOUD_NAME}] store on http://localhost:${PORT}`);
    console.log(`  /health      → what Aegis monitors`);
    console.log(`  /api/order   → POST {productId, qty} to buy`);
  });
}

module.exports = app;
