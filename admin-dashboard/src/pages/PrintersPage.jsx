import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

function PrinterCard({ printer, onEdit, onDelete, onRegenerateKey, loading }) {
  const online      = printer.is_online;
  const [copied, setCopied] = useState(false);

  function copyKey() {
    if (printer.api_key) {
      navigator.clipboard.writeText(printer.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 20, padding: '24px', position: 'relative', overflow: 'hidden',
      transition: 'all 0.3s',
    }}>
      {online && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#34d399,transparent)' }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: online ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>🖨️</div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: online ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 20, padding: '5px 12px',
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
          color: online ? '#34d399' : 'rgba(238,238,245,0.35)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: online ? '#34d399' : 'rgba(238,238,245,0.3)',
            animation: online ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
          }} />
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 0.5, marginBottom: 2 }}>
        {printer.name}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', marginBottom: 16 }}>
        📍 {printer.location || 'No location set'}
      </div>

      {/* Last heartbeat */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Last Heartbeat</div>
        <div style={{ fontSize: 12, color: online ? '#34d399' : 'rgba(238,238,245,0.4)', fontWeight: 600 }}>
          {printer.last_heartbeat ? new Date(printer.last_heartbeat).toLocaleString('en-IN') : 'Never'}
        </div>
      </div>

      {/* API key hint */}
      {printer.api_key_hint && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>API Key</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(238,238,245,0.5)' }}>
            {printer.api_key_hint}
          </div>
        </div>
      )}

      {/* Full api_key shown after create/regenerate */}
      {printer.api_key && !printer.api_key_hint && (
        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>API Key — copy now!</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(238,238,245,0.7)', wordBreak: 'break-all', marginBottom: 6 }}>
            {printer.api_key}
          </div>
          <button onClick={copyKey} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => onEdit(printer)}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(238,238,245,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onRegenerateKey(printer.id)}
          disabled={loading}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🔑 New Key
        </button>
        <button
          onClick={() => onDelete(printer.id, printer.name)}
          disabled={loading}
          style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0f0f1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: 400, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(238,238,245,0.4)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#eeeef5', fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', boxSizing: 'border-box' };
const labelStyle = { fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, display: 'block' };

export default function PrintersPage() {
  const qc = useQueryClient();
  const [showAdd,  setShowAdd]  = useState(false);
  const [editPrinter, setEditPrinter] = useState(null);
  const [form, setForm] = useState({ name: '', location: '' });
  const [msg,  setMsg]  = useState(null);
  const [newKeyResult, setNewKeyResult] = useState(null); // stores { id, name, api_key } after regenerate

  // ── Fetch admin list (masked api_key) ────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['printers-admin'],
    queryFn: () => api.get('/api/printers/admin/list').then(r => r.data),
    refetchInterval: 15000,
  });

  const printers    = data?.printers || [];
  const onlineCount = printers.filter(p => p.is_online).length;

  // ── Create ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body) => api.post('/api/printers/admin/create', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['printers-admin'] });
      setShowAdd(false);
      setForm({ name: '', location: '' });
      // Show the api_key immediately — user must copy it
      setNewKeyResult(res.data.printer);
    },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || 'Failed to create printer' }),
  });

  // ── Edit ─────────────────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/api/printers/admin/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printers-admin'] });
      setEditPrinter(null);
      setForm({ name: '', location: '' });
    },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || 'Failed to update' }),
  });

  // ── Delete ───────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/printers/admin/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers-admin'] }),
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || 'Failed to delete' }),
  });

  // ── Regenerate key ───────────────────────────────────────────
  const regenMutation = useMutation({
    mutationFn: (id) => api.post(`/api/printers/admin/${id}/regenerate-key`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['printers-admin'] });
      setNewKeyResult(res.data.printer);
    },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || 'Failed' }),
  });

  function openEdit(printer) {
    setEditPrinter(printer);
    setForm({ name: printer.name, location: printer.location || '' });
  }

  function handleDelete(id, name) {
    if (window.confirm(`Delete printer "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  }

  const isMutating = createMutation.isPending || editMutation.isPending || deleteMutation.isPending || regenMutation.isPending;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960 }}>
      <style>{`@keyframes pulse-dot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0.6; } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>Printers</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            Manage print stations
            {onlineCount > 0 && (
              <span style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                {onlineCount} online
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refetch} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: 'rgba(238,238,245,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↻ Refresh
          </button>
          <button onClick={() => { setShowAdd(true); setForm({ name: '', location: '' }); }} style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', border: 'none', borderRadius: 10, padding: '8px 20px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Printer
          </button>
        </div>
      </div>

      {/* Global message */}
      {msg && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: msg.ok ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${msg.ok ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`, color: msg.ok ? '#34d399' : '#f87171', fontSize: 13, fontWeight: 600 }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* New API key banner */}
      {newKeyResult && (
        <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 14, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <div style={{ color: '#34d399', fontWeight: 700, marginBottom: 8 }}>🔑 API Key for "{newKeyResult.name}" — copy now, won't be shown again!</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8, marginBottom: 10 }}>{newKeyResult.api_key}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { navigator.clipboard.writeText(newKeyResult.api_key); }} style={{ padding: '6px 16px', borderRadius: 8, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📋 Copy Key</button>
            <button onClick={() => setNewKeyResult(null)} style={{ padding: '6px 16px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(238,238,245,0.4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>Loading printers…</div>
      ) : printers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🖨️</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No printers yet</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>Add one manually or start the print bridge to auto-register</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18, marginBottom: 28 }}>
          {printers.map(p => (
            <PrinterCard
              key={p.id} printer={p}
              onEdit={openEdit}
              onDelete={handleDelete}
              onRegenerateKey={(id) => regenMutation.mutate(id)}
              loading={isMutating}
            />
          ))}
        </div>
      )}

      {/* Bridge instructions */}
      <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 18, padding: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#eeeef5' }}>🐍 Running the Print Bridge</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', marginBottom: 14 }}>
          Start the Python bridge on the PC connected to the printer. It will auto-register and heartbeat every 30 seconds.
        </div>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', lineHeight: 1.8 }}>
          cd ~/CampusCopy/print-bridge<br />
          python3 bridge.py
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Printer" onClose={() => setShowAdd(false)}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Printer Name</label>
            <input style={inputStyle} placeholder="e.g. Library Printer" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} placeholder="e.g. Ground Floor — Room 101" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.name || createMutation.isPending}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', border: 'none', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Printer'}
          </button>
        </Modal>
      )}

      {/* Edit modal */}
      {editPrinter && (
        <Modal title={`Edit — ${editPrinter.name}`} onClose={() => setEditPrinter(null)}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Printer Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <button
            onClick={() => editMutation.mutate({ id: editPrinter.id, ...form })}
            disabled={editMutation.isPending}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', border: 'none', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {editMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </Modal>
      )}
    </div>
  );
}