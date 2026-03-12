import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const S = {
  page:    { padding: '32px 28px', maxWidth: 900 },
  heading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 1, marginBottom: 4 },
  sub:     { fontSize: 13, color: 'rgba(238,238,245,0.4)', marginBottom: 28 },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 },
  card:    { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 },
  label:   { fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, display: 'block' },
  input:   { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#eeeef5', fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none' },
  select:  { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#eeeef5', fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none' },
  btn:     { background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', border: 'none', borderRadius: 10, padding: '12px 28px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: 0.5, marginTop: 8 },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field:   { marginBottom: 16 },
  msg:     { fontSize: 12, marginTop: 8, fontWeight: 600 },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { fontSize: 10, fontWeight: 700, color: 'rgba(238,238,245,0.3)', textTransform: 'uppercase', letterSpacing: 1, padding: '0 16px 12px', textAlign: 'left' },
  td:      { padding: '14px 16px', fontSize: 13, borderTop: '1px solid rgba(255,255,255,0.06)' },
};

const EMPTY = { code: '', discount_type: 'percent', discount_value: '', min_order: '', uses_left: '', expires_at: '' };

export default function CouponsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg]   = useState(null);
  const [testCode, setTestCode]     = useState('');
  const [testJobId, setTestJobId]   = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting]       = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.get('/api/coupons').then(r => r.data.coupons),
  });

  const create = useMutation({
    mutationFn: (body) => api.post('/api/coupons', body),
    onSuccess: () => {
      qc.invalidateQueries(['coupons']);
      setForm(EMPTY);
      setMsg({ ok: true, text: '✅ Coupon created!' });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e) => setMsg({ ok: false, text: '❌ ' + (e.response?.data?.error || 'Failed') }),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.code || !form.discount_value) return;
    create.mutate({
      code:           form.code.toUpperCase().trim(),
      discount_type:  form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order:      parseFloat(form.min_order) || 0,
      uses_left:      form.uses_left ? parseInt(form.uses_left) : null,
      expires_at:     form.expires_at || null,
    });
  }

  async function handleTest() {
    if (!testCode || !testJobId) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/api/coupons/validate', { code: testCode, job_id: testJobId });
      setTestResult({ ok: true, data: r.data });
    } catch (e) {
      setTestResult({ ok: false, error: e.response?.data?.error || 'Failed' });
    } finally { setTesting(false); }
  }

  const statusColor = (c) => {
    if (!c.is_active) return '#f87171';
    if (c.expires_at && new Date(c.expires_at) < new Date()) return '#f87171';
    if (c.uses_left === 0) return '#f87171';
    return '#34d399';
  };

  return (
    <div style={S.page}>
      <div style={S.heading}>Coupons</div>
      <div style={S.sub}>Create discount codes · test them · track usage</div>

      <div style={S.grid}>
        {/* ── Create coupon ── */}
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#a78bfa' }}>🎟️ Create Coupon</div>
          <form onSubmit={handleSubmit}>
            <div style={S.field}>
              <label style={S.label}>Code</label>
              <input style={S.input} placeholder="e.g. FIRST50" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div style={{ ...S.row2, ...S.field }}>
              <div>
                <label style={S.label}>Type</label>
                <select style={S.select} value={form.discount_type}
                  onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Value</label>
                <input style={S.input} type="number" placeholder={form.discount_type === 'percent' ? '10' : '5'}
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} />
              </div>
            </div>
            <div style={{ ...S.row2, ...S.field }}>
              <div>
                <label style={S.label}>Min Order (₹)</label>
                <input style={S.input} type="number" placeholder="0" value={form.min_order}
                  onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Max Uses</label>
                <input style={S.input} type="number" placeholder="Unlimited" value={form.uses_left}
                  onChange={e => setForm(f => ({ ...f, uses_left: e.target.value }))} />
              </div>
            </div>
            <div style={S.field}>
              <label style={S.label}>Expires At</label>
              <input style={S.input} type="datetime-local" value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>
            {msg && <div style={{ ...S.msg, color: msg.ok ? '#34d399' : '#f87171' }}>{msg.text}</div>}
            <button type="submit" style={S.btn} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'CREATE COUPON'}
            </button>
          </form>
        </div>

        {/* ── Test coupon ── */}
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#34d399' }}>🧪 Test Coupon</div>
          <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
            Paste a Job ID from the print queue to simulate what a student would see when they apply a code.
          </div>
          <div style={S.field}>
            <label style={S.label}>Coupon Code</label>
            <input style={S.input} placeholder="FIRST50" value={testCode}
              onChange={e => setTestCode(e.target.value.toUpperCase())} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Job ID (from queue)</label>
            <input style={S.input} placeholder="uuid..." value={testJobId}
              onChange={e => setTestJobId(e.target.value.trim())} />
          </div>
          <button style={{ ...S.btn, background: 'linear-gradient(135deg,#34d399,#059669)' }}
            onClick={handleTest} disabled={testing || !testCode || !testJobId}>
            {testing ? 'Testing…' : 'TEST VALIDATE →'}
          </button>
          {testResult && (
            <div style={{
              marginTop: 16, padding: 14, borderRadius: 10,
              background: testResult.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${testResult.ok ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
              fontSize: 12, lineHeight: 1.8,
            }}>
              {testResult.ok ? (
                <>
                  <div style={{ color: '#34d399', fontWeight: 700, marginBottom: 6 }}>✅ Valid!</div>
                  <div>Code: <b>{testResult.data.code}</b></div>
                  <div>Original: <b>₹{testResult.data.original_amount}</b></div>
                  <div>Discount: <b>− ₹{testResult.data.discount_amount}</b></div>
                  <div>Final: <b style={{ color: '#34d399' }}>₹{testResult.data.final_amount}</b></div>
                </>
              ) : (
                <div style={{ color: '#f87171' }}>❌ {testResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Coupon list ── */}
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
          All Coupons {data ? `(${data.length})` : ''}
        </div>
        {isLoading ? (
          <div style={{ color: 'rgba(238,238,245,0.3)', fontSize: 13 }}>Loading…</div>
        ) : !data?.length ? (
          <div style={{ color: 'rgba(238,238,245,0.3)', fontSize: 13, padding: '20px 0' }}>No coupons yet. Create one above.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                {['Code','Type','Value','Min Order','Uses Left','Expires','Used','Saved','Status'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id}>
                  <td style={S.td}>
                    <span style={{ fontFamily: 'monospace', background: 'rgba(167,139,250,0.1)', padding: '3px 10px', borderRadius: 6, color: '#a78bfa', fontWeight: 700, fontSize: 12 }}>
                      {c.code}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: 'rgba(238,238,245,0.5)' }}>{c.discount_type}</td>
                  <td style={S.td}>{c.discount_type === 'percent' ? c.discount_value + '%' : '₹' + c.discount_value}</td>
                  <td style={{ ...S.td, color: 'rgba(238,238,245,0.5)' }}>₹{c.min_order || 0}</td>
                  <td style={S.td}>{c.uses_left === null ? '∞' : c.uses_left}</td>
                  <td style={{ ...S.td, color: 'rgba(238,238,245,0.5)', fontSize: 12 }}>
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={S.td}>{c.total_uses}</td>
                  <td style={{ ...S.td, color: '#34d399' }}>₹{parseFloat(c.total_saved).toFixed(2)}</td>
                  <td style={S.td}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      color: statusColor(c),
                      background: statusColor(c) + '18',
                      border: '1px solid ' + statusColor(c) + '30',
                    }}>
                      {!c.is_active ? 'INACTIVE' : c.expires_at && new Date(c.expires_at) < new Date() ? 'EXPIRED' : c.uses_left === 0 ? 'USED UP' : 'ACTIVE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}