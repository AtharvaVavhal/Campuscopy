const API = 'https://campuscopy-api.onrender.com';
let currentJob = null;
let socket = null;
let scannerStream = null;

// ─── Screen Navigation ───────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ─── Toast ───────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Cost Calculator ─────────────────────────────────────────
function updateCost() {
  const pages = parseInt(document.getElementById('pages').value) || 0;
  const copies = parseInt(document.getElementById('copies').value) || 1;
  const color = document.getElementById('color').checked;
  const doubleSided = document.getElementById('double-sided').checked;
  const pricePerPage = color ? 5 : 1;
  const multiplier = doubleSided ? 0.8 : 1;
  const cost = (pages * copies * pricePerPage * multiplier).toFixed(2);
  document.getElementById('cost-display').textContent = '₹' + cost;
  const hasFile = document.getElementById('file-input').files.length > 0;
  const hasPrinter = document.getElementById('printer-select').value !== '';
  document.getElementById('upload-btn').disabled = !(hasFile && hasPrinter && pages > 0);
}

// ─── File Select ─────────────────────────────────────────────
function onFileSelect(input) {
  if (input.files.length > 0) {
    const area = document.getElementById('upload-area');
    area.classList.add('has-file');
    document.getElementById('file-name').textContent = input.files[0].name;
    document.querySelector('.upload-icon').textContent = '✅';
    updateCost();
  }
}

// ─── Load Printers ───────────────────────────────────────────
async function loadPrinters() {
  try {
    const res = await fetch(API + '/api/printers');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const sel = document.getElementById('printer-select');
    sel.innerHTML = '<option value="">Select a printer</option>';
    data.printers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + (p.location ? ' — ' + p.location : '');
      sel.appendChild(opt);
    });
    sel.onchange = updateCost;
  } catch {
    document.getElementById('printer-select').innerHTML = '<option value="e6ed4e43-678e-4bb4-b749-161df4250d94">Main Printer — Ground Floor</option>';
    updateCost();
  }
}

// ─── Upload File ─────────────────────────────────────────────
async function uploadFile() {
  const file = document.getElementById('file-input').files[0];
  const printer_id = document.getElementById('printer-select').value;
  const pages = document.getElementById('pages').value;
  const copies = document.getElementById('copies').value;
  const color = document.getElementById('color').checked;
  const double_sided = document.getElementById('double-sided').checked;

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span>Uploading...';

  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('printer_id', printer_id);
    fd.append('pages', pages);
    fd.append('copies', copies);
    fd.append('color', color);
    fd.append('double_sided', double_sided);

    const res = await fetch(API + '/api/jobs/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    currentJob = data.job;

    // Fill payment screen
    document.getElementById('pay-filename').textContent = currentJob.file_name;
    document.getElementById('pay-pages').textContent = currentJob.pages;
    document.getElementById('pay-copies').textContent = currentJob.copies;
    document.getElementById('pay-type').textContent = (currentJob.color ? 'Color' : 'B&W') + (currentJob.double_sided ? ' · 2-sided' : '');
    document.getElementById('pay-cost').textContent = '₹' + currentJob.cost;

    showScreen('payment');
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Upload & Continue';
  }
}

// ─── Payment ─────────────────────────────────────────────────
async function startPayment() {
  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span>Creating order...';

  try {
    const res = await fetch(API + '/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: currentJob.id }),
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order.error || 'Order failed');

    const options = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: 'CampusCopy',
      description: 'Print Job Payment',
      handler: function(response) {
        showToast('Payment successful!');
        showStatusScreen();
      },
      prefill: { name: 'Student' },
      theme: { color: '#6366f1' },
      modal: {
        ondismiss: function() {
          btn.disabled = false;
          btn.innerHTML = 'Pay Now';
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    showToast('Error: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = 'Pay Now';
  }
}

// ─── Status Screen ───────────────────────────────────────────
function showStatusScreen() {
  showScreen('status');
  connectSocket();
  pollStatus();
}

function updateStatusUI(status) {
  const icons = { pending: '⏳', paid: '💰', queued: '📋', printing: '🖨️', done: '✅', failed: '❌' };
  const texts = { pending: 'Awaiting Payment', paid: 'Payment Confirmed', queued: 'In Queue', printing: 'Printing Now...', done: 'Ready for Pickup', failed: 'Print Failed' };
  const subs = { pending: 'Complete payment to proceed', paid: 'Your job is queued shortly', queued: 'Waiting for printer', printing: 'Please wait...', done: 'Show QR code at counter', failed: 'Please try again' };

  document.getElementById('status-icon').textContent = icons[status] || '⏳';
  document.getElementById('status-text').textContent = texts[status] || status;
  document.getElementById('status-sub').textContent = subs[status] || '';
  document.getElementById('status-badge').textContent = status;
  document.getElementById('status-badge').className = 'status-badge badge-' + status;

  const steps = ['paid', 'queued', 'printing', 'done'];
  const idx = steps.indexOf(status);
  steps.forEach((s, i) => {
    const dot = document.getElementById('step-' + s);
    if (i < idx) { dot.className = 'step-dot done'; dot.textContent = '✓'; }
    else if (i === idx) { dot.className = 'step-dot active'; dot.textContent = i + 1; }
    else { dot.className = 'step-dot'; dot.textContent = i + 1; }
  });

  if (status === 'done' && currentJob && currentJob.qr_code) {
    document.getElementById('qr-image').src = currentJob.qr_code;
    document.getElementById('qr-box').style.display = 'block';
  }
}

async function pollStatus() {
  if (!currentJob) return;
  try {
    const res = await fetch(API + '/api/jobs/' + currentJob.id);
    const data = await res.json();
    if (data.job) updateStatusUI(data.job.status);
  } catch {}
}

function connectSocket() {
  if (socket) socket.disconnect();
  socket = io(API);
  socket.emit('join_job', currentJob.id);
  socket.on('job_status', (data) => {
    updateStatusUI(data.status);
    if (data.status === 'done') showToast('Your print is ready for pickup!');
  });
}

// ─── QR Scanner ──────────────────────────────────────────────
async function startScanner() {
  showScreen('scanner');
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('scanner-view').srcObject = scannerStream;
    requestAnimationFrame(scanFrame);
  } catch {
    showToast('Camera access denied');
  }
}

function scanFrame() {
  const video = document.getElementById('scanner-view');
  const canvas = document.getElementById('scanner-canvas');
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      stopScanner();
      verifyQR(code.data);
      return;
    }
  }
  if (scannerStream) requestAnimationFrame(scanFrame);
}

function stopScanner() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
}

async function verifyQR(token) {
  const result = document.getElementById('scan-result');
  result.style.display = 'block';
  result.innerHTML = '<p>Verifying...</p>';
  try {
    const res = await fetch(API + '/api/jobs/qr/' + token);
    const data = await res.json();
    if (data.job) {
      result.innerHTML = '<p style="font-weight:600;color:#059669;">✅ ' + data.job.file_name + '</p><p style="font-size:13px;color:#666;margin-top:4px;">Status: ' + data.job.status + ' · ₹' + data.job.cost + '</p>';
    } else {
      result.innerHTML = '<p style="color:#dc2626;">❌ Invalid QR code</p>';
    }
  } catch {
    result.innerHTML = '<p style="color:#dc2626;">❌ Could not verify</p>';
  }
}

// ─── Init ────────────────────────────────────────────────────
loadPrinters();
