// ============================================================
//   KOTTAYAM MEDICITY — APPLICATION LOGIC  v2026.2
//   script.js  (Firebase Realtime Database — fixed)
// ============================================================

'use strict';

// ─── FIREBASE CONFIG ─────────────────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyBuRb_2-oh4GrKC_KgeJRVM0MsCOzk0lwM",
    authDomain:        "flexibooking-34aca.firebaseapp.com",
    databaseURL:       "https://flexibooking-34aca-default-rtdb.firebaseio.com",
    projectId:         "flexibooking-34aca",
    storageBucket:     "flexibooking-34aca.firebasestorage.app",
    messagingSenderId: "925474702922",
    appId:             "1:925474702922:web:65d15a26e7fd16118a08b3"
};

// ─── LIVE STATE ──────────────────────────────────────────────
let doctors      = [];
let patients     = [];
let bookings     = [];
let notices      = [];
let departments  = [];
let hospitalInfo = {};

const todayStr         = new Date().toISOString().split('T')[0];
let   currentViewMonth = new Date();

// ─── DATE TOKEN RESOLVER ─────────────────────────────────────
function resolveDate(token) {
    if (!token || typeof token !== 'string') return token;
    if (token === 'TODAY') return todayStr;
    const minus = token.match(/^MINUS_(\d+)$/);
    if (minus) {
        const d = new Date(); d.setDate(d.getDate() - parseInt(minus[1]));
        return d.toISOString().split('T')[0];
    }
    const plus = token.match(/^PLUS_(\d+)$/);
    if (plus) {
        const d = new Date(); d.setDate(d.getDate() + parseInt(plus[1]));
        return d.toISOString().split('T')[0];
    }
    return token;
}

function resolveDates(obj) {
    if (Array.isArray(obj)) return obj.map(resolveDates);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj))
            out[k] = (typeof v === 'string') ? resolveDate(v) : resolveDates(v);
        return out;
    }
    return obj;
}

// ─── AVATAR UTILITIES ────────────────────────────────────────
const PALETTE = [
    '#2563eb','#7c3aed','#0891b2','#059669','#d97706',
    '#dc2626','#9333ea','#0284c7','#16a34a','#c2410c'
];
function avatarColor(str = '') {
    let h = 0;
    for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name = '') {
    const p = name.trim().split(' ');
    return (p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '');
}
function setText(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
}

// ─── FIREBASE HELPERS ────────────────────────────────────────
// db reference — assigned after init
let db;

function fbRef(path) {
    return firebase.database().ref(path);
}

function fbSet(path, value) {
    return firebase.database().ref(path).set(value);
}

function fbUpdate(path, value) {
    return firebase.database().ref(path).update(value);
}

// Convert an array to a Firebase-friendly keyed object
function arrayToFbObject(arr) {
    const obj = {};
    arr.forEach(item => { if (item.id) obj[item.id] = item; });
    return obj;
}

// Persist the full bookings list back to Firebase
function syncBookings() {
    fbSet('bookings', arrayToFbObject(bookings)).catch(err =>
        console.error('Failed to sync bookings:', err));
}

function syncPatients() {
    fbSet('patients', arrayToFbObject(patients)).catch(err =>
        console.error('Failed to sync patients:', err));
}

function syncDoctors() {
    fbSet('doctors', arrayToFbObject(doctors)).catch(err =>
        console.error('Failed to sync doctors:', err));
}

// ─── BOOT ────────────────────────────────────────────────────
window.addEventListener('load', () => {
    // Guard: make sure Firebase SDK has loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded. Check your <script> tags in index.html.');
        showLoadError();
        return;
    }

    // Initialize Firebase (safe to call multiple times – firebase.app() reuses existing)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();

    // Show loading indicator
    showConnectionStatus('Connecting…');

    // Listen to the root — this fires immediately with cached data
    // then again whenever anything changes in the DB
    db.ref('/').on('value', (snapshot) => {
        const raw = snapshot.val();

        if (!raw) {
            console.warn('Firebase returned empty dataset. Initialising with defaults.');
            showConnectionStatus('No data – initialised with defaults', 'warn');
            initApp();
            return;
        }

        const data   = resolveDates(raw);
        hospitalInfo = data.hospital    || {};
        departments  = data.departments
            ? (Array.isArray(data.departments) ? data.departments : Object.values(data.departments))
            : [];
        doctors      = data.doctors
            ? (Array.isArray(data.doctors)  ? data.doctors  : Object.values(data.doctors))
            : [];
        patients     = data.patients
            ? (Array.isArray(data.patients) ? data.patients : Object.values(data.patients))
            : [];
        bookings     = data.bookings
            ? (Array.isArray(data.bookings) ? data.bookings : Object.values(data.bookings))
            : [];
        notices      = data.notices
            ? (Array.isArray(data.notices)  ? data.notices  : Object.values(data.notices))
            : [];

        console.log(
            '%c Firebase data loaded ✓',
            'background:#16a34a;color:#fff;padding:3px 10px;border-radius:4px;font-weight:700',
            `| ${doctors.length} doctors | ${patients.length} patients | ${bookings.length} bookings`
        );

        showConnectionStatus('Connected', 'ok');
        initApp();

    }, (error) => {
        console.error('Firebase read error:', error);
        showConnectionStatus('Connection error', 'err');
        showToast('Firebase connection error: ' + error.message, 'error');
    });
});

function showConnectionStatus(msg, state) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    const dot = state === 'ok'   ? '🟢' :
                state === 'warn' ? '🟡' :
                state === 'err'  ? '🔴' : '⚪';
    el.innerHTML = `<span class="status-dot"></span> ${dot} ${msg}`;
}

function showLoadError() {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;
        height:100vh;font-family:sans-serif;flex-direction:column;gap:16px;">
        <h2 style="color:#dc2626">⚠️ Firebase SDK not loaded</h2>
        <p>Check that the Firebase <code>&lt;script&gt;</code> tags in <strong>index.html</strong> are present and loading correctly.</p>
    </div>`;
}

// ─── INIT ────────────────────────────────────────────────────
function initApp() {
    document.title = `${hospitalInfo.name || 'Kottayam Medicity'} — Booking Desk 2026`;
    sortBookings();
    populateDoctorDropdown();
    updatePatientSuggestions();
    updateAllUI();
    renderDoctors();
    renderPatients();
    renderCalendar();
    renderNotices();
    startClock();
    updateCalSidebar();
    const fd = document.getElementById('filter-date');
    if (fd) fd.value = todayStr;
}

// ─── SORTING ─────────────────────────────────────────────────
function sortBookings() {
    const P = { Emergency:0, Urgent:1, Normal:2 };
    const R = s => ({ Pending:0, Called:1, Cancelled:2, Completed:3 })[s] ?? 4;
    bookings.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (R(a.status) !== R(b.status)) return R(a.status) - R(b.status);
        if (a.status === 'Pending' && P[a.priority] !== P[b.priority])
            return P[a.priority] - P[b.priority];
        return a.time.localeCompare(b.time);
    });
}

// ─── FULL UI UPDATE ──────────────────────────────────────────
function updateAllUI() {
    const todayBks  = bookings.filter(b => b.date === todayStr);
    const pending   = todayBks.filter(b => b.status === 'Pending');
    const completed = todayBks.filter(b => b.status === 'Completed');
    const emergency = todayBks.filter(b => b.priority === 'Emergency');
    const called    = todayBks.filter(b => b.status === 'Called');
    const onDuty    = doctors.filter(d => d.status === 'On Duty');

    setText('kpi-total',     todayBks.length);
    setText('kpi-pending',   pending.length);
    setText('kpi-completed', completed.length);
    setText('kpi-emergency', emergency.length);
    setText('kpi-called',    called.length);
    setText('nav-badge',     pending.length);
    setText('kpi-onduty',    onDuty.length + ' Doctor' + (onDuty.length !== 1 ? 's' : ''));

    const dc = {};
    todayBks.forEach(b => dc[b.dept] = (dc[b.dept] || 0) + 1);
    const top = Object.entries(dc).sort((a,b) => b[1]-a[1])[0];
    setText('kpi-top-dept', top ? `${top[0]} (${top[1]})` : '—');

    renderDashboardFeed(todayBks);
    renderAppointmentTable();
    updateTVDisplay();
    updateCalSidebar();
}

// ─── NOTICES BANNER ──────────────────────────────────────────
function renderNotices() {
    const todayN = notices.filter(n => n.date === todayStr);
    if (!todayN.length) return;
    document.getElementById('notice-bar')?.remove();
    const bar  = document.createElement('div');
    bar.id     = 'notice-bar';
    bar.style.cssText = `background:var(--primary-light);border:1px solid var(--primary);
        border-radius:var(--radius-sm);padding:10px 16px;margin-bottom:16px;font-size:.82rem;
        color:var(--primary);display:flex;gap:10px;flex-wrap:wrap;align-items:center;`;
    bar.innerHTML = `<strong><i class="fas fa-bell"></i> Notices:</strong> ` +
        todayN.map(n => `<span>${n.text}</span>`).join(' &nbsp;·&nbsp; ');
    document.getElementById('dashboard')?.prepend(bar);
}

// ─── DASHBOARD FEED ──────────────────────────────────────────
function renderDashboardFeed(todayBks) {
    const feed   = document.getElementById('dashboard-feed');
    const active = todayBks.filter(b => ['Pending','Called'].includes(b.status));
    if (!active.length) {
        feed.innerHTML = `<tr><td colspan="6"><div class="empty-state">
            <i class="fas fa-check-circle"></i><p>Queue is clear</p></div></td></tr>`;
        return;
    }
    feed.innerHTML = active.map(b => {
        const av = avatarColor(b.patient), ini = initials(b.patient);
        return `
        <tr>
            <td><span class="token-chip">#${b.token ?? '??'}</span></td>
            <td><div class="patient-cell">
                <div class="patient-avatar" style="background:${av}">${ini}</div>
                <div class="patient-cell-info">
                    <div class="pt-name">${b.patient}</div>
                    <div class="pt-phone">${b.phone || '—'}</div>
                </div></div></td>
            <td>${b.doctor}<br><small style="color:var(--primary);font-size:.72rem">${b.dept}</small></td>
            <td style="font-family:var(--font-mono);font-size:.82rem">${b.time}</td>
            <td><span class="badge badge-${b.status}">${b.status}</span></td>
            <td><div class="btn-set">
                ${b.status==='Pending'
                    ? `<button class="tbl-btn" onclick="callPatient('${b.id}')" title="Call">
                        <i class="fas fa-bullhorn"></i></button>` : ''}
                <button class="tbl-btn green" onclick="completeBooking('${b.id}')" title="Complete">
                    <i class="fas fa-check"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

// ─── APPOINTMENT TABLE ───────────────────────────────────────
function renderAppointmentTable(data) {
    const tbody = document.querySelector('#main-appt-table tbody');
    if (!data) data = getFilteredBookings();
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
            <i class="fas fa-calendar-times"></i><p>No appointments found</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = data.map(b => {
        const av = avatarColor(b.patient), ini = initials(b.patient);
        return `
        <tr>
            <td><span class="token-chip">${b.token ? '#'+b.token : '—'}</span></td>
            <td><div class="patient-cell">
                <div class="patient-avatar" style="background:${av}">${ini}</div>
                <div class="patient-cell-info">
                    <div class="pt-name">${b.patient}</div>
                    <div class="pt-phone">${b.phone || '—'}</div>
                </div></div></td>
            <td>${b.doctor}<br><small style="color:var(--primary);font-size:.72rem">${b.dept}</small></td>
            <td style="font-family:var(--font-mono);font-size:.8rem">${b.date}</td>
            <td style="font-family:var(--font-mono);font-size:.82rem">${b.time}</td>
            <td><span class="priority-badge priority-${b.priority}">${b.priority}</span></td>
            <td><span class="badge badge-${b.status}">${b.status}</span></td>
            <td><div class="btn-set">
                ${b.status==='Pending'
                    ? `<button class="tbl-btn" onclick="callPatient('${b.id}')" title="Call">
                        <i class="fas fa-bullhorn"></i></button>` : ''}
                ${!['Completed','Cancelled'].includes(b.status)
                    ? `<button class="tbl-btn green" onclick="completeBooking('${b.id}')" title="Complete">
                        <i class="fas fa-check"></i></button>` : ''}
                <button class="tbl-btn orange" onclick="openEditModal('${b.id}')" title="Edit">
                    <i class="fas fa-edit"></i></button>
                <button class="tbl-btn red" onclick="cancelBooking('${b.id}')" title="Cancel">
                    <i class="fas fa-times"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function getFilteredBookings() {
    const dept   = document.getElementById('filter-dept')?.value   || 'all';
    const status = document.getElementById('filter-status')?.value || 'all';
    const date   = document.getElementById('filter-date')?.value   || '';
    const search = (document.getElementById('search-bar')?.value   || '').toLowerCase();
    return bookings.filter(b => {
        if (dept   !== 'all' && b.dept   !== dept)   return false;
        if (status !== 'all' && b.status !== status) return false;
        if (date && b.date !== date)                 return false;
        if (search && !b.patient.toLowerCase().includes(search)
                   && !b.doctor.toLowerCase().includes(search)
                   && !(b.phone||'').includes(search))               return false;
        return true;
    });
}
window.filterAppts = () => renderAppointmentTable();

// ─── DOCTORS ─────────────────────────────────────────────────
let docFilter = 'all';

function renderDoctors(filter) {
    if (filter !== undefined) docFilter = filter;
    const list    = document.getElementById('doctor-list');
    const visible = docFilter === 'all' ? doctors : doctors.filter(d => d.status === docFilter);

    if (!visible.length) {
        list.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <i class="fas fa-user-slash"></i><p>No staff match this filter</p></div>`;
        return;
    }
    list.innerHTML = visible.map(d => {
        const av        = avatarColor(d.name), ini = initials(d.name);
        const sk        = d.status.replace(/ /g,'-');
        const todayCnt  = bookings.filter(b => b.doctorId === d.id && b.date === todayStr).length;
        const deptObj   = departments.find(dep => dep.id === d.deptId);
        const deptColor = deptObj?.color || '#2563eb';
        return `
        <div class="doc-card" id="dc-${d.id}">
            <div class="doc-avatar-wrap">
                <div class="doc-avatar" style="background:${av}">
                    ${ini}<span class="doc-status-pip pip-${sk}"></span>
                </div>
            </div>
            <div class="doc-name">${d.name}</div>
            <div class="doc-dept" style="color:${deptColor}">${d.dept}</div>
            <div class="doc-spec">${d.spec || ''}</div>
            <span class="doc-status-badge status-${sk}">${d.status}</span>
            <div class="doc-stats-row">
                <div class="doc-stat"><span class="doc-stat-val">${todayCnt}</span><span class="doc-stat-lbl">Today</span></div>
                <div class="doc-stat"><span class="doc-stat-val">${(d.patients||0).toLocaleString()}</span><span class="doc-stat-lbl">Total</span></div>
                <div class="doc-stat"><span class="doc-stat-val">${d.experience||0}y</span><span class="doc-stat-lbl">Exp</span></div>
            </div>
            ${d.opHours   ? `<div style="font-size:.72rem;color:var(--text-3);font-family:var(--font-mono)"><i class="far fa-clock"></i> ${d.opHours}</div>` : ''}
            ${d.consultFee? `<div style="font-size:.75rem;color:var(--success);font-weight:700">Consult ₹${d.consultFee}</div>` : ''}
            ${d.chamber   ? `<div style="font-size:.72rem;color:var(--text-3)"><i class="fas fa-door-open"></i> ${d.chamber}</div>` : ''}
            <div class="doc-actions">
                <button class="doc-action-btn" onclick="toggleDocStatus('${d.id}')"><i class="fas fa-sync-alt"></i> Status</button>
                <button class="doc-action-btn" onclick="showDoctorDetail('${d.id}')"><i class="fas fa-info-circle"></i> Details</button>
            </div>
        </div>`;
    }).join('');
}

window.filterDoctors = (filter, btn) => {
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderDoctors(filter);
};

window.toggleDocStatus = id => {
    const doc = doctors.find(d => d.id === id); if (!doc) return;
    const list = ['On Duty','Off Duty','In Surgery'];
    doc.status = list[(list.indexOf(doc.status)+1) % list.length];
    renderDoctors(); updateAllUI();
    showToast(`${doc.name} — ${doc.status}`, 'info');
    // Write updated status back to Firebase
    fbUpdate(`doctors/${id}`, { status: doc.status }).catch(console.error);
};

window.showDoctorDetail = id => {
    const d = doctors.find(doc => doc.id === id); if (!d) return;
    const upcoming = bookings.filter(b => b.doctorId === id && b.date >= todayStr && b.status === 'Pending').length;
    showToast(`${d.name} · ${d.qualification || d.dept} · ${d.chamber || 'N/A'} · ${upcoming} upcoming`, 'info');
};

window.addDoctor = () => {
    const name   = document.getElementById('nd-name').value.trim();
    const dept   = document.getElementById('nd-dept').value;
    const spec   = document.getElementById('nd-spec').value.trim();
    const phone  = document.getElementById('nd-phone').value.trim();
    const status = document.getElementById('nd-status').value;
    if (!name) return showToast('Name is required', 'error');
    const newDoc = {
        id:'D'+Date.now(), name, dept, spec, phone, status,
        deptId: departments.find(dep=>dep.name===dept)?.id || '',
        qualification:'', email:'', opDays:[], opHours:'',
        patients:0, experience:0, consultFee:0, chamber:'',
    };
    doctors.push(newDoc);
    // Write to Firebase
    fbSet(`doctors/${newDoc.id}`, newDoc).catch(console.error);
    populateDoctorDropdown(); renderDoctors();
    closeModal('add-doctor-modal');
    showToast(`${name} added to staff roster`, 'success');
    ['nd-name','nd-spec','nd-phone'].forEach(i => { const el=document.getElementById(i); if(el) el.value=''; });
};

// ─── PATIENTS ────────────────────────────────────────────────
function renderPatients(data) {
    const tbody = document.querySelector('#patient-table tbody');
    if (!data) data = patients;
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
            <i class="fas fa-users-slash"></i><p>No records found</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = data.map(p => {
        const av = avatarColor(p.name), ini = initials(p.name);
        const visits = bookings.filter(b => b.patientId === p.id || b.patient === p.name).length;
        return `
        <tr>
            <td><span style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-3)">${p.id}</span></td>
            <td><div class="patient-cell">
                <div class="patient-avatar" style="background:${av}">${ini}</div>
                <div class="patient-cell-info">
                    <div class="pt-name">${p.name}</div>
                    <div class="pt-phone">${p.age ? p.age+'y' : ''} ${p.gender||''}</div>
                </div></div></td>
            <td style="font-family:var(--font-mono);font-size:.8rem">${p.phone}</td>
            <td>${p.age||'—'} / ${p.gender||'—'}</td>
            <td><span style="font-family:var(--font-mono);font-size:.85rem;font-weight:700;color:var(--danger)">${p.blood||'—'}</span></td>
            <td style="font-family:var(--font-mono);font-size:.78rem">${p.lastVisit}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.history}">${p.history||'—'}</td>
            <td style="text-align:center;font-weight:700;font-family:var(--font-mono)">${visits}</td>
            <td><div class="btn-set">
                <button class="tbl-btn" onclick="showPatientDetail('${p.id}')" title="View"><i class="fas fa-eye"></i></button>
                <button class="tbl-btn green" onclick="bookForPatient('${p.id}')" title="Book"><i class="fas fa-calendar-plus"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

window.filterPatients = () => {
    const q = (document.getElementById('patient-search')?.value||'').toLowerCase();
    renderPatients(q ? patients.filter(p => p.name.toLowerCase().includes(q)||p.phone.includes(q)) : null);
};

window.showPatientDetail = id => {
    const p = patients.find(pt => pt.id === id); if (!p) return;
    const av = avatarColor(p.name), ini = initials(p.name);
    const visits = bookings.filter(b=>b.patientId===id||b.patient===p.name).sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('patient-modal-body').innerHTML = `
    <div class="patient-detail-grid">
        <div class="patient-detail-header">
            <div class="patient-big-avatar" style="background:${av}">${ini}</div>
            <div>
                <div class="patient-big-name">${p.name}</div>
                <div class="patient-big-sub">${p.age?p.age+' years':''} · ${p.gender||''} · Blood: <strong style="color:var(--danger)">${p.blood||'N/A'}</strong>${p.allergies&&p.allergies!=='None'?` · <span style="color:var(--warning)"><i class="fas fa-exclamation-triangle"></i> ${p.allergies}</span>`:''}</div>
                <div style="margin-top:6px;display:flex;gap:8px">
                    <span class="badge badge-Called">${visits.filter(v=>v.status==='Completed').length} Completed</span>
                    <span class="badge badge-Pending">${visits.filter(v=>v.status==='Pending').length} Upcoming</span>
                </div>
            </div>
        </div>
        <div>
            <div class="detail-section-title">Contact</div>
            <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${p.phone}</span></div>
            <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${p.email||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${p.address||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Emergency</span><span class="detail-value">${p.emergencyContact||'—'}</span></div>
        </div>
        <div>
            <div class="detail-section-title">Medical</div>
            <div class="detail-row"><span class="detail-label">Blood Group</span><span class="detail-value" style="color:var(--danger);font-weight:800">${p.blood||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">DOB</span><span class="detail-value" style="font-family:var(--font-mono)">${p.dob||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Insurance</span><span class="detail-value">${p.insurance||'None'}</span></div>
            <div class="detail-row"><span class="detail-label">Allergies</span><span class="detail-value" style="color:${p.allergies&&p.allergies!=='None'?'var(--warning)':'inherit'}">${p.allergies||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">History</span><span class="detail-value" style="text-align:right;max-width:200px">${p.history||'—'}</span></div>
        </div>
        <div class="visit-history">
            <div class="detail-section-title">Visit History (${visits.length} total)</div>
            ${visits.length ? visits.slice(0,12).map(v=>`
            <div class="visit-item">
                <span class="visit-date">${v.date}</span>
                <div class="visit-info">
                    <div class="visit-doc">${v.doctor} <span style="color:var(--primary);font-size:.72rem">(${v.dept})</span></div>
                    <div class="visit-complaint">${v.complaint||'—'}
                    ${v.notes?`<div style="font-size:.7rem;color:var(--text-3);margin-top:2px">📋 ${v.notes}</div>`:''}
                    </div>
                </div>
                <span class="badge badge-${v.status}" style="flex-shrink:0">${v.status}</span>
            </div>`).join('')
            : '<p style="color:var(--text-3);font-size:.85rem;padding:10px 0">No visit history</p>'}
        </div>
    </div>`;
    openModal('patient-modal');
};

window.bookForPatient = id => {
    const p = patients.find(pt=>pt.id===id); if (!p) return;
    document.getElementById('nb-name').value  = p.name;
    document.getElementById('nb-phone').value = p.phone;
    if (document.getElementById('nb-age'))    document.getElementById('nb-age').value    = p.age||'';
    if (document.getElementById('nb-gender')) document.getElementById('nb-gender').value = p.gender||'Male';
    openModal('booking-modal');
};

// ─── CALENDAR ────────────────────────────────────────────────
function renderCalendar() {
    const grid = document.getElementById('calendar-grid'); if (!grid) return;
    grid.innerHTML = '';
    const year  = currentViewMonth.getFullYear();
    const month = currentViewMonth.getMonth();
    setText('cal-title', currentViewMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'}));
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    for (let i=0; i<firstDay; i++) {
        const e=document.createElement('div'); e.className='cal-cell empty'; grid.appendChild(e);
    }
    for (let i=1; i<=daysInMonth; i++) {
        const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const bks = bookings.filter(b=>b.date===ds);
        const cell= document.createElement('div');
        cell.className = `cal-cell${ds===todayStr?' today':''}${bks.length?' has-bookings':''}`;
        const num=document.createElement('div'); num.className='cal-num'; num.textContent=i;
        cell.appendChild(num);
        if (bks.length) {
            const row=document.createElement('div'); row.className='cal-dot-row';
            bks.filter(b=>b.priority==='Emergency').slice(0,3).forEach(()=>{
                const d=document.createElement('span'); d.className='cal-dot emergency'; row.appendChild(d);});
            bks.filter(b=>b.status==='Pending').slice(0,3).forEach(()=>{
                const d=document.createElement('span'); d.className='cal-dot'; row.appendChild(d);});
            bks.filter(b=>b.status==='Completed').slice(0,2).forEach(()=>{
                const d=document.createElement('span'); d.className='cal-dot completed'; row.appendChild(d);});
            cell.appendChild(row);
            const cnt=document.createElement('div'); cnt.className='cal-count';
            cnt.textContent=bks.length+' appt'+(bks.length>1?'s':''); cell.appendChild(cnt);
        }
        cell.addEventListener('click', ()=>showDayDetail(ds, bks));
        grid.appendChild(cell);
    }
}

function showDayDetail(ds, bks) {
    const panel=document.getElementById('day-detail-panel');
    const title=document.getElementById('day-detail-title');
    const body =document.getElementById('day-detail-body');
    const d = new Date(ds+'T00:00:00');
    title.textContent=`Appointments on ${d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`;
    if (!bks.length) {
        body.innerHTML=`<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No appointments on this date</p></div>`;
    } else {
        body.innerHTML=`<table class="data-table"><thead><tr>
            <th>Token</th><th>Patient</th><th>Doctor</th><th>Time</th><th>Priority</th><th>Status</th><th>Complaint</th>
        </tr></thead><tbody>${bks.map(b=>{
            const av=avatarColor(b.patient),ini=initials(b.patient);
            return `<tr>
                <td><span class="token-chip">${b.token?'#'+b.token:'—'}</span></td>
                <td><div class="patient-cell">
                    <div class="patient-avatar" style="background:${av};width:28px;height:28px;font-size:.6rem">${ini}</div>
                    <div class="patient-cell-info"><div class="pt-name">${b.patient}</div></div>
                </div></td>
                <td>${b.doctor}</td>
                <td style="font-family:var(--font-mono);font-size:.82rem">${b.time}</td>
                <td><span class="priority-badge priority-${b.priority}">${b.priority}</span></td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                <td style="font-size:.78rem;color:var(--text-2)">${b.complaint||'—'}</td>
            </tr>`;}).join('')}
        </tbody></table>`;
    }
    panel.style.display='block';
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function updateCalSidebar() {
    const todayBks = bookings.filter(b=>b.date===todayStr);
    const monthBks = bookings.filter(b=>{
        const d=new Date(b.date);
        return d.getFullYear()===currentViewMonth.getFullYear()&&d.getMonth()===currentViewMonth.getMonth();
    });
    setText('cal-day-total',   todayBks.length);
    setText('cal-month-total', monthBks.length);
    setText('cal-today-date',  new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}));
    const upcoming=bookings.filter(b=>b.date>=todayStr&&['Pending','Called'].includes(b.status))
        .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).slice(0,8);
    const upBody=document.getElementById('upcoming-list-body');
    if (!upBody) return;
    upBody.innerHTML=upcoming.length ? upcoming.map(b=>`
    <div class="upcoming-item">
        <span class="upcoming-time">${b.time}</span>
        <div class="upcoming-info">
            <div class="up-name">${b.patient}</div>
            <div class="up-doc">${b.doctor} · ${b.date===todayStr?'<span style="color:var(--accent);font-weight:700">Today</span>':b.date}</div>
        </div>
    </div>`).join('')
    : `<div class="empty-state" style="padding:20px 0"><i class="fas fa-check-circle"></i><p>All clear</p></div>`;
}

window.changeCalMonth = delta => {
    currentViewMonth.setMonth(currentViewMonth.getMonth()+delta);
    renderCalendar(); updateCalSidebar();
};

// ─── TV MODE ─────────────────────────────────────────────────
function updateTVDisplay() {
    const called  = bookings.find(b=>b.status==='Called'&&b.date===todayStr);
    const waiting = bookings.filter(b=>b.status==='Pending'&&b.date===todayStr);
    if (called) {
        setText('tv-token',  `#${called.token}`);
        setText('tv-patient', called.patient);
        setText('tv-doctor',  `→ ${called.doctor} (${called.dept})`);
        const tt=document.getElementById('tv-token'); if(tt) tt.style.color='#3b82f6';
    } else {
        setText('tv-token',   '—');
        setText('tv-patient', 'Please Wait');
        setText('tv-doctor',  'No patient currently called');
        const tt=document.getElementById('tv-token'); if(tt) tt.style.color='#334155';
    }
    const tvList=document.getElementById('tv-next-list');
    if (tvList) tvList.innerHTML=waiting.slice(0,6).map(b=>
        `<div class="tv-queue-item">#${b.token??'??'} — ${b.patient}</div>`).join('');
}
window.toggleTVMode = () => document.getElementById('tv-overlay').classList.toggle('active');

// ─── BOOKING CRUD ────────────────────────────────────────────
window.createBooking = () => {
    const name      = document.getElementById('nb-name').value.trim();
    const phone     = document.getElementById('nb-phone').value.trim();
    const docVal    = document.getElementById('nb-doc').value;
    const date      = document.getElementById('nb-date').value;
    const time      = document.getElementById('nb-time').value || '09:00';
    const prio      = document.getElementById('nb-prio').value;
    const complaint = document.getElementById('nb-complaint').value.trim();
    const age       = parseInt(document.getElementById('nb-age')?.value)||0;
    const gender    = document.getElementById('nb-gender')?.value||'Male';

    if (!name)   return showToast('Patient name is required','error');
    if (!phone)  return showToast('Phone number is required','error');
    if (!docVal) return showToast('Please select a doctor','error');
    if (!date)   return showToast('Please select a date','error');

    const [docName, dept, doctorId] = docVal.split('|');
    const dateToks = bookings.filter(b=>b.date===date&&b.token).map(b=>b.token);
    const token = prio==='Emergency' ? Math.floor(Math.random()*9)+1
        : (dateToks.length ? Math.max(...dateToks)+1 : 101);

    const newBk = {
        id:'B'+Date.now(), token, patientId:'', patient:name, phone,
        doctorId, doctor:docName, dept, date, time, priority:prio,
        status:'Pending', complaint, notes:'', age, gender
    };

    bookings.push(newBk);

    // Handle patient record
    const existing = patients.find(p=>p.phone===phone);
    if (existing) {
        existing.lastVisit = date;
        newBk.patientId    = existing.id;
        // Persist updated patient
        fbUpdate(`patients/${existing.id}`, { lastVisit: date }).catch(console.error);
    } else {
        const pid='P'+String(patients.length+1).padStart(4,'0');
        const newPat = {
            id:pid, name, phone, age, gender, blood:'—', dob:'',
            address:'', email:'', emergencyContact:'', lastVisit:date,
            history:complaint||'New Patient', allergies:'None', insurance:'None'
        };
        patients.push(newPat);
        newBk.patientId = pid;
        // Persist new patient
        fbSet(`patients/${pid}`, newPat).catch(console.error);
    }

    // Persist new booking
    fbSet(`bookings/${newBk.id}`, newBk).catch(console.error);

    sortBookings(); updateAllUI(); renderPatients(); renderCalendar(); updatePatientSuggestions();
    closeModal('booking-modal'); clearBookingForm();
    showToast(`Booking confirmed! Token #${token} — ${name}`,'success');
};

window.callPatient = id => {
    const bk=bookings.find(b=>b.id===id); if (!bk) return;
    if (!bk.token) bk.token=Math.floor(Math.random()*900)+100;
    // Un-call any currently called patient
    bookings.forEach(b=>{
        if(b.status==='Called'&&b.id!==id) {
            b.status='Pending';
            fbUpdate(`bookings/${b.id}`, { status:'Pending' }).catch(console.error);
        }
    });
    bk.status='Called';
    fbUpdate(`bookings/${id}`, { status:'Called', token: bk.token }).catch(console.error);
    sortBookings(); updateAllUI();
    showToast(`Calling: ${bk.patient} — Token #${bk.token}`,'info');
};

window.completeBooking = id => {
    const bk=bookings.find(b=>b.id===id); if (!bk) return;
    bk.status='Completed';
    fbUpdate(`bookings/${id}`, { status:'Completed' }).catch(console.error);
    sortBookings(); updateAllUI(); renderCalendar();
    showToast(`${bk.patient} marked as completed`,'success');
};

window.cancelBooking = id => {
    const bk=bookings.find(b=>b.id===id); if (!bk) return;
    if (!confirm(`Cancel appointment for ${bk.patient}?`)) return;
    bk.status='Cancelled';
    fbUpdate(`bookings/${id}`, { status:'Cancelled' }).catch(console.error);
    sortBookings(); updateAllUI(); renderCalendar();
    showToast(`Appointment cancelled — ${bk.patient}`,'error');
};

window.openEditModal = id => {
    const bk=bookings.find(b=>b.id===id); if (!bk) return;
    const docOpts=doctors.map(d=>
        `<option value="${d.name}|${d.dept}|${d.id}" ${d.name===bk.doctor?'selected':''}>${d.name} (${d.dept})</option>`).join('');
    document.getElementById('edit-modal-body').innerHTML=`
    <div class="form-grid-2">
        <div class="form-group"><label>Patient Name</label><input type="text" id="eb-name" value="${bk.patient}"></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="eb-phone" value="${bk.phone||''}"></div>
    </div>
    <div class="form-group"><label>Doctor</label><select id="eb-doc">${docOpts}</select></div>
    <div class="form-grid-2">
        <div class="form-group"><label>Date</label><input type="date" id="eb-date" value="${bk.date}"></div>
        <div class="form-group"><label>Time</label><input type="time" id="eb-time" value="${bk.time}"></div>
    </div>
    <div class="form-grid-2">
        <div class="form-group"><label>Priority</label><select id="eb-prio">
            ${['Normal','Urgent','Emergency'].map(p=>`<option ${p===bk.priority?'selected':''}>${p}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Status</label><select id="eb-status">
            ${['Pending','Called','Completed','Cancelled'].map(s=>`<option ${s===bk.status?'selected':''}>${s}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label>Complaint</label><input type="text" id="eb-complaint" value="${bk.complaint||''}"></div>
    <div class="form-group"><label>Clinical Notes</label><input type="text" id="eb-notes" value="${bk.notes||''}"></div>
    <button class="submit-btn" onclick="saveEdit('${id}')"><i class="fas fa-save"></i> Save Changes</button>`;
    openModal('edit-modal');
};

window.saveEdit = id => {
    const bk=bookings.find(b=>b.id===id); if (!bk) return;
    const [docName,dept,doctorId]=(document.getElementById('eb-doc').value||'').split('|');
    bk.patient  =document.getElementById('eb-name').value.trim()    ||bk.patient;
    bk.phone    =document.getElementById('eb-phone').value.trim();
    bk.doctor   =docName  ||bk.doctor;
    bk.dept     =dept     ||bk.dept;
    bk.doctorId =doctorId ||bk.doctorId;
    bk.date     =document.getElementById('eb-date').value            ||bk.date;
    bk.time     =document.getElementById('eb-time').value            ||bk.time;
    bk.priority =document.getElementById('eb-prio').value;
    bk.status   =document.getElementById('eb-status').value;
    bk.complaint=document.getElementById('eb-complaint').value.trim();
    bk.notes    =document.getElementById('eb-notes').value.trim();
    // Persist the full updated booking record
    fbSet(`bookings/${id}`, bk).catch(console.error);
    sortBookings(); updateAllUI(); renderCalendar();
    closeModal('edit-modal');
    showToast(`Appointment updated — ${bk.patient}`,'success');
};

// ─── QUICK ACTIONS ───────────────────────────────────────────
window.printDayList = () => {
    const list=bookings.filter(b=>b.date===todayStr);
    const win=window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>OPD List — ${todayStr}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f1f5f9;padding:10px;text-align:left;font-size:12px}
    td{padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px}.em{color:red;font-weight:700}
    @media print{button{display:none}}</style></head><body>
    <h2>Kottayam Medicity — OPD Booking List</h2>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
    <p><strong>Total:</strong> ${list.length} &nbsp;|&nbsp; <strong>Pending:</strong> ${list.filter(b=>b.status==='Pending').length} &nbsp;|&nbsp; <strong>Completed:</strong> ${list.filter(b=>b.status==='Completed').length}</p>
    <table><thead><tr><th>Token</th><th>Patient</th><th>Phone</th><th>Doctor</th><th>Dept</th><th>Time</th><th>Priority</th><th>Status</th></tr></thead>
    <tbody>${list.map(b=>`<tr class="${b.priority==='Emergency'?'em':''}">
    <td>#${b.token||'—'}</td><td>${b.patient}</td><td>${b.phone||'—'}</td>
    <td>${b.doctor}</td><td>${b.dept}</td><td>${b.time}</td><td>${b.priority}</td><td>${b.status}</td>
    </tr>`).join('')}</tbody></table>
    <script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
    showToast('Print dialog opening...','info');
};

window.announceNext = () => {
    const next=bookings.find(b=>b.status==='Pending'&&b.date===todayStr);
    if (!next) return showToast('No patients in queue','info');
    callPatient(next.id);
};

window.emergencyAlert = () => {
    showToast('⚠️ CODE BLUE ACTIVATED — Emergency response initiated!','error');
    const flash=document.createElement('div');
    flash.style.cssText=`position:fixed;inset:0;background:rgba(239,68,68,.25);z-index:9997;pointer-events:none;animation:cb 1s 4 ease-in-out`;
    const style=document.createElement('style');
    style.textContent=`@keyframes cb{0%,100%{opacity:0}50%{opacity:1}}`;
    document.head.appendChild(style); document.body.appendChild(flash);
    setTimeout(()=>{ flash.remove(); style.remove(); },4200);
};

window.exportCSV = () => {
    const headers=['Token','Patient','Phone','Doctor','Department','Date','Time','Priority','Status','Complaint','Notes'];
    const rows=bookings.map(b=>[b.token||'',b.patient,b.phone||'',b.doctor,b.dept,
        b.date,b.time,b.priority,b.status,b.complaint||'',b.notes||'']
        .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv=[headers.join(','),...rows].join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=Object.assign(document.createElement('a'),{href:url,download:`KottayamMedicity_Bookings_${todayStr}.csv`});
    a.click(); URL.revokeObjectURL(url);
    showToast(`Exported ${bookings.length} records to CSV`,'success');
};

// ─── NAVIGATION ──────────────────────────────────────────────
window.navTo = (id, btn) => {
    document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    if (btn) {
        document.querySelectorAll('.nav-btn').forEach(n=>n.classList.remove('active'));
        (btn.closest?.('.nav-btn')||btn)?.classList.add('active');
    }
    const titles={dashboard:'Dashboard',appointments:'OPD Bookings',
        doctors:'Medical Staff',patients:'Patient Records',calendar:'Calendar View'};
    setText('page-title', titles[id]||id);
    if (id==='appointments') filterAppts();
    if (id==='doctors')      renderDoctors();
    if (id==='patients')     renderPatients();
    if (id==='calendar')     { renderCalendar(); updateCalSidebar(); }
    if (window.innerWidth<900) document.getElementById('sidebar').classList.remove('open');
};

// ─── MODALS ──────────────────────────────────────────────────
window.openModal = id => {
    const m=document.getElementById(id); if (!m) return;
    m.classList.add('open');
    if (id==='booking-modal') {
        const nd=document.getElementById('nb-date'), nt=document.getElementById('nb-time');
        if (nd&&!nd.value) nd.value=todayStr;
        if (nt&&!nt.value) nt.value=new Date().toTimeString().substring(0,5);
    }
};
window.closeModal  = id => document.getElementById(id)?.classList.remove('open');
window.closeOnBackdrop = (e,id) => { if(e.target.id===id) closeModal(id); };

function clearBookingForm() {
    ['nb-name','nb-phone','nb-complaint','nb-age'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value='';});
    const p=document.getElementById('nb-prio'); if(p) p.value='Normal';
}

// ─── HELPERS ─────────────────────────────────────────────────
function populateDoctorDropdown() {
    const sel=document.getElementById('nb-doc'); if (!sel) return;
    sel.innerHTML=`<option value="">— Select Doctor —</option>`+
        doctors.map(d=>`<option value="${d.name}|${d.dept}|${d.id}">${d.name} (${d.dept})</option>`).join('');
}
function updatePatientSuggestions() {
    const dl=document.getElementById('patient-suggestions'); if (!dl) return;
    dl.innerHTML=patients.map(p=>`<option value="${p.name}">`).join('');
}
window.toggleTheme = () => {
    const html=document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme')==='dark'?'light':'dark');
    showToast('Theme switched','info');
};
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');

// ─── TOAST ───────────────────────────────────────────────────
function showToast(msg, type='info') {
    const c=document.getElementById('toast-container');
    const t=document.createElement('div'); t.className='toast';
    const colors={success:'#22c55e',error:'#ef4444',info:'#2563eb'};
    const icons ={success:'fa-check-circle',error:'fa-exclamation-circle',info:'fa-info-circle'};
    t.style.borderLeftColor=colors[type]||'#2563eb';
    t.innerHTML=`<i class="fas ${icons[type]||'fa-info-circle'}" style="color:${colors[type]};margin-right:6px"></i>${msg}`;
    c.appendChild(t);
    setTimeout(()=>{ t.classList.add('toast-fade'); setTimeout(()=>t.remove(),320); },3200);
}
window.showToast=showToast;

// ─── CLOCK ───────────────────────────────────────────────────
function startClock() {
    function tick() {
        setText('current-date', new Date().toLocaleString('en-IN',
            {weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}));
        setText('tv-clock', new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}));
    }
    tick(); setInterval(tick,1000);
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key==='Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(m=>m.classList.remove('open'));
        document.getElementById('tv-overlay')?.classList.remove('active');
    }
    if ((e.ctrlKey||e.metaKey)&&e.key==='n') { e.preventDefault(); openModal('booking-modal'); }
});