import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api/client';

const SOCKET_URL = 'https://campuscopy-api.onrender.com';

const STATUS_COLORS = {
  pending:   { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)'  },
  paid:      { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.2)'  },
  queued:    { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: 'rgba(96,165,250,0.2)'  },
  printing:  { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: 'rgba(167,139,250,0.2)' },
  done:      { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.2)'  },
  failed:    { bg: 'rgba(248,113,113,0.1)', color: '#f87171', border: 'rgba(248,113,113,0.2)' },
  cancelled: { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af', border: 'rgba(156,163,175,0.2)' },
};

const NEXT       = { pending: 'queued', paid: 'queued', queued: 'printing', printing: 'done' };
const NEXT_LABEL = { pending: '→ Queue', paid: '→ Queue', queued: '→ Print', printing: '✓ Done' };
const REFUNDABLE = ['paid', 'failed', 'cancelled'];

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 1,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0,
    }}>{status}</span>
  );
}

function RefundModal({ job, onConfirm, onCancel, loading, result }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#0f0f1c', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 28, width: 420, maxWidth: '100%',
      }}>
        {result ? (
          <>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>💸</div>
            <div style={{ fontWeight: 700, fontSize: 16, textAlign: 'center', marginBottom: 8, color: '#34d399' }}>
              Refund Issued
            </div>
            <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.5)', textAlign: 'center', marginBottom: 6 }}>
              ₹{result.amount_refunded} refunded to the student.
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(238,238,245,0.3)', textAlign: 'center', marginBottom: 24 }}>
              Refund ID: {result.refund_id}
            </div>
            <button onClick={onCancel} style={{
              width: '100%', padding: 12, borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(238,238,245,0.7)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Close</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Issue Refund?</div>
              <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(238,238,245,0.4)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📄 {job.file_name}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(238,238,245,0.45)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>💰 ₹{job.cost}</span>
                <span>📋 {job.pages} pages × {job.copies}</span>
                <Badge status={job.status} />
              </div>
              {job.phone_number && (
                <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginTop: 8 }}>
                  📱 {job.phone_number}
                </div>
              )}
            </div>
            <div style={{
              background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
              fontSize: 12, color: 'rgba(248,113,113,0.8)', lineHeight: 1.6,
            }}>
              This will issue a full refund of <strong style={{ color: '#f87171' }}>₹{job.cost}</strong> via Razorpay
              and mark the job as cancelled. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onCancel} disabled={loading}
                style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(238,238,245,0.6)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Cancel</button>
              <button
                onClick={onConfirm} disabled={loading}
                style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  background: loading ? 'rgba(248,113,113,0.3)' : 'linear-gradient(135deg,#f87171,#dc2626)',
                  border: 'none', color: 'white', fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.2s',
                }}
              >{loading ? '⏳ Processing…' : '💸 Confirm Refund'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onUpdate, onRefund, loading }) {
  const [hovered, setHovered]       = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundResult, setRefundResult] = useState(null);
  const next      = NEXT[job.status];
  const isPriority = job.priority;
  const canRefund  = REFUNDABLE.includes(job.status) && job.razorpay_order_id;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered
            ? 'rgba(255,255,255,0.06)'
            : (isPriority ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)'),
          border: `1px solid ${hovered
            ? 'rgba(167,139,250,0.25)'
            : (isPriority ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)')}`,
          borderRadius: 16, padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              📄 {job.file_name}
            </span>
            <Badge status={job.status} />
            {isPriority && (
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1,
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)', flexShrink: 0,
              }}>⚡ Priority</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              job.page_from && job.page_to ? `📑 pp. ${job.page_from}–${job.page_to}` : `📋 ${job.pages} pages`,
              `📦 ${job.copies} cop${job.copies > 1 ? 'ies' : 'y'}`,
              `🎨 ${job.color ? 'Color' : 'B&W'}`,
              job.double_sided ? '↔️ 2-sided' : '',
              `💰 ₹${job.cost}`,
              job.printer_name ? `🖨️ ${job.printer_name}` : '',
            ].filter(Boolean).map(v => (
              <span key={v} style={{ fontSize: 12, color: 'rgba(238,238,245,0.45)' }}>{v}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.25)', marginTop: 6 }}>
            {new Date(job.created_at).toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {canRefund && (
            <button
              onClick={() => { setRefundResult(null); setShowRefund(true); }}
              disabled={loading}
              title="Issue refund via Razorpay"
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 10, padding: '9px 14px',
                color: '#f87171', fontSize: 12, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
            >💸 Refund</button>
          )}
          {next && (
            <button
              onClick={() => onUpdate(job.id, next)}
              disabled={loading}
              style={{
                background: isPriority
                  ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                  : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
                border: 'none', borderRadius: 10, padding: '9px 18px',
                color: 'white', fontSize: 12, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: loading ? 0.6 : 1,
                boxShadow: isPriority
                  ? '0 4px 16px rgba(245,158,11,0.3)'
                  : '0 4px 16px rgba(167,139,250,0.25)',
                transition: 'all 0.2s',
              }}
            >{NEXT_LABEL[job.status]}</button>
          )}
        </div>
      </div>

      {showRefund && (
        <RefundModal
          job={job}
          onConfirm={() => onRefund(job.id, (result) => setRefundResult(result))}
          onCancel={() => { setShowRefund(false); setRefundResult(null); }}
          loading={loading}
          result={refundResult}
        />
      )}
    </>
  );
}

export default function JobQueuePage() {
  const qc = useQueryClient();
  const [filter, setFilter]       = useState('active');
  const [updates, setUpdates]     = useState(0);
  const [refundError, setRefundError] = useState(null);
  const socketRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === 'done') params.set('status', 'done');
      params.set('_t', Date.now());
      return api.get(`/api/admin/jobs?${params}`).then(r => r.data);
    },
    refetchInterval: 3000,
    staleTime: 0,
  });

  const { mutate: updateStatus, isPending: statusPending } = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/api/admin/jobs/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['admin-jobs'] });
      const prev = qc.getQueryData(['admin-jobs', filter]);
      qc.setQueryData(['admin-jobs', filter], old => ({
        ...old,
        jobs: (old?.jobs || []).map(j => j.id === id ? { ...j, status } : j),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['admin-jobs', filter], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });

  const { mutate: issueRefund, isPending: refundPending } = useMutation({
    mutationFn: (job_id) => api.post('/api/payments/refund', { job_id }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); setRefundError(null); },
    onError: (err) => setRefundError(err.response?.data?.error || 'Refund failed. Please try again.'),
  });

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000 });
    socketRef.current = s;
    s.on('job_update',   () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); setUpdates(u => u + 1); });
    s.on('queue_update', () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); setUpdates(u => u + 1); });
    return () => { s.disconnect(); socketRef.current = null; };
  }, [qc]);

  const rawJobs = data?.jobs || [];
  const jobs    = [...rawJobs].sort((a, b) => {
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  const filtered = filter === 'active'
    ? jobs.filter(j => !['done', 'failed', 'cancelled'].includes(j.status))
    : jobs;
  const counts = {
    pending: jobs.filter(j => j.status === 'pending').length,
    paid:    jobs.filter(j => j.status === 'paid').length,
    queued:  jobs.filter(j => j.status === 'queued').length,
    printing:jobs.filter(j => j.status === 'printing').length,
    done:    jobs.filter(j => j.status === 'done').length,
  };
  const priorityCount = jobs.filter(j => j.priority && !['done','failed','cancelled'].includes(j.status)).length;
  const isMutating = statusPending || refundPending;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 860 }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>Print Queue</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            Live job management
            {updates > 0 && (
              <span style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                {updates} live update{updates > 1 ? 's' : ''}
              </span>
            )}
            {priorityCount > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                ⚡ {priorityCount} priority
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['admin-jobs'] })}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: 'rgba(238,238,245,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >↻ Refresh</button>
      </div>

      {refundError && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          color: '#f87171', fontSize: 13, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          ❌ {refundError}
          <button onClick={() => setRefundError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Pending',  val: counts.pending,  color: '#fbbf24' },
          { label: 'Paid',     val: counts.paid,     color: '#34d399' },
          { label: 'Queued',   val: counts.queued,   color: '#60a5fa' },
          { label: 'Printing', val: counts.printing, color: '#a78bfa' },
          { label: 'Done',     val: counts.done,     color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['active', '🔴 Active'], ['done', '✅ Done'], ['all', 'All']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: filter === val ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
            color: filter === val ? '#a78bfa' : 'rgba(238,238,245,0.45)',
            border: filter === val ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.07)',
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>Loading jobs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Queue is clear</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>No {filter === 'all' ? '' : filter} jobs right now</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(job => (
            <JobCard
              key={job.id} job={job}
              onUpdate={(id, status) => updateStatus({ id, status })}
              onRefund={(id, onResult) => issueRefund(id, {
                onSuccess: (data) => onResult(data),
                onError:   ()     => onResult(null),
              })}
              loading={isMutating}
            />
          ))}
        </div>
      )}

      {data?.total > 50 && (
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(238,238,245,0.3)' }}>
          Showing 50 of {data.total} jobs
        </div>
      )}
    </div>
  );
}