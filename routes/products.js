const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/products?category=General|Medicine&alert=expired|expiring|low_stock&search=...
router.get('/', async (req, res) => {
  try {
    const { category, alert, search } = req.query;

    let sql = `
      SELECT
        id, sku, name, category, batch_no, expiry_date,
        cost_price, selling_price, stock_qty, min_stock_alert,
        CASE
          WHEN expiry_date IS NOT NULL AND expiry_date <= CURDATE() THEN 1
          ELSE 0
        END AS is_expired,
        CASE
          WHEN expiry_date IS NOT NULL
            AND expiry_date > CURDATE()
            AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1
          ELSE 0
        END AS expiring_soon,
        CASE
          WHEN stock_qty <= min_stock_alert THEN 1
          ELSE 0
        END AS is_low_stock
      FROM med_inv_products
      WHERE 1=1
    `;

    const params = [];

    if (category && ['General', 'Medicine'].includes(category)) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim() !== '') {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR batch_no LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (alert === 'expired') {
      sql += ' AND expiry_date IS NOT NULL AND expiry_date <= CURDATE()';
    } else if (alert === 'expiring') {
      sql += ' AND expiry_date IS NOT NULL AND expiry_date > CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
    } else if (alert === 'low_stock') {
      sql += ' AND stock_qty <= min_stock_alert';
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ success: false, message: 'Failed to load products' });
  }
});

// POST /api/products - Add general item or medicine batch
router.post('/', async (req, res) => {
  try {
    const {
      sku,
      name,
      category = 'General',
      batch_no = null,
      expiry_date = null,
      cost_price,
      selling_price,
      stock_qty = 0,
      min_stock_alert = 10
    } = req.body;

    if (!sku || !name || cost_price == null || selling_price == null) {
      return res.status(400).json({
        success: false,
        message: 'sku, name, cost_price, and selling_price are required'
      });
    }

    if (!['General', 'Medicine'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'category must be General or Medicine'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO med_inv_products
        (sku, name, category, batch_no, expiry_date, cost_price, selling_price, stock_qty, min_stock_alert)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku.trim(),
        name.trim(),
        category,
        category === 'Medicine' ? batch_no : null,
        category === 'Medicine' ? expiry_date : null,
        Number(cost_price),
        Number(selling_price),
        Number(stock_qty),
        Number(min_stock_alert)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Product added',
      id: result.insertId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'SKU already exists' });
    }
    console.error('POST /api/products error:', err);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Restock or update product details
router.put('/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const [existingRows] = await pool.query(
      'SELECT * FROM med_inv_products WHERE id = ?',
      [productId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const current = existingRows[0];
    const {
      name = current.name,
      category = current.category,
      batch_no = current.batch_no,
      expiry_date = current.expiry_date,
      cost_price = current.cost_price,
      selling_price = current.selling_price,
      add_stock = 0,
      stock_qty,
      min_stock_alert = current.min_stock_alert
    } = req.body;

    if (!['General', 'Medicine'].includes(category)) {
      return res.status(400).json({ success: false, message: 'category must be General or Medicine' });
    }

    // If stock_qty is explicitly passed, use it; otherwise increment by add_stock
    const nextStock =
      stock_qty !== undefined && stock_qty !== null && stock_qty !== ''
        ? Number(stock_qty)
        : Number(current.stock_qty) + Number(add_stock || 0);

    if (Number.isNaN(nextStock) || nextStock < 0) {
      return res.status(400).json({ success: false, message: 'Stock quantity cannot be negative' });
    }

    await pool.execute(
      `UPDATE med_inv_products
       SET name = ?,
           category = ?,
           batch_no = ?,
           expiry_date = ?,
           cost_price = ?,
           selling_price = ?,
           stock_qty = ?,
           min_stock_alert = ?
       WHERE id = ?`,
      [
        String(name).trim(),
        category,
        category === 'Medicine' ? (batch_no || null) : null,
        category === 'Medicine' ? (expiry_date || null) : null,
        Number(cost_price),
        Number(selling_price),
        nextStock,
        Number(min_stock_alert),
        productId
      ]
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      stock_qty: nextStock
    });
  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});

module.exports = router;
