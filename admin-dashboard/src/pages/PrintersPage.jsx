import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

function PrinterCard({ printer }) {
  const online = printer.is_online;
  const lastSeen = printer.last_heartbeat
    ? new Date(printer.last_heartbeat).toLocaleString()
    : 'Never';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${online ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 20, padding: '28px', position: 'relative', overflow: 'hidden',
      transition: 'all 0.3s',
    }}>
      {online && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg,transparent,#34d399,transparent)',
        }}/>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: online ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>🖨️</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: online ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 20, padding: '5px 12px',
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
          color: online ? '#34d399' : 'rgba(238,238,245,0.4)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: online ? '#34d399' : 'rgba(238,238,245,0.3)', animation: online ? 'pulse 1.5s ease-in-out infinite' : 'none' }}/>
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 0.5, marginBottom: 4 }}>
        {printer.name}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.5)', marginBottom: 20 }}>
        📍 {printer.location || 'No location set'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>College</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{printer.college_id}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Last Seen</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: online ? '#34d399' : 'rgba(238,238,245,0.5)' }}>
            {online ? 'Just now' : lastSeen}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>API Key</div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(238,238,245,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {printer.api_key?.replace(/./g, (c, i) => i < 8 ? c : '•') || '—'}
        </div>
      </div>
    </div>
  );
}

export default function PrintersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/api/printers').then(r => r.data),
    refetchInterval: 15000,
  });

  const printers = data?.printers || [];
  const online = printers.filter(p => p.is_online).length;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: 0.5, marginBottom: 4 }}>Printers</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Manage connected print stations
          {online > 0 && (
            <span style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#34d399', fontWeight: 700 }}>
              {online} online
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>Loading printers…</div>
      ) : printers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🖨️</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No printers configured</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>Start the print bridge to register a printer</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
          {printers.map(p => <PrinterCard key={p.id} printer={p} />)}
        </div>
      )}

      {/* Bridge instructions */}
      <div style={{ marginTop: 32, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 18, padding: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🐍 Running the Print Bridge</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.5)', marginBottom: 14 }}>Start the Python bridge on the Windows PC connected to the printer</div>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', lineHeight: 1.7 }}>
          cd print-bridge<br/>
          python3 bridge.py
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.6);opacity:0.6;}}`}</style>
    </div>
  );
}
