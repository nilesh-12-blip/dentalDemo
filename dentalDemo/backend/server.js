// ============================================
//   PEARLSMILE DENTAL CLINIC — Backend Server
//   Node.js + Express + JSON file storage
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  appointments: path.join(DATA_DIR, 'appointments.json'),
  reviews: path.join(DATA_DIR, 'reviews.json'),
  newsletter: path.join(DATA_DIR, 'newsletter.json'),
};

// ===== DATA HELPERS =====
function readData(file) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return []; }
}

function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== REQUEST LOGGER =====
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ===== ROUTES =====

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// ===== APPOINTMENTS =====

// GET all appointments (admin)
app.get('/api/appointments', (req, res) => {
  const { status, date, search } = req.query;
  let apts = readData(FILES.appointments);

  if (status && status !== 'All') apts = apts.filter(a => a.status === status);
  if (date) apts = apts.filter(a => a.date === date);
  if (search) {
    const q = search.toLowerCase();
    apts = apts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q)
    );
  }

  apts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: apts, total: apts.length });
});

// GET single appointment
app.get('/api/appointments/:id', (req, res) => {
  const apts = readData(FILES.appointments);
  const apt = apts.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, message: 'Appointment not found' });
  res.json({ success: true, data: apt });
});

// POST create appointment
app.post('/api/appointments', (req, res) => {
  const { name, phone, email, age, service, doctor, date, time, message } = req.body;

  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ success: false, message: 'Required fields: name, phone, service, date, time' });
  }

  const apts = readData(FILES.appointments);
  const newApt = {
    id: generateId('APT'),
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || '',
    age: age || '',
    service: service.trim(),
    doctor: doctor || 'Any Available',
    date,
    time,
    message: message?.trim() || '',
    status: 'Pending',
    adminNotes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  apts.push(newApt);
  writeData(FILES.appointments, apts);
  console.log(`✅ New appointment: ${newApt.id} — ${newApt.name}`);
  res.status(201).json({ success: true, message: 'Appointment booked successfully', data: { id: newApt.id } });
});

// PATCH update appointment status
app.patch('/api/appointments/:id', (req, res) => {
  const { status, adminNotes } = req.body;
  const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const apts = readData(FILES.appointments);
  const apt = apts.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, message: 'Appointment not found' });

  if (status) apt.status = status;
  if (adminNotes !== undefined) apt.adminNotes = adminNotes;
  apt.updatedAt = new Date().toISOString();

  writeData(FILES.appointments, apts);
  res.json({ success: true, message: 'Appointment updated', data: apt });
});

// DELETE appointment
app.delete('/api/appointments/:id', (req, res) => {
  let apts = readData(FILES.appointments);
  const before = apts.length;
  apts = apts.filter(a => a.id !== req.params.id);
  if (apts.length === before) return res.status(404).json({ success: false, message: 'Not found' });
  writeData(FILES.appointments, apts);
  res.json({ success: true, message: 'Appointment deleted' });
});

// ===== REVIEWS =====

// GET all reviews
app.get('/api/reviews', (req, res) => {
  const reviews = readData(FILES.reviews);
  reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: reviews, total: reviews.length });
});

// POST create review
app.post('/api/reviews', (req, res) => {
  const { name, treatment, rating, text } = req.body;

  if (!name || !treatment || !rating || !text) {
    return res.status(400).json({ success: false, message: 'Required: name, treatment, rating, text' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
  }

  const reviews = readData(FILES.reviews);
  const newRev = {
    id: generateId('REV'),
    name: name.trim(),
    treatment: treatment.trim(),
    rating: Number(rating),
    text: text.trim(),
    initials: name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
    date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }),
    createdAt: new Date().toISOString(),
  };

  reviews.push(newRev);
  writeData(FILES.reviews, reviews);
  res.status(201).json({ success: true, message: 'Review submitted. Thank you!', data: { id: newRev.id } });
});

// ===== NEWSLETTER =====
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ success: false, message: 'Valid email required' });
  }

  const list = readData(FILES.newsletter);
  if (list.find(e => e.email === email)) {
    return res.json({ success: true, message: 'Already subscribed!' });
  }

  list.push({ email, subscribedAt: new Date().toISOString() });
  writeData(FILES.newsletter, list);
  res.json({ success: true, message: 'Subscribed successfully!' });
});

// ===== STATS (admin dashboard) =====
app.get('/api/stats', (req, res) => {
  const apts = readData(FILES.appointments);
  const revs = readData(FILES.reviews);
  const today = new Date().toISOString().split('T')[0];

  const serviceCounts = {};
  apts.forEach(a => { serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1; });

  res.json({
    success: true,
    data: {
      totalAppointments: apts.length,
      pending: apts.filter(a => a.status === 'Pending').length,
      confirmed: apts.filter(a => a.status === 'Confirmed').length,
      completed: apts.filter(a => a.status === 'Completed').length,
      cancelled: apts.filter(a => a.status === 'Cancelled').length,
      todayAppointments: apts.filter(a => a.date === today).length,
      totalReviews: revs.length,
      avgRating: revs.length ? (revs.reduce((s, r) => s + r.rating, 0) / revs.length).toFixed(1) : 0,
      serviceCounts,
    }
  });
});

// ===== ADMIN AUTH =====
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'dental2025') {
    res.json({ success: true, message: 'Login successful', token: 'ps-admin-token-' + Date.now() });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// ===== 404 FALLBACK =====
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('');
  console.log('🦷 ======================================');
  console.log('   PearlSmile Dental Clinic Server');
  console.log('🦷 ======================================');
  console.log(`🌐 Website:  http://localhost:${PORT}`);
  console.log(`🛡️  Admin:    http://localhost:${PORT}/admin`);
  console.log(`📡 API:      http://localhost:${PORT}/api`);
  console.log('');
  console.log('Admin credentials: admin / dental2025');
  console.log('======================================');
});

module.exports = app;
