import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#a78bfa', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#eeeef5',
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
};
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.35)', textTransform: 'uppercase',
  letterSpacing: 1.2, marginBottom: 8, display: 'block',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm]       = useState({});
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved]     = useState(false);

  // ── Fetch college settings ────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/api/admin/settings').then(r => r.data),
  });

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({
        name:                 s.name             || '',
        email:                s.email            || '',
        razorpay_key_id:      s.razorpay_key_id  || '',
        razorpay_key_secret:  '',   // never pre-filled for security
        platform_fee_pct:     s.platform_fee_pct || 3,
      });
    }
  }, [data]);

  // ── Fetch printers (for sidebar list) ────────────────────────
  const { data: printersData } = useQuery({
    queryKey: ['printers-admin'],
    queryFn: () => api.get('/api/printers/admin/list').then(r => r.data),
  });
  const printers = printersData?.printers || [];

  // ── Patch settings ───────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (body) => api.patch('/api/admin/settings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Clear secret field after save
      setForm(f => ({ ...f, razorpay_key_secret: '' }));
    },
  });

  function handleSave() {
    const payload = {
      name:                form.name,
      email:               form.email,
      razorpay_key_id:     form.razorpay_key_id,
      platform_fee_pct:    parseFloat(form.platform_fee_pct),
    };
    // Only include secret if admin actually typed one
    if (form.razorpay_key_secret?.trim()) {
      payload.razorpay_key_secret = form.razorpay_key_secret.trim();
    }
    saveMutation.mutate(payload);
  }

  function Field({ label, id, type = 'text', placeholder, hint, children }) {
    return (
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor={id}>{label}</label>
        {children || (
          <input
            id={id} type={type} style={inputStyle}
            placeholder={placeholder}
            value={form[id] || ''}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
          />
        )}
        {hint && <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginTop: 5 }}>{hint}</div>}
      </div>
    );
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>
      Loading settings…
    </div>
  );

  return (
    <div style={{ padding: '36px 40px', maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>Settings</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6 }}>College configuration</div>
      </div>

      {/* College info */}
      <Section title="🏫 College Details">
        <Field label="College Name" id="name" placeholder="e.g. VIT Pune" />
        <Field label="Contact Email" id="email" type="email" placeholder="admin@college.edu" />
      </Section>

      {/* Razorpay */}
      <Section title="💳 Razorpay Keys">
        <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
          These are used for payment collection. Get them from your{' '}
          <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>Razorpay dashboard</a>.
        </div>
        <Field label="Key ID" id="razorpay_key_id" placeholder="rzp_live_..." hint="Safe to expose — used client-side" />
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle} htmlFor="razorpay_key_secret">Key Secret</label>
          <div style={{ position: 'relative' }}>
            <input
              id="razorpay_key_secret"
              type={showSecret ? 'text' : 'password'}
              style={{ ...inputStyle, paddingRight: 44 }}
              placeholder="Leave blank to keep existing"
              value={form.razorpay_key_secret || ''}
              onChange={e => setForm(f => ({ ...f, razorpay_key_secret: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(238,238,245,0.4)' }}
            >{showSecret ? '🙈' : '👁️'}</button>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginTop: 5 }}>Never stored in plain text. Leave blank to keep the current secret.</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Platform Fee (%)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number" min="0" max="100" step="0.5"
              style={{ ...inputStyle, width: 120 }}
              value={form.platform_fee_pct || ''}
              onChange={e => setForm(f => ({ ...f, platform_fee_pct: e.target.value }))}
            />
            <span style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>% added to every job cost</span>
          </div>
        </div>
      </Section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        style={{
          padding: '13px 32px', borderRadius: 12,
          background: saved ? 'linear-gradient(135deg,#34d399,#059669)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
          border: 'none', color: 'white', fontSize: 14, fontWeight: 700,
          cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'all 0.3s', marginBottom: 28,
        }}
      >
        {saveMutation.isPending ? 'Saving…' : saved ? '✅ Saved!' : 'Save Settings'}
      </button>
      {saveMutation.isError && (
        <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>
          ❌ {saveMutation.error?.response?.data?.error || 'Save failed'}
        </div>
      )}

      {/* Printers list */}
      <Section title="🖨️ Registered Printers">
        {printers.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.3)', textAlign: 'center', padding: '20px 0' }}>
            No printers registered. Run the print bridge to auto-register, or add one from the Printers page.
          </div>
        ) : printers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.4)', marginTop: 2 }}>📍 {p.location || 'No location'}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(238,238,245,0.2)', marginTop: 3 }}>{p.api_key_hint}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.is_online ? '#34d399' : 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: 12, color: p.is_online ? '#34d399' : 'rgba(238,238,245,0.3)' }}>
                {p.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        ))}
      </Section>

      {/* API info */}
      <Section title="📦 API">
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', lineHeight: 2 }}>
          Backend: <strong style={{ color: '#eeeef5' }}>campuscopy-api.onrender.com</strong><br />
          Status: <a href="https://campuscopy-api.onrender.com/health" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>campuscopy-api.onrender.com/health</a>
        </div>
      </Section>
    </div>
  );
}