import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18, padding: '22px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${color}20`, filter: 'blur(20px)' }} />
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, lineHeight: 1, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

export default function LoyaltyPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['loyalty-admin'],
    queryFn: () => api.get('/api/loyalty/admin/summary').then(r => r.data),
    refetchInterval: 30000,
  });

  const summary = data?.summary || {};
  const students = data?.top_students || [];
  const ptsPerRupee = data?.points_to_rupees ? (1 / data.points_to_rupees) : 10;
  const outstanding = (summary.total_earned || 0) - (summary.total_redeemed || 0);
  const outstandingValue = (outstanding * (data?.points_to_rupees || 0.10)).toFixed(2);

  return (
    <div style={{ padding: '36px 40px', maxWidth: 900 }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>
            Loyalty Points
          </div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6 }}>
            {ptsPerRupee} points = ₹1  ·  Min 50 pts to redeem  ·  Max 50% off per order
          </div>
        </div>
        <button onClick={refetch} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: 'rgba(238,238,245,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ Refresh
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>
          Loading loyalty data…
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
            <StatCard icon="👥" label="Members"        value={summary.total_members || 0}  color="#a78bfa" sub="Students with points" />
            <StatCard icon="⭐" label="Total Earned"   value={summary.total_earned || 0}   color="#fbbf24" sub="Points issued" />
            <StatCard icon="🎁" label="Total Redeemed" value={summary.total_redeemed || 0} color="#34d399" sub="Points used" />
            <StatCard icon="💳" label="Outstanding"    value={outstanding}                  color="#fb923c" sub={`₹${outstandingValue} liability`} />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: '#eeeef5' }}>
              ⭐ Top Members by Points Earned
            </div>

            {students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(238,238,245,0.3)', fontSize: 13 }}>
                No loyalty members yet — points are earned when jobs are completed
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: '0 0 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
                  {['Phone', 'Balance', 'Earned', 'Redeemed'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'rgba(238,238,245,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                  ))}
                </div>
                {students.map((s, i) => {
                  const rupeeValue = (s.balance * (data?.points_to_rupees || 0.10)).toFixed(2);
                  return (
                    <div key={s.phone_number} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12,
                      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: i < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${i < 3 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: i < 3 ? '#fbbf24' : 'rgba(238,238,245,0.4)',
                        }}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(238,238,245,0.7)' }}>
                          {s.phone_number}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#fbbf24', lineHeight: 1 }}>{s.balance}</div>
                        <div style={{ fontSize: 10, color: 'rgba(238,238,245,0.3)', marginTop: 1 }}>≈ ₹{rupeeValue}</div>
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#a78bfa', lineHeight: 1 }}>{s.earned}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#34d399', lineHeight: 1 }}>{s.redeemed}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 18, padding: '22px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#fbbf24' }}>⭐ How Loyalty Points Work</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { icon: '🖨️', title: 'Earning',      desc: '1 point per page printed. Awarded automatically when a job is marked Done.' },
                { icon: '🎁', title: 'Redeeming',    desc: '10 points = ₹1 off. Min 50 pts. Max 50% discount per order.' },
                { icon: '📱', title: 'Student Flow', desc: 'Students enter their phone number to see balance on the payment screen.' },
                { icon: '🔄', title: 'Deduction',    desc: 'Points are deducted after successful Razorpay payment via webhook.' },
              ].map(item => (
                <div key={item.title} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeef5', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(238,238,245,0.45)', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}