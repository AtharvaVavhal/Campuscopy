import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    if (localStorage.getItem('token')) navigate('/jobs');
  }, []);

  async function handleLogin() {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/jobs');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 15,
    color: '#eeeef5',
    outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'border-color 0.25s, box-shadow 0.25s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#08080f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08080f; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #0f0f1a inset !important; -webkit-text-fill-color: #eeeef5 !important; }
      `}</style>

      {/* Background orbs */}
      <div style={{ position:'fixed', top:-100, left:-100, width:500, height:500, borderRadius:'50%', background:'rgba(167,139,250,0.08)', filter:'blur(100px)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', bottom:-50, right:-50, width:400, height:400, borderRadius:'50%', background:'rgba(52,211,153,0.06)', filter:'blur(80px)', pointerEvents:'none' }}/>
      {/* Grid */}
      <div style={{ position:'fixed', inset:0, backgroundImage:'linear-gradient(rgba(167,139,250,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,0.04) 1px,transparent 1px)', backgroundSize:'60px 60px', pointerEvents:'none' }}/>

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400, padding: '0 24px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 40, letterSpacing: 3,
            background: 'linear-gradient(135deg,#a78bfa,#34d399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>CampusCopy</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6, fontWeight: 500 }}>
            Admin Dashboard · VIT Pune
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: '36px 32px',
        }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 0.5, marginBottom: 6 }}>Sign In</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginBottom: 28 }}>Enter your credentials to access the dashboard</div>

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#f87171', marginBottom: 20,
            }}>{error}</div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(238,238,245,0.4)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="admin@example.com"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#a78bfa'; e.target.style.boxShadow='0 0 0 3px rgba(167,139,250,0.12)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(238,238,245,0.4)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#a78bfa'; e.target.style.boxShadow='0 0 0 3px rgba(167,139,250,0.12)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '15px', border: 'none', borderRadius: 12,
              background: loading ? 'rgba(167,139,250,0.5)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: 'white', fontSize: 15,
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 24px rgba(167,139,250,0.3)',
              transition: 'all 0.25s',
            }}
          >
            {loading ? 'SIGNING IN…' : 'SIGN IN →'}
          </button>
        </div>
      </div>
    </div>
  );
}
