-- ==========================================
-- SEED DATA
-- ==========================================

-- Seed Users (replace password_hash with real bcrypt hashes in your auth setup)
INSERT INTO med_inv_users (name, email, password_hash, role) VALUES
('Store Admin', 'admin@medmart.demo', '$2b$10$demoAdminHashPlaceholder1234567890', 'admin'),
('Counter Cashier', 'cashier@medmart.demo', '$2b$10$demoCashierHashPlaceholder1234567890', 'cashier')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Products (Mix of General & Medicine, including expiring soon, expired, and low stock)
INSERT INTO med_inv_products
  (sku, name, category, batch_no, expiry_date, cost_price, selling_price, stock_qty, min_stock_alert)
VALUES
  -- Medicines
  ('MED-PARA-500', 'Paracetamol 500mg Strip (15 Tabs)', 'Medicine', 'BCH-P500-24A', DATE_ADD(CURDATE(), INTERVAL 180 DAY), 18.00, 30.00, 85, 20),
  ('MED-AZI-500', 'Azithromycin 500mg Strip (5 Tabs)', 'Medicine', 'BCH-AZ50-24C', DATE_ADD(CURDATE(), INTERVAL 18 DAY), 65.00, 95.00, 12, 15),
  ('MED-COUGH-100', 'Dry Cough Syrup 100ml', 'Medicine', 'BCH-CS10-23K', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 48.00, 78.00, 9, 10),
  ('MED-VITC-60', 'Vitamin C Chewable Tablets (60s)', 'Medicine', 'BCH-VC60-24M', DATE_ADD(CURDATE(), INTERVAL 25 DAY), 55.00, 85.00, 6, 12),
  ('MED-BAND-50', 'Sterile Adhesive Bandages (Pack of 50)', 'Medicine', 'BCH-BD50-25B', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 32.00, 50.00, 40, 15),
  ('MED-ORS-200', 'Electrolyte ORS Sachet 21.8g', 'Medicine', 'BCH-OR21-24J', DATE_ADD(CURDATE(), INTERVAL 240 DAY), 12.00, 20.00, 4, 15),

  -- General Store Items
  ('GEN-RICE-5KG', 'Basmati Rice 5kg Bag', 'General', NULL, NULL, 420.00, 495.00, 28, 8),
  ('GEN-OIL-1L', 'Sunflower Cooking Oil 1L Pouch', 'General', NULL, NULL, 118.00, 142.00, 35, 10),
  ('GEN-SUGAR-1KG', 'Refined White Sugar 1kg', 'General', NULL, NULL, 42.00, 52.00, 7, 10),
  ('GEN-SOAP-100', 'Herbal Bath Soap 100g', 'General', NULL, NULL, 24.00, 35.00, 60, 15),
  ('GEN-TEA-250', 'Assam CTC Tea Powder 250g', 'General', NULL, NULL, 95.00, 125.00, 22, 8),
  ('GEN-BISC-120', 'Glucose Biscuits Family Pack', 'General', NULL, NULL, 18.00, 25.00, 50, 12)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  stock_qty = VALUES(stock_qty);

-- Seed Sample Completed Invoices
INSERT INTO med_inv_sales
  (invoice_no, customer_name, customer_phone, subtotal, discount, total_amount, payment_mode, created_by)
VALUES
  ('INV-20261124-001', 'Ramesh Sharma', '9800000001', 590.00, 15.00, 575.00, 'UPI', 2),
  ('INV-20261124-002', 'Walk-in Customer', NULL, 145.00, 0.00, 145.00, 'Cash', 2);

-- Seed Line Items for Invoice 1 (assuming IDs 1 and 7)
INSERT INTO med_inv_sale_items (sale_id, product_id, quantity, unit_price, total_price)
SELECT s.id, p.id, 2, p.selling_price, (2 * p.selling_price)
FROM med_inv_sales s, med_inv_products p
WHERE s.invoice_no = 'INV-20261124-001' AND p.sku = 'MED-PARA-500';

INSERT INTO med_inv_sale_items (sale_id, product_id, quantity, unit_price, total_price)
SELECT s.id, p.id, 1, p.selling_price, (1 * p.selling_price)
FROM med_inv_sales s, med_inv_products p
WHERE s.invoice_no = 'INV-20261124-001' AND p.sku = 'GEN-RICE-5KG';

-- Seed Line Items for Invoice 2
INSERT INTO med_inv_sale_items (sale_id, product_id, quantity, unit_price, total_price)
SELECT s.id, p.id, 1, p.selling_price, (1 * p.selling_price)
FROM med_inv_sales s, med_inv_products p
WHERE s.invoice_no = 'INV-20261124-002' AND p.sku = 'GEN-OIL-1L';
