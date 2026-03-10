import { Outlet, NavLink, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '14px',
    color: isActive ? '#6366f1' : '#6b7280',
    background: isActive ? '#eef2ff' : 'transparent',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', background: 'white', borderRight: '1px solid #e5e7eb', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '32px', paddingLeft: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#6366f1' }}>📄 CampusCopy</div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Admin Dashboard</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <NavLink to="/queue" style={navStyle}>🖨️ Job Queue</NavLink>
          <NavLink to="/analytics" style={navStyle}>📊 Analytics</NavLink>
          <NavLink to="/printers" style={navStyle}>🖥️ Printers</NavLink>
        </nav>

        <button onClick={logout} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          🚪 Logout
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
