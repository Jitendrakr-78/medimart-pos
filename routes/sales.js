const express = require('express');
const router = express.Router();
const pool = require('../config/db');

function generateInvoiceNo() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${ymd}-${rand}`;
}

// GET /api/sales - Recent invoices & daily summary
router.get('/', async (req, res) => {
  try {
    const [invoices] = await pool.query(
      `SELECT id, invoice_no, customer_name, customer_phone, subtotal, discount, total_amount, payment_mode, created_at
       FROM med_inv_sales
       ORDER BY id DESC
       LIMIT 30`
    );

    const [[todayStats]] = await pool.query(
      `SELECT
         COUNT(*) AS today_bills,
         COALESCE(SUM(total_amount), 0.00) AS today_revenue
       FROM med_inv_sales
       WHERE DATE(created_at) = CURDATE()`
    );

    res.json({
      success: true,
      summary: todayStats,
      data: invoices
    });
  } catch (err) {
    console.error('GET /api/sales error:', err);
    res.status(500).json({ success: false, message: 'Failed to load sales' });
  }
});

// POST /api/sales - Atomic checkout transaction
router.post('/', async (req, res) => {
  const {
    customer_name = 'Walk-in Customer',
    customer_phone = null,
    discount = 0,
    payment_mode = 'Cash',
    created_by = null,
    items
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Cart items array is required and cannot be empty'
    });
  }

  if (!['Cash', 'UPI', 'Card'].includes(payment_mode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment_mode'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let subtotal = 0;
    const preparedItems = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const qty = Number(item.quantity);

      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(qty) || qty <= 0) {
        throw { status: 400, message: 'Each item must have a valid positive product_id and quantity' };
      }

      // Lock the product row until transaction commits or rolls back
      const [rows] = await connection.query(
        `SELECT id, name, category, expiry_date, selling_price, stock_qty,
                (expiry_date IS NOT NULL AND expiry_date <= CURDATE()) AS is_expired
         FROM med_inv_products
         WHERE id = ?
         FOR UPDATE`,
        [productId]
      );

      if (rows.length === 0) {
        throw { status: 404, message: `Product ID ${productId} not found` };
      }

      const product = rows[0];

      if (product.is_expired) {
        throw {
          status: 400,
          message: `Cannot sell expired item: "${product.name}" (expired ${product.expiry_date})`
        };
      }

      if (product.stock_qty < qty) {
        throw {
          status: 400,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock_qty}, Requested: ${qty}`
        };
      }

      const unitPrice = Number(product.selling_price);
      const lineTotal = Number((unitPrice * qty).toFixed(2));
      subtotal = Number((subtotal + lineTotal).toFixed(2));

      preparedItems.push({
        product_id: product.id,
        name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        total_price: lineTotal
      });
    }

    const cleanDiscount = Math.max(0, Number(discount) || 0);
    if (cleanDiscount > subtotal) {
      throw { status: 400, message: 'Discount cannot exceed subtotal' };
    }

    const totalAmount = Number((subtotal - cleanDiscount).toFixed(2));
    const invoiceNo = generateInvoiceNo();

    // 1. Insert sale header
    const [saleResult] = await connection.execute(
      `INSERT INTO med_inv_sales
        (invoice_no, customer_name, customer_phone, subtotal, discount, total_amount, payment_mode, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo,
        customer_name.trim() || 'Walk-in Customer',
        customer_phone ? customer_phone.trim() : null,
        subtotal,
        cleanDiscount,
        totalAmount,
        payment_mode,
        created_by
      ]
    );

    const saleId = saleResult.insertId;

    // 2. Insert line items & deduct stock
    for (const line of preparedItems) {
      await connection.execute(
        `INSERT INTO med_inv_sale_items
          (sale_id, product_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, line.product_id, line.quantity, line.unit_price, line.total_price]
      );

      await connection.execute(
        `UPDATE med_inv_products
         SET stock_qty = stock_qty - ?
         WHERE id = ?`,
        [line.quantity, line.product_id]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      invoice: {
        id: saleId,
        invoice_no: invoiceNo,
        customer_name: customer_name.trim() || 'Walk-in Customer',
        customer_phone,
        subtotal,
        discount: cleanDiscount,
        total_amount: totalAmount,
        payment_mode,
        items: preparedItems
      }
    });
  } catch (err) {
    await connection.rollback();
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('POST /api/sales transaction error:', err);
    res.status(500).json({ success: false, message: 'Billing transaction failed' });
  } finally {
    connection.release();
  }
});

// GET /api/sales/:id - Single invoice with line items
router.get('/:id', async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (!Number.isInteger(saleId) || saleId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }

    const [[sale]] = await pool.query(
      `SELECT id, invoice_no, customer_name, customer_phone, subtotal, discount, total_amount, payment_mode, created_at
       FROM med_inv_sales
       WHERE id = ?`,
      [saleId]
    );

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const [items] = await pool.query(
      `SELECT si.product_id, p.name, si.quantity, si.unit_price, si.total_price
       FROM med_inv_sale_items si
       JOIN med_inv_products p ON p.id = si.product_id
       WHERE si.sale_id = ?
       ORDER BY si.id ASC`,
      [saleId]
    );

    res.json({
      success: true,
      invoice: { ...sale, items }
    });
  } catch (err) {
    console.error('GET /api/sales/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to load invoice details' });
  }
});

module.exports = router;
