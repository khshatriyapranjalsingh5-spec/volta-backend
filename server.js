require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ================= SUPABASE =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ================= RAZORPAY =================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================= ROOT =================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'VOLTA API running 🚀' });
});

// ================= PRODUCTS =================

// GET ALL PRODUCTS
app.get('/api/products', async (req, res) => {
  try {
    let query = supabase.from('products').select('*');

    if (req.query.category)
      query = query.eq('category', req.query.category);

    if (req.query.badge)
      query = query.eq('badge', req.query.badge);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET SINGLE PRODUCT
app.get('/api/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.json({ success: false, error: 'Product not found' });
  }
});

// ADD PRODUCT ✅
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, image } = req.body;

    const { data, error } = await supabase
      .from('products')
      .insert([{
        name,
        price: Number(price),
        category,
        image,
        old_price: null,
        badge: "new",
        emoji: "🛍️",
        sub: "New Product",
        stock: 10
      }]);

    if (error) throw error;

    res.json({ success: true, data });

  } catch (err) {
    console.log("ERROR:", err.message);
    res.json({ success: false, error: err.message });
  }
});

// UPDATE PRODUCT
app.put('/api/products/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update(req.body)
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// DELETE PRODUCT
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ================= ORDERS =================

// GET ORDERS
app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*');

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// CREATE ORDER (RAZORPAY)
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, email } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: 'order_' + Date.now(),
    });

    await supabase.from('orders').insert({
      id: order.id,
      email: email || 'guest',
      total: amount,
      status: 'pending',
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// VERIFY PAYMENT
app.post('/api/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', razorpay_order_id);

      res.json({ success: true, message: "Payment verified" });
    } else {
      res.json({ success: false, message: "Verification failed" });
    }

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log("🚀 VOLTA API running on port " + PORT);
});