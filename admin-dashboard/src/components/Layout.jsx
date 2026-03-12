import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';

const NAV = [
  { path: '/jobs',      icon: '🖨️', label: 'Print Queue'  },
  { path: '/analytics', icon: '📊', label: 'Analytics'    },
  { path: '/printers',  icon: '⚙️', label: 'Printers'     },
  { path: '/coupons',   icon: '🎟️', label: 'Coupons'      },
  { path: '/loyalty',   icon: '⭐', label: 'Loyalty'      },
];

export default function Layout() {
  const location = useLocation();
  const navigate  = useNavigate();

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08080f; color: #eeeef5; font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#08080f' }}>

        <aside style={{
          width: 220, flexShrink: 0,
          background: 'rgba(255,255,255,0.03)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column',
          padding: '28px 0',
          position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        }}>
          <div style={{ padding: '0 20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 22, letterSpacing: 2,
              background: 'linear-gradient(135deg,#a78bfa,#34d399)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>CampusCopy</div>
            <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.35)', marginTop: 3, fontWeight: 600 }}>
              Admin · VIT Pune
            </div>
          </div>

          <nav style={{ flex: 1, padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map(n => {
              const active = location.pathname === n.path;
              return (
                <Link key={n.path} to={n.path} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  textDecoration: 'none', fontSize: 14, fontWeight: 600,
                  background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                  color: active ? '#a78bfa' : 'rgba(238,238,245,0.45)',
                  border: active ? '1px solid rgba(167,139,250,0.2)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ padding: '16px 10px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={logout} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'none', border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(238,238,245,0.4)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              🚪 Logout
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
          <Outlet />
        </main>
      </div>
    </>
  );
}