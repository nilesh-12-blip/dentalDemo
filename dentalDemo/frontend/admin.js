// ============================================
//   PEARLSMILE — ADMIN PANEL admin.js
// ============================================

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'dental2025';
let currentFilter = 'All';
let currentApptId = null;

// ===== AUTH =====
function adminLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUser').value;
  const pass = document.getElementById('loginPass').value;
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    localStorage.setItem('ps_admin_auth', '1');
    showDashboard();
  } else {
    showAdminToast('❌ Invalid credentials', 'error');
  }
}

function adminLogout() {
  localStorage.removeItem('ps_admin_auth');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function checkAuth() {
  if (localStorage.getItem('ps_admin_auth') === '1') showDashboard();
}

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  const now = new Date();
  document.getElementById('pageDate').textContent = now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  loadOverview();
}

// ===== DATA =====
function getAppointments() {
  return JSON.parse(localStorage.getItem('ps_appointments') || '[]');
}
function getReviews() {
  return JSON.parse(localStorage.getItem('ps_reviews') || '[]');
}
function saveAppointments(list) {
  localStorage.setItem('ps_appointments', JSON.stringify(list));
}

// ===== TABS =====
function showTab(name, el) {
  document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
  document.querySelectorAll('.s-link').forEach(l => l.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  tab.classList.remove('hidden');
  tab.classList.add('active');
  el.classList.add('active');

  const titles = { overview:'Overview', appointments:'Appointments', patients:'Patients', reviews:'Reviews' };
  document.getElementById('pageTitle').textContent = titles[name] || name;

  if (name === 'overview') loadOverview();
  if (name === 'appointments') renderAppointments();
  if (name === 'patients') renderPatients();
  if (name === 'reviews') renderAdminReviews();

  return false;
}

// ===== OVERVIEW =====
function loadOverview() {
  const apts = getAppointments();
  const revs = getReviews();
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('kpiTotal').textContent = apts.length;
  document.getElementById('kpiPending').textContent = apts.filter(a => a.status === 'Pending').length;
  document.getElementById('kpiDone').textContent = apts.filter(a => a.status === 'Completed').length;
  document.getElementById('kpiReviews').textContent = revs.length;

  // Today's appointments
  const todayApts = apts.filter(a => a.date === today);
  document.getElementById('todayBadge').textContent = todayApts.length;
  const list = document.getElementById('todayList');
  if (todayApts.length === 0) {
    list.innerHTML = '<div class="empty-state"><span>📭</span>No appointments today</div>';
  } else {
    list.innerHTML = todayApts.slice(0,5).map(a => `
      <div class="apt-mini">
        <div>
          <div class="apt-mini-name">${a.name}</div>
          <div class="apt-mini-time">${a.time} · ${a.doctor}</div>
        </div>
        <span class="apt-mini-service">${a.service}</span>
      </div>
    `).join('');
  }

  // Services chart
  const serviceCounts = {};
  apts.forEach(a => { serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1; });
  const sorted = Object.entries(serviceCounts).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxCount = sorted[0]?.[1] || 1;
  const chart = document.getElementById('servicesChart');
  if (sorted.length === 0) {
    chart.innerHTML = '<div class="empty-state"><span>📊</span>No data yet</div>';
  } else {
    chart.innerHTML = sorted.map(([name, count]) => `
      <div class="bar-row">
        <span class="bar-label">${name}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round(count/maxCount*100)}%"></div>
        </div>
        <span class="bar-count">${count}</span>
      </div>
    `).join('');
  }
}

// ===== APPOINTMENTS =====
function filterAppts(filter, el) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderAppointments();
}

function renderAppointments() {
  let apts = getAppointments();
  const search = (document.getElementById('searchAppt')?.value || '').toLowerCase();

  if (currentFilter !== 'All') apts = apts.filter(a => a.status === currentFilter);
  if (search) apts = apts.filter(a =>
    a.name.toLowerCase().includes(search) ||
    a.phone.toLowerCase().includes(search) ||
    (a.email || '').toLowerCase().includes(search)
  );

  apts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const wrap = document.getElementById('apptTable');
  if (apts.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><span>📭</span>No appointments found</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Patient</th><th>Phone</th><th>Service</th>
          <th>Date</th><th>Time</th><th>Doctor</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${apts.map(a => `
          <tr>
            <td><code style="font-size:0.75rem;color:#666">${a.id}</code></td>
            <td><strong>${a.name}</strong>${a.age ? `<br/><small style="color:#999">${a.age} yrs</small>` : ''}</td>
            <td>${a.phone}</td>
            <td>${a.service}</td>
            <td>${formatDate(a.date)}</td>
            <td>${a.time}</td>
            <td>${a.doctor}</td>
            <td><span class="status status-${a.status}">${a.status}</span></td>
            <td>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <button class="act-btn act-view" onclick="viewAppt('${a.id}')">View</button>
                ${a.status === 'Pending' ? `<button class="act-btn act-confirm" onclick="updateStatus('${a.id}','Confirmed')">Confirm</button>` : ''}
                ${a.status !== 'Completed' && a.status !== 'Cancelled' ? `<button class="act-btn act-complete" onclick="updateStatus('${a.id}','Completed')">Done</button>` : ''}
                ${a.status !== 'Cancelled' && a.status !== 'Completed' ? `<button class="act-btn act-cancel" onclick="updateStatus('${a.id}','Cancelled')">Cancel</button>` : ''}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function updateStatus(id, status) {
  const list = getAppointments();
  const appt = list.find(a => a.id === id);
  if (appt) {
    appt.status = status;
    appt.updatedAt = new Date().toISOString();
    saveAppointments(list);
    renderAppointments();
    loadOverview();
    showAdminToast(`✅ Status updated to ${status}`);
  }
}

function viewAppt(id) {
  currentApptId = id;
  const list = getAppointments();
  const a = list.find(x => x.id === id);
  if (!a) return;

  document.getElementById('modalTitle').textContent = `Appointment — ${a.name}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><label>Full Name</label><span>${a.name}</span></div>
      <div class="detail-item"><label>Phone</label><span>${a.phone}</span></div>
      <div class="detail-item"><label>Email</label><span>${a.email || 'Not provided'}</span></div>
      <div class="detail-item"><label>Age</label><span>${a.age || 'Not provided'}</span></div>
      <div class="detail-item"><label>Service</label><span>${a.service}</span></div>
      <div class="detail-item"><label>Doctor</label><span>${a.doctor}</span></div>
      <div class="detail-item"><label>Date</label><span>${formatDate(a.date)}</span></div>
      <div class="detail-item"><label>Time</label><span>${a.time}</span></div>
      <div class="detail-item"><label>Status</label><span class="status status-${a.status}">${a.status}</span></div>
      <div class="detail-item"><label>Booked On</label><span>${new Date(a.createdAt).toLocaleString('en-IN')}</span></div>
    </div>
    ${a.message ? `<div class="detail-item" style="margin-bottom:16px"><label>Patient Notes</label><span>${a.message}</span></div>` : ''}
    <div>
      <label style="font-size:0.82rem;font-weight:600;color:#3D5166;display:block;margin-bottom:6px">Admin Notes</label>
      <textarea class="notes-area" id="adminNotes" placeholder="Add internal notes...">${a.adminNotes || ''}</textarea>
    </div>
    <div class="status-actions" style="margin-top:12px">
      <button class="status-action-btn act-btn act-confirm" onclick="saveNotes('${id}','Confirmed')">✓ Confirm</button>
      <button class="status-action-btn act-btn act-complete" onclick="saveNotes('${id}','Completed')">✅ Mark Complete</button>
      <button class="status-action-btn act-btn act-cancel" onclick="saveNotes('${id}','Cancelled')">✕ Cancel</button>
      <button class="status-action-btn act-btn act-view" onclick="saveNotes('${id}','${a.status}')">💾 Save Notes</button>
    </div>
  `;
  document.getElementById('apptModal').classList.add('active');
}

function saveNotes(id, status) {
  const notes = document.getElementById('adminNotes')?.value || '';
  const list = getAppointments();
  const appt = list.find(a => a.id === id);
  if (appt) {
    appt.status = status;
    appt.adminNotes = notes;
    appt.updatedAt = new Date().toISOString();
    saveAppointments(list);
    renderAppointments();
    loadOverview();
    closeApptModal();
    showAdminToast('💾 Appointment updated');
  }
}

function closeApptModal() {
  document.getElementById('apptModal').classList.remove('active');
}

// ===== PATIENTS =====
function renderPatients() {
  const apts = getAppointments();
  const patientMap = {};
  apts.forEach(a => {
    const key = a.phone;
    if (!patientMap[key]) {
      patientMap[key] = { name: a.name, phone: a.phone, email: a.email, age: a.age, visits: 0, lastVisit: '', services: new Set() };
    }
    patientMap[key].visits++;
    if (!patientMap[key].lastVisit || a.date > patientMap[key].lastVisit) patientMap[key].lastVisit = a.date;
    patientMap[key].services.add(a.service);
  });

  const patients = Object.values(patientMap).sort((a,b) => b.visits - a.visits);
  const wrap = document.getElementById('patientsTable');

  if (patients.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><span>👥</span>No patients yet. Appointments will appear here.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>#</th><th>Patient Name</th><th>Phone</th><th>Email</th><th>Age</th><th>Total Visits</th><th>Last Visit</th><th>Services</th></tr>
      </thead>
      <tbody>
        ${patients.map((p, i) => `
          <tr>
            <td>${i+1}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.phone}</td>
            <td>${p.email || '—'}</td>
            <td>${p.age || '—'}</td>
            <td><span class="badge">${p.visits}</span></td>
            <td>${formatDate(p.lastVisit)}</td>
            <td style="font-size:0.78rem;color:#666">${[...p.services].join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ===== REVIEWS =====
function renderAdminReviews() {
  const revs = getReviews();
  const grid = document.getElementById('reviewsAdmin');
  if (revs.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span>⭐</span>No reviews yet</div>';
    return;
  }
  grid.innerHTML = revs.map(r => `
    <div class="rev-admin-card">
      <div class="rev-admin-header">
        <span class="rev-admin-name">${r.name}</span>
        <span class="rev-admin-date">${r.date || 'Recently'}</span>
      </div>
      <div class="rev-admin-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
      <p class="rev-admin-text">${r.text}</p>
      <span class="rev-admin-treat">🦷 ${r.treatment}</span>
    </div>
  `).join('');
}

// ===== TOAST =====
function showAdminToast(msg, type = 'success') {
  const t = document.getElementById('adminToast');
  t.textContent = msg;
  t.style.background = type === 'error' ? '#E53E3E' : '#0B7B6B';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ===== MODAL CLOSE ON OVERLAY =====
document.getElementById('apptModal').addEventListener('click', function(e) {
  if (e.target === this) closeApptModal();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', checkAuth);
