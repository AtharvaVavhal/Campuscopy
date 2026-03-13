import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api/client';

const SOCKET_URL = 'https://campuscopy-api.onrender.com';

const STATUS_COLORS = {
  pending:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)'  },
  paid:     { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.2)'  },
  queued:   { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: 'rgba(96,165,250,0.2)'  },
  printing: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: 'rgba(167,139,250,0.2)' },
  done:     { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.2)'  },
  failed:   { bg: 'rgba(248,113,113,0.1)', color: '#f87171', border: 'rgba(248,113,113,0.2)' },
};

const NEXT       = { pending: 'queued', paid: 'queued', queued: 'printing', printing: 'done' };
const NEXT_LABEL = { pending: '→ Queue', paid: '→ Queue', queued: '→ Print', printing: '✓ Done' };

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

function JobCard({ job, onUpdate, loading }) {
  const [hovered, setHovered] = useState(false);
  const next       = NEXT[job.status];
  const isPriority = job.priority;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.06)' : (isPriority ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)'),
        border: `1px solid ${hovered ? 'rgba(167,139,250,0.25)' : (isPriority ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)')}`,
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
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', flexShrink: 0 }}>
              ⚡ Priority
            </span>
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
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            whiteSpace: 'nowrap', opacity: loading ? 0.6 : 1,
            boxShadow: isPriority ? '0 4px 16px rgba(245,158,11,0.3)' : '0 4px 16px rgba(167,139,250,0.25)',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {NEXT_LABEL[job.status]}
        </button>
      )}
    </div>
  );
}

export default function JobQueuePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('active');
  const [updates, setUpdates] = useState(0);
  const socketRef = useRef(null);

  // ── Fetch from /api/admin/jobs (auth'd, college-scoped) ──────
  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === 'done') params.set('status', 'done');
      return api.get(`/api/admin/jobs?${params}`).then(r => r.data);
    },
    refetchInterval: 10000,
  });

  // ── Status update hits /api/admin/jobs/:id/status ────────────
  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/api/admin/jobs/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['admin-jobs'] });
      const prev = qc.getQueryData(['admin-jobs', filter]);
      qc.setQueryData(['admin-jobs', filter], old => ({
        ...old,
        jobs: (old?.jobs || []).map(j => j.id === id ? { ...j, status } : j),
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(['admin-jobs', filter], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });

  // ── Socket for real-time queue updates ───────────────────────
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('job_update', () => {
      qc.invalidateQueries({ queryKey: ['admin-jobs'] });
      setUpdates(u => u + 1);
    });
    s.on('queue_update', () => {
      qc.invalidateQueries({ queryKey: ['admin-jobs'] });
      setUpdates(u => u + 1);
    });

    return () => { s.disconnect(); socketRef.current = null; };
  }, [qc]);

  const rawJobs = data?.jobs || [];

  // Sort: priority first, then by created_at
  const jobs = [...rawJobs].sort((a, b) => {
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  // For 'active' tab, filter client-side on what came back
  const filtered = filter === 'active'
    ? jobs.filter(j => !['done', 'failed', 'cancelled'].includes(j.status))
    : jobs;

  const counts = {
    pending:  jobs.filter(j => j.status === 'pending').length,
    paid:     jobs.filter(j => j.status === 'paid').length,
    queued:   jobs.filter(j => j.status === 'queued').length,
    printing: jobs.filter(j => j.status === 'printing').length,
    done:     jobs.filter(j => j.status === 'done').length,
  };

  const priorityCount = jobs.filter(j => j.priority && !['done', 'failed', 'cancelled'].includes(j.status)).length;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>
            Print Queue
          </div>
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
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Pending',  val: counts.pending,  color: '#fbbf24' },
          { label: 'Paid',     val: counts.paid,     color: '#34d399' },
          { label: 'Queued',   val: counts.queued,   color: '#60a5fa' },
          { label: 'Printing', val: counts.printing, color: '#a78bfa' },
          { label: 'Done',     val: counts.done,     color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['active', '🔴 Active'], ['done', '✅ Done'], ['all', 'All']].map(([val, label]) => (
          <button
            key={val} onClick={() => setFilter(val)}
            style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: filter === val ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
              color: filter === val ? '#a78bfa' : 'rgba(238,238,245,0.45)',
              border: filter === val ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.07)',
              transition: 'all 0.2s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Job list */}
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
              loading={isPending}
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