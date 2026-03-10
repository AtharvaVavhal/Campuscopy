import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../api/client';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending:  { bg: '#fef3c7', color: '#d97706' },
  paid:     { bg: '#d1fae5', color: '#059669' },
  queued:   { bg: '#dbeafe', color: '#2563eb' },
  printing: { bg: '#ede9fe', color: '#7c3aed' },
  done:     { bg: '#d1fae5', color: '#059669' },
  failed:   { bg: '#fee2e2', color: '#dc2626' },
};

const NEXT_STATUS = {
  paid: 'queued',
  queued: 'printing',
  printing: 'done',
};

export default function JobQueuePage() {
  const queryClient = useQueryClient();
  const [selectedPrinter, setSelectedPrinter] = useState('');

  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/api/printers').then(r => r.data),
  });

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['jobs', selectedPrinter],
    queryFn: () => api.get('/api/jobs/printer/' + selectedPrinter).then(r => r.data),
    enabled: !!selectedPrinter,
    refetchInterval: 10000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ jobId, status }) => api.patch('/api/jobs/' + jobId + '/status', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['jobs', selectedPrinter]);
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  useEffect(() => {
    if (printersData?.printers?.length > 0 && !selectedPrinter) {
      setSelectedPrinter(printersData.printers[0].id);
    }
  }, [printersData]);

  useEffect(() => {
    if (!selectedPrinter) return;
    const socket = io('http://localhost:5000');
    socket.emit('join_printer', selectedPrinter);
    socket.on('job_updated', () => {
      queryClient.invalidateQueries(['jobs', selectedPrinter]);
    });
    return () => socket.disconnect();
  }, [selectedPrinter]);

  const jobs = jobsData?.jobs || [];
  const activeJobs = jobs.filter(j => !['done', 'failed'].includes(j.status));
  const completedJobs = jobs.filter(j => ['done', 'failed'].includes(j.status));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Job Queue</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '2px' }}>Manage print jobs in real-time</p>
        </div>
        <select
          value={selectedPrinter}
          onChange={e => setSelectedPrinter(e.target.value)}
          style={{ padding: '10px 16px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white' }}
        >
          {printersData?.printers?.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading jobs...</div>
      ) : (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: '#374151' }}>
            Active Jobs ({activeJobs.length})
          </h2>
          {activeJobs.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af', marginBottom: '24px' }}>
              No active jobs
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {activeJobs.map(job => (
                <JobCard key={job.id} job={job} onUpdate={(status) => updateStatus.mutate({ jobId: job.id, status })} />
              ))}
            </div>
          )}

          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: '#374151' }}>
            Completed ({completedJobs.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {completedJobs.slice(0, 10).map(job => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ job, onUpdate }) {
  const s = STATUS_COLORS[job.status] || STATUS_COLORS.pending;
  const next = NEXT_STATUS[job.status];

  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{job.file_name}</div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          {job.pages} pages · {job.copies} cop{job.copies > 1 ? 'ies' : 'y'} · {job.color ? 'Color' : 'B&W'} · ₹{job.cost}
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
          {format(new Date(job.created_at), 'dd MMM, hh:mm a')}
        </div>
      </div>

      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', background: s.bg, color: s.color }}>
        {job.status}
      </span>

      {onUpdate && next && (
        <button
          onClick={() => onUpdate(next)}
          style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          Mark {next}
        </button>
      )}
    </div>
  );
}
