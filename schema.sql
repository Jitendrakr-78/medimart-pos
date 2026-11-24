SQL
-- Create database if running locally (optional on hosted MySQL like Clever Cloud)
CREATE DATABASE IF NOT EXISTS med_inv_db;
USE med_inv_db;

-- 1. Users Table (Admin & Cashier roles)
CREATE TABLE IF NOT EXISTS med_inv_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table (General items + batch/expiry-tracked Medicines)
CREATE TABLE IF NOT EXISTS med_inv_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category ENUM('General', 'Medicine') NOT NULL DEFAULT 'General',
  batch_no VARCHAR(60) DEFAULT NULL,
  expiry_date DATE DEFAULT NULL,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock_qty INT NOT NULL DEFAULT 0,
  min_stock_alert INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_expiry (expiry_date),
  INDEX idx_stock (stock_qty)
);

-- 3. Sales Table (Invoice headers)
CREATE TABLE IF NOT EXISTS med_inv_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(40) NOT NULL UNIQUE,
  customer_name VARCHAR(120) DEFAULT 'Walk-in Customer',
  customer_phone VARCHAR(25) DEFAULT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_mode ENUM('Cash', 'UPI', 'Card') NOT NULL DEFAULT 'Cash',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_user FOREIGN KEY (created_by) REFERENCES med_inv_users(id) ON DELETE SET NULL
);

-- 4. Sale Items Table (Line items per invoice)
CREATE TABLE IF NOT EXISTS med_inv_sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES med_inv_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES med_inv_products(id) ON DELETE RESTRICT
);
