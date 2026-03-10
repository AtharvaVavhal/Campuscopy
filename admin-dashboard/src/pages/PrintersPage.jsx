import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { format } from 'date-fns';

export default function PrintersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/api/printers').then(r => r.data),
    refetchInterval: 30000,
  });

  const printers = data?.printers || [];

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Printers</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Manage your print stations</p>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading...</div>
      ) : printers.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          No printers registered yet
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {printers.map(printer => (
            <PrinterCard key={printer.id} printer={printer} />
          ))}
        </div>
      )}
    </div>
  );
}

function PrinterCard({ printer }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ fontSize: '32px' }}>🖨️</div>
        <span style={{
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '700',
          background: printer.is_online ? '#d1fae5' : '#f3f4f6',
          color: printer.is_online ? '#059669' : '#9ca3af',
        }}>
          {printer.is_online ? 'Online' : 'Offline'}
        </span>
      </div>
      <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{printer.name}</div>
      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>📍 {printer.location || 'No location set'}</div>
      <div style={{ fontSize: '12px', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
        Last heartbeat: {printer.last_heartbeat ? format(new Date(printer.last_heartbeat), 'dd MMM, hh:mm a') : 'Never'}
      </div>
    </div>
  );
}
