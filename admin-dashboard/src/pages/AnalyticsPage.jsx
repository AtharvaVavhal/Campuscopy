import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import api from '../api/client';

export default function AnalyticsPage() {
  const { data: jobsData } = useQuery({
    queryKey: ['all-jobs'],
    queryFn: async () => {
      const printers = await api.get('/api/printers').then(r => r.data.printers);
      const allJobs = [];
      for (const p of printers) {
        const jobs = await api.get('/api/jobs/printer/' + p.id).then(r => r.data.jobs);
        allJobs.push(...jobs);
      }
      return allJobs;
    },
  });

  const jobs = jobsData || [];

  // Jobs per day (last 7 days)
  const jobsByDay = getLast7Days(jobs);

  // Revenue per day
  const revenueByDay = getLast7DaysRevenue(jobs);

  // Summary stats
  const totalRevenue = jobs.filter(j => ['paid','queued','printing','done'].includes(j.status)).reduce((sum, j) => sum + parseFloat(j.cost), 0);
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'done').length;
  const pendingJobs = jobs.filter(j => ['pending','paid','queued','printing'].includes(j.status)).length;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Analytics</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Overview of your print shop</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total Revenue" value={'Rs.' + totalRevenue.toFixed(2)} icon="💰" color="#6366f1" />
        <StatCard label="Total Jobs" value={totalJobs} icon="📄" color="#0ea5e9" />
        <StatCard label="Completed" value={completedJobs} icon="✅" color="#10b981" />
        <StatCard label="In Progress" value={pendingJobs} icon="⏳" color="#f59e0b" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>Jobs per Day</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={jobsByDay}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="jobs" fill="#6366f1" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>Revenue per Day</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueByDay}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <Tooltip formatter={(v) => 'Rs.' + v.toFixed(2)} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

function getLast7Days(jobs) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const count = jobs.filter(j => j.created_at.slice(0, 10) === key).length;
    days.push({ day: label, jobs: count });
  }
  return days;
}

function getLast7DaysRevenue(jobs) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const revenue = jobs
      .filter(j => j.created_at.slice(0, 10) === key && ['paid','queued','printing','done'].includes(j.status))
      .reduce((sum, j) => sum + parseFloat(j.cost), 0);
    days.push({ day: label, revenue });
  }
  return days;
}
