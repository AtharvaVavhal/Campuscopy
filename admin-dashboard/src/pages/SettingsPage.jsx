import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export default function SettingsPage() {
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/api/printers').then(r => r.data),
  });

  const printers = printersData?.printers || [];

  return (
    <div style={{ padding: '36px 40px', maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>Settings</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6 }}>System configuration</div>
      </div>

      <Section title="🖨️ Registered Printers">
        {printers.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.3)', textAlign: 'center', padding: '20px 0' }}>
            No printers registered. Run the print bridge to auto-register.
          </div>
        ) : printers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.4)', marginTop: 2 }}>📍 {p.location || 'No location'}</div>
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
      </Section>

      <Section title="🔑 Environment">
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', lineHeight: 1.8 }}>
          Configure environment variables directly on <strong style={{ color: '#a78bfa' }}>Render</strong>:
        </div>
        <div style={{ marginTop: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', lineHeight: 2 }}>
          DATABASE_URL<br/>
          JWT_SECRET<br/>
          RAZORPAY_KEY_ID<br/>
          RAZORPAY_KEY_SECRET<br/>
          VAPID_PUBLIC_KEY<br/>
          VAPID_PRIVATE_KEY<br/>
          REDIS_URL
        </div>
      </Section>

      <Section title="📦 API Version">
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)' }}>
          Backend: <strong style={{ color: '#eeeef5' }}>campuscopy-api.onrender.com</strong><br/>
          <span style={{ fontSize: 11, marginTop: 4, display: 'block' }}>Check Render dashboard for deploy status and logs.</span>
        </div>
      </Section>
    </div>
  );
}