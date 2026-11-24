const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const productsRouter = require('./routes/products');
const salesRouter = require('./routes/sales');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
express.static('public');

const path = require('path');
// ...
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



// Health check + DB ping
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'OK', db: 'connected' });
  } catch (err) {
    res.status(500).json({ success: false, status: 'ERROR', db: 'disconnected' });
  }
});

app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);

app.listen(PORT, () => {
  console.log(`MedMart POS server running on http://localhost:${PORT}`);
});
