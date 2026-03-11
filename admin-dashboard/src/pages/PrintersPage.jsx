import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

function PrinterCard({ printer }) {
  const online = printer.is_online;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 20, padding: '28px', position: 'relative', overflow: 'hidden',
      transition: 'all 0.3s',
    }}>
      {online && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#34d399,transparent)' }}/>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: online ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
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
          }}/>
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 0.5, marginBottom: 4 }}>
        {printer.name}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', marginBottom: 20 }}>
        📍 {printer.location || 'No location set'}
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>College</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{printer.college_id}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Last Heartbeat</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: online ? '#34d399' : 'rgba(238,238,245,0.4)' }}>
            {online ? 'Just now' : printer.last_heartbeat ? new Date(printer.last_heartbeat).toLocaleString('en-IN') : 'Never'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>API Key</div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(238,238,245,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {printer.api_key ? printer.api_key.substring(0, 12) + '••••••••' : '—'}
        </div>
      </div>
    </div>
  );
}

export default function PrintersPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/api/printers').then(r => r.data),
    refetchInterval: 15000,
  });

  const printers = data?.printers || [];
  const onlineCount = printers.filter(p => p.is_online).length;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 900 }}>
      <style>{`
        @keyframes pulse-dot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0.6; } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
        <button onClick={refetch} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: 'rgba(238,238,245,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ Refresh
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>Loading printers…</div>
      ) : printers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🖨️</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No printers found</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>Start the print bridge to register a printer</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18, marginBottom: 28 }}>
          {printers.map(p => <PrinterCard key={p.id} printer={p} />)}
        </div>
      )}

      {/* Bridge instructions */}
      <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 18, padding: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#eeeef5' }}>🐍 Running the Print Bridge</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', marginBottom: 14 }}>
          Start the Python bridge on the PC connected to the printer. It will heartbeat every 30 seconds.
        </div>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', lineHeight: 1.8 }}>
          cd ~/CampusCopy/print-bridge<br/>
          python3 bridge.py
        </div>
      </div>
    </div>
  );
}
