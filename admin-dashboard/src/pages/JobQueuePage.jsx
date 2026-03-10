import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL || 'https://campuscopy-api.onrender.com';

const STATUS_STYLE = {
  pending:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  paid:     { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.25)' },
  queued:   { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  printing: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  done:     { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.25)' },
  failed:   { bg: 'rgba(248,113,113,0.1)', color: '#f87171', border: 'rgba(248,113,113,0.25)' },
};

const NEXT_STATUS = { paid: 'queued', queued: 'printing', printing: 'done' };
const NEXT_LABEL  = { paid: '→ Queue', queued: '→ Print', printing: '→ Done' };

function JobCard({ job, onUpdate }) {
  const [hover, setHover] = useState(false);
  const s = STATUS_STYLE[job.status] || STATUS_STYLE.pending;
  const next = NEXT_STATUS[job.status];

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: hover ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${hover ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 16, padding: '18px 20px',
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: 12, alignItems: 'center',
      transition: 'all 0.25s',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeef5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
            📄 {job.file_name}
          </div>
          <div style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0 }}>
            {job.status}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['📋', job.pages + ' pages'],
            ['📦', job.copies + ' cop' + (job.copies > 1 ? 'ies' : 'y')],
            ['🎨', job.color ? 'Color' : 'B&W'],
            ['💰', '₹' + job.cost],
          ].map(([icon, val]) => (
            <div key={val} style={{ fontSize: 12, color: 'rgba(238,238,245,0.45)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{icon}</span>{val}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.3)', marginTop: 6 }}>
          {new Date(job.created_at).toLocaleString()}
        </div>
      </div>
      {next && (
        <button onClick={() => onUpdate(job.id, next)} style={{
          background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
          border: 'none', borderRadius: 10, padding: '9px 16px',
          color: 'white', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(167,139,250,0.25)',
          transition: 'all 0.2s',
        }}>
          {NEXT_LABEL[job.status]}
        </button>
      )}
    </div>
  );
}

export default function JobQueuePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('active');
  const [liveCount, setLiveCount] = useState(0);

  const printerId = localStorage.getItem('printer_id') || '5b4bedf3-3550-4faa-ac3d-d4f490772258';

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', printerId],
    queryFn: () => api.get('/api/jobs/printer/' + printerId).then(r => r.data),
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch('/api/jobs/' + id + '/status', { status }),
    onSuccess: () => qc.invalidateQueries(['jobs']),
  });

  useEffect(() => {
    const s = io(API_BASE);
    s.emit('join_printer', printerId);
    s.on('job_status', () => { qc.invalidateQueries(['jobs']); setLiveCount(c => c + 1); });
    return () => s.disconnect();
  }, []);

  const jobs = data?.jobs || [];
  const filtered = filter === 'active'
    ? jobs.filter(j => !['done', 'failed'].includes(j.status))
    : filter === 'done'
    ? jobs.filter(j => j.status === 'done')
    : jobs;

  const counts = {
    paid: jobs.filter(j => j.status === 'paid').length,
    queued: jobs.filter(j => j.status === 'queued').length,
    printing: jobs.filter(j => j.status === 'printing').length,
    done: jobs.filter(j => j.status === 'done').length,
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: 0.5, marginBottom: 4 }}>
          Print Queue
        </div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Live job management
          {liveCount > 0 && (
            <span style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#34d399', fontWeight: 700 }}>
              {liveCount} live update{liveCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Paid', val: counts.paid, color: '#fbbf24' },
          { label: 'Queued', val: counts.queued, color: '#60a5fa' },
          { label: 'Printing', val: counts.printing, color: '#a78bfa' },
          { label: 'Done Today', val: counts.done, color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['active', '🔴 Active'], ['done', '✅ Done'], ['all', 'All']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: filter === val ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
            color: filter === val ? '#a78bfa' : 'rgba(238,238,245,0.45)',
            border: filter === val ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.07)',
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* Job list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>Loading jobs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Queue is clear</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>No active jobs right now</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(job => (
            <JobCard key={job.id} job={job} onUpdate={(id, status) => updateMutation.mutate({ id, status })} />
          ))}
        </div>
      )}
    </div>
  );
}
