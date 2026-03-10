import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    setTimeout(() => setMounted(true), 50);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/jobs');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#08080f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(167,139,250,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,0.04) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }}/>
      {/* Orbs */}
      <div style={{ position:'fixed',top:-100,left:-100,width:400,height:400,borderRadius:'50%',background:'rgba(167,139,250,0.08)',filter:'blur(80px)',zIndex:0,pointerEvents:'none' }}/>
      <div style={{ position:'fixed',bottom:-50,right:-50,width:300,height:300,borderRadius:'50%',background:'rgba(52,211,153,0.06)',filter:'blur(80px)',zIndex:0,pointerEvents:'none' }}/>

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '0 24px',
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 3,
            background: 'linear-gradient(135deg,#a78bfa,#34d399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>CampusCopy</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 4, fontWeight: 500 }}>
            Admin Dashboard · VIT Pune
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: 36,
          backdropFilter: 'blur(20px)',
        }}>
          <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 0.5, marginBottom: 6 }}>
            Sign In
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)', marginBottom: 28 }}>
            Enter your credentials to continue
          </p>

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171',
              marginBottom: 20,
            }}>{error}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 11, padding: '12px 14px', fontSize: 14, color: '#eeeef5',
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.25s',
              }}
              onFocus={e => e.target.style.borderColor='#a78bfa'}
              onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.08)'}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 11, padding: '12px 14px', fontSize: 14, color: '#eeeef5',
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.25s',
              }}
              onFocus={e => e.target.style.borderColor='#a78bfa'}
              onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.08)'}
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
            />
          </div>

          <button
            onClick={handleLogin} disabled={loading}
            style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: 12,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: 'white', fontSize: 14, fontFamily: "'Bebas Neue',sans-serif",
              letterSpacing: 1.5, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
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
