import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const NAV = [
  { path: '/jobs', icon: '🖨️', label: 'Print Queue' },
  { path: '/analytics', icon: '📊', label: 'Analytics' },
  { path: '/printers', icon: '⚙️', label: 'Printers' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#08080f', color: '#eeeef5',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        padding: '28px 0', position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 24px 32px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22, letterSpacing: 2,
            background: 'linear-gradient(135deg,#a78bfa,#34d399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>CampusCopy</div>
          <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.4)', marginTop: 4, fontWeight: 600 }}>
            Admin Dashboard
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(n => {
            const active = location.pathname === n.path;
            return (
              <Link key={n.path} to={n.path} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                fontSize: 14, fontWeight: 600,
                background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                color: active ? '#a78bfa' : 'rgba(238,238,245,0.5)',
                border: active ? '1px solid rgba(167,139,250,0.2)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '0 12px' }}>
          <button onClick={logout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'none', border: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(238,238,245,0.4)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
          }}>
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
