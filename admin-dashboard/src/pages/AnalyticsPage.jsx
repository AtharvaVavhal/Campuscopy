import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,15,25,0.98)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: 'rgba(238,238,245,0.5)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {p.name === 'Revenue' ? '₹' : ''}{p.value}
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18, padding: '24px 24px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: `${color}15`, filter: 'blur(20px)',
      }}/>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <div style={{
        fontFamily: "'Bebas Neue',sans-serif", fontSize: 40,
        background: `linear-gradient(135deg,#eeeef5,${color})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(238,238,245,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/api/jobs/printer/5b4bedf3-3550-4faa-ac3d-d4f490772258').then(r => r.data),
    refetchInterval: 30000,
  });

  const jobs = data?.jobs || [];

  // Build last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const dayJobs = jobs.filter(j => j.created_at?.startsWith(key) && j.status === 'done');
    return {
      label, jobs: dayJobs.length,
      revenue: dayJobs.reduce((s, j) => s + parseFloat(j.cost || 0), 0).toFixed(0),
    };
  });

  const totalRevenue = jobs.filter(j => j.status === 'done').reduce((s, j) => s + parseFloat(j.cost || 0), 0);
  const doneJobs = jobs.filter(j => j.status === 'done').length;
  const todayJobs = jobs.filter(j => {
    const today = new Date().toISOString().split('T')[0];
    return j.created_at?.startsWith(today);
  }).length;
  const colorJobs = jobs.filter(j => j.color).length;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: 0.5, marginBottom: 4 }}>Analytics</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.45)' }}>Revenue and job performance overview</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 32 }}>
        <StatCard icon="💰" label="Total Revenue" value={'₹' + totalRevenue.toFixed(0)} color="#34d399" sub="All time" />
        <StatCard icon="🖨️" label="Jobs Done" value={doneJobs} color="#a78bfa" sub="Completed" />
        <StatCard icon="📅" label="Today" value={todayJobs} color="#fb923c" sub="Jobs received" />
        <StatCard icon="🎨" label="Color Jobs" value={colorJobs} color="#60a5fa" sub="Color prints" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20 }}>Jobs Per Day</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="jobs" name="Jobs" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20 }}>Revenue (₹) Per Day</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent jobs */}
      <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18 }}>Recent Completed Jobs</div>
        {jobs.filter(j => j.status === 'done').slice(0, 8).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(238,238,245,0.3)', fontSize: 13 }}>No completed jobs yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.filter(j => j.status === 'done').slice(0, 8).map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#eeeef5' }}>📄 {j.file_name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.4)', marginTop: 2 }}>{j.pages} pages · {j.color ? 'Color' : 'B&W'} · {new Date(j.created_at).toLocaleString()}</div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#34d399' }}>₹{j.cost}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
