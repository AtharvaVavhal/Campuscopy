import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,15,28,0.98)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: 'rgba(238,238,245,0.45)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {p.name === 'Revenue' ? '₹' : ''}{p.value}
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${color}20`, filter: 'blur(20px)' }}/>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, lineHeight: 1, background: `linear-gradient(135deg,#eeeef5,${color})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(238,238,245,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/api/jobs').then(r => r.data),
    refetchInterval: 30000,
  });

  const jobs = data?.jobs || [];
  const doneJobs = jobs.filter(j => j.status === 'done');
  const totalRevenue = doneJobs.reduce((s, j) => s + parseFloat(j.cost || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayJobs = jobs.filter(j => j.created_at?.startsWith(todayStr)).length;
  const colorJobs = jobs.filter(j => j.color).length;

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const dayDone = doneJobs.filter(j => j.created_at?.startsWith(key));
    return {
      label,
      Jobs: dayDone.length,
      Revenue: parseFloat(dayDone.reduce((s, j) => s + parseFloat(j.cost || 0), 0).toFixed(0)),
    };
  });

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>
      Loading analytics…
    </div>
  );

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>Analytics</div>
        <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6 }}>Revenue and job performance overview</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard icon="💰" label="Total Revenue"  value={`₹${totalRevenue.toFixed(0)}`} color="#34d399" sub="All time" />
        <StatCard icon="🖨️" label="Jobs Completed" value={doneJobs.length}               color="#a78bfa" sub="Printed" />
        <StatCard icon="📅" label="Today"           value={todayJobs}                     color="#fb923c" sub="Jobs received" />
        <StatCard icon="🎨" label="Color Jobs"      value={colorJobs}                     color="#60a5fa" sub="Color prints" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20, color: '#eeeef5' }}>Jobs — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Jobs" fill="#a78bfa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20, color: '#eeeef5' }}>Revenue ₹ — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Revenue" stroke="#34d399" strokeWidth={2.5} dot={{ fill: '#34d399', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent completed */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: '#eeeef5' }}>Recent Completed Jobs</div>
        {doneJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(238,238,245,0.3)', fontSize: 13 }}>No completed jobs yet</div>
        ) : (
          <div>
            {doneJobs.slice(0, 10).map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#eeeef5' }}>📄 {j.file_name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.4)', marginTop: 2 }}>
                    {j.pages} pages · {j.copies} cop{j.copies > 1 ? 'ies' : 'y'} · {j.color ? 'Color' : 'B&W'} · {new Date(j.created_at).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: '#34d399', flexShrink: 0 }}>₹{j.cost}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}