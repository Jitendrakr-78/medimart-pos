# MediMart POS — General & Medical Store Billing System

A full-stack Point-of-Sale (POS) and inventory management web app built with **Node.js**, **Express**, **MySQL**, and **Vanilla JavaScript** for general stores and pharmacies.

## Key Features
- **Unified POS Counter:** Search by item name, SKU, or batch number; filter by `General` or `Medicine`; apply discounts; select payment mode (`Cash`, `UPI`, `Card`); and generate printable receipts.
- **Expiry & Low-Stock Protection:** Flags items expiring within 30 days and low-stock items on the dashboard, while blocking expired medicines from checkout.
- **Transaction-Safe Billing:** Uses MySQL transactions with row locking (`FOR UPDATE`) so stock deduction and invoice creation stay atomic.
- **Inventory & Invoice History:** Add new items/batches, restock or update prices/expiry dates, and view or reprint recent invoices.

## Tech Stack
- **Backend:** Node.js, Express, `mysql2`
- **Database:** MySQL (`med_inv_` tables)
- **Frontend:** HTML, CSS, JavaScript

## Local Setup
1. Install dependencies:
   ```bash
   npm install

**Live Demo:** https://medimart-pos.onrender.com.onrender.com/