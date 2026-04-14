require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
app.get('/api/products', async (req, res) => {
  try {
    let query = supabase.from('products').select('*');
    if (req.query.category) query = query.eq('category', req.query.category);
    if (req.query.badge) query = query.eq('badge', req.query.badge);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(404).json({ error: 'Product not found' }); }
});
app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/create-order', async (req, res) => {
  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const { amount, email } = req.body;
    const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: 'order_' + Date.now() });
    await supabase.from('orders').insert({ id: order.id, email: email || 'guest', total: amount, status: 'pending' });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const crypto = require('crypto');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(sign).digest('hex');
    if (razorpay_signature === expectedSign) {
      await supabase.from('orders').update({ status: 'paid' }).eq('id', razorpay_order_id);
      res.json({ success: true });
    } else { res.status(400).json({ success: false }); }
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// ADD PRODUCT
app.post('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert([req.body]);

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => console.log('VOLTA API running at http://localhost:' + PORT));
