import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

function Field({ label, value, onChange, type = 'text', placeholder, hint, sensitive }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(238,238,245,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={sensitive && !show ? 'password' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: sensitive ? '10px 40px 10px 14px' : '10px 14px',
            color: '#eeeef5', fontFamily: 'inherit', fontSize: 14, outline: 'none',
          }}
        />
        {sensitive && (
          <button onClick={() => setShow(!show)} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
            color: 'rgba(238,238,245,0.4)',
          }}>{show ? '🙈' : '👁️'}</button>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

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

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['college-settings'],
    queryFn: () => api.get('/api/colleges/settings').then(r => r.data),
  });

  const college  = data?.college  || {};
  const printers = data?.printers || [];

  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [rzpKeyId,  setRzpKeyId]  = useState('');
  const [rzpSecret, setRzpSecret] = useState('');
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  // Pre-fill once data loads
  useState(() => {
    if (college.name)            setName(college.name);
    if (college.email)           setEmail(college.email);
    if (college.razorpay_key_id) setRzpKeyId(college.razorpay_key_id);
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.patch('/api/colleges/settings', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['college-settings']);
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save'),
  });

  const handleSave = () => {
    setError('');
    const payload = {};
    if (name)      payload.name = name;
    if (email)     payload.email = email;
    if (rzpKeyId)  payload.razorpay_key_id = rzpKeyId;
    if (rzpSecret) payload.razorpay_key_secret = rzpSecret;
    mutation.mutate(payload);
  };

  if (isLoading) return (
    <div style={{ padding: '60px 40px', color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>
      Loading settings…
    </div>
  );

  return (
    <div style={{ padding: '36px 40px', maxWidth: 680 }}>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>
            Settings
          </div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6 }}>
            Manage your college, Razorpay keys, and printer config
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && (
            <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>✓ Saved</div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>{error}</div>
          )}
          <button onClick={handleSave} disabled={mutation.isPending} style={{
            background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', border: 'none',
            borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13,
            fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer',
            opacity: mutation.isPending ? 0.6 : 1, fontFamily: 'inherit',
          }}>
            {mutation.isPending ? 'Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {/* Platform fee notice */}
      <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 22 }}>💜</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.5)', lineHeight: 1.6 }}>
          Platform fee: <strong style={{ color: '#a78bfa' }}>{college.platform_fee_pct || 3}%</strong> per successful transaction · Status: <strong style={{ color: '#34d399' }}>{college.status || 'active'}</strong>
        </div>
      </div>

      {/* College info */}
      <Section title="🏫 College Details">
        <Field label="College Name" value={name || college.name || ''} onChange={setName} placeholder="Vishwakarma Institute of Technology" />
        <Field label="College Email" value={email || college.email || ''} onChange={setEmail} placeholder="info@college.edu" type="email" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginBottom: 4 }}>COLLEGE ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(238,238,245,0.6)', wordBreak: 'break-all' }}>{college.id || '—'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginBottom: 4 }}>MEMBER SINCE</div>
            <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.6)' }}>{college.created_at ? new Date(college.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'}</div>
          </div>
        </div>
      </Section>

      {/* Razorpay */}
      <Section title="💳 Razorpay Integration">
        <Field
          label="Key ID"
          value={rzpKeyId}
          onChange={setRzpKeyId}
          placeholder="rzp_live_xxxxxxxxxxxx"
          hint="Found in Razorpay Dashboard → Settings → API Keys"
        />
        <Field
          label="Key Secret"
          value={rzpSecret}
          onChange={setRzpSecret}
          placeholder="Leave blank to keep existing secret"
          sensitive
          hint="Your secret is stored securely and never displayed again after saving."
        />
        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'rgba(238,238,245,0.5)', lineHeight: 1.6 }}>
          ⚠️ After updating keys, also add <strong style={{ color: '#fbbf24' }}>campuscopy.pages.dev</strong> to your Razorpay allowed domains under Settings → Checkout Settings.
        </div>
      </Section>

      {/* Printers */}
      <Section title="🖨️ Printers">
        {printers.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.3)', textAlign: 'center', padding: '20px 0' }}>
            No printers configured
          </div>
        ) : printers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.4)', marginTop: 2 }}>{p.location}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(238,238,245,0.25)', marginTop: 3 }}>{p.id}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.is_online ? '#34d399' : 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: 12, color: p.is_online ? '#34d399' : 'rgba(238,238,245,0.3)' }}>
                {p.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(238,238,245,0.3)' }}>
          To add more printers, contact support or use the API directly.
        </div>
      </Section>

    </div>
  );
}
