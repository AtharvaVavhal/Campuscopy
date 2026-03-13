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
  const priority = document.getElementById('priority') && document.getElementById('priority').checked;
  const pricePerPage = color ? 5 : 1;
  const multiplier = doubleSided ? 0.8 : 1;
  const baseCost = pages * copies * pricePerPage * multiplier;
  const priorityFee = priority ? 5 : 0;
  const cost = (baseCost + priorityFee).toFixed(2);
  document.getElementById('cost-display').textContent = '₹' + cost + (priorityFee ? ' (incl. ₹5 priority fee)' : '');
  const hasFile = document.getElementById('file-input').files.length > 0;
  const hasPrinter = document.getElementById('printer-select').value !== '';
  document.getElementById('upload-btn').disabled = !(hasFile && hasPrinter && pages > 0);
}

// ─── File Select ─────────────────────────────────────────────
async function onFileSelect(input) {
  if (input.files.length > 0) {
    const file = input.files[0];
    const area = document.getElementById('upload-area');
    area.classList.add('has-file');
    document.getElementById('file-name').textContent = file.name;
    document.querySelector('.upload-icon').textContent = '⏳';
    document.getElementById('upload-btn').disabled = true;

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;

      document.getElementById('pages').value = pageCount;
      document.querySelector('.upload-icon').textContent = '✅';

      const pagesInput = document.getElementById('pages');
      pagesInput.style.background = '#f0fdf4';
      pagesInput.style.borderColor = '#10b981';

      showToast('Detected ' + pageCount + ' pages automatically!');
    } catch (err) {
      console.error('PDF read error:', err);
      document.querySelector('.upload-icon').textContent = '✅';
      showToast('Could not auto-detect pages. Please enter manually.');
    }

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
    document.getElementById('printer-select').innerHTML = '<option value="">Could not load printers — please refresh</option>';
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

// ─── Push Notifications ───────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush(jobId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[push] Not supported in this browser');
      return;
    }

    // Get VAPID public key from server
    const keyRes = await fetch(API + '/api/push/vapid-public-key');
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();

    // Register service worker if not already registered
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[push] Permission denied');
      return;
    }

    // Subscribe
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send subscription to backend linked to this job
    await fetch(API + '/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, subscription }),
    });

    console.log('[push] Subscribed successfully for job', jobId);
  } catch (err) {
    console.error('[push] Subscription failed:', err);
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
      handler: async function(response) {
        showToast('Payment successful!');
        // Subscribe to push notifications after successful payment
        await subscribeToPush(currentJob.id);
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
  const subs  = { pending: 'Complete payment to proceed', paid: 'Your job is queued shortly', queued: 'Waiting for printer', printing: 'Please wait...', done: 'Show QR code at counter', failed: 'Please try again' };

  document.getElementById('status-icon').textContent = icons[status] || '⏳';
  document.getElementById('status-text').textContent = texts[status] || status;
  document.getElementById('status-sub').textContent  = subs[status]  || '';
  document.getElementById('status-badge').textContent  = status;
  document.getElementById('status-badge').className    = 'status-badge badge-' + status;

  const steps = ['paid', 'queued', 'printing', 'done'];
  const idx = steps.indexOf(status);
  steps.forEach((s, i) => {
    const dot = document.getElementById('step-' + s);
    if (i < idx)      { dot.className = 'step-dot done';   dot.textContent = '✓'; }
    else if (i === idx){ dot.className = 'step-dot active'; dot.textContent = i + 1; }
    else               { dot.className = 'step-dot';        dot.textContent = i + 1; }
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
  socket.on('job_update', (data) => {
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
    const code = (typeof jsQR === 'function') ? jsQR(imageData.data, imageData.width, imageData.height) : null;
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  try {
    const res = await fetch(API + '/api/jobs/qr/' + token);
    const data = await res.json();
    if (data.job) {
      result.innerHTML = '<p style="font-weight:600;color:#059669;">✅ ' + escapeHtml(data.job.file_name) + '</p><p style="font-size:13px;color:#666;margin-top:4px;">Status: ' + escapeHtml(data.job.status) + ' · ₹' + escapeHtml(data.job.cost) + '</p>';
    } else {
      result.innerHTML = '<p style="color:#dc2626;">❌ Invalid QR code</p>';
    }
  } catch {
    result.innerHTML = '<p style="color:#dc2626;">❌ Could not verify</p>';
  }
}

// ─── Init ────────────────────────────────────────────────────
loadPrinters();