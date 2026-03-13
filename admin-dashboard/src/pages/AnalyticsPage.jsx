import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/client';

const PERIODS = [
  { label: '7d',  days: 7  },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

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
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${color}20`, filter: 'blur(20px)' }} />
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
  const [days, setDays] = useState(30);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-analytics', days],
    queryFn: () => api.get(`/api/admin/analytics?days=${days}`).then(r => r.data),
    refetchInterval: 60000,
  });

  const isLoading = statsLoading || analyticsLoading;
  const stats     = statsData?.stats     || {};
  const daily     = analyticsData?.daily || [];
  const breakdown = analyticsData?.breakdown || {};
  const printers  = analyticsData?.printers  || [];

  // Format daily data for charts
  const chartData = daily.map(d => ({
    label:   new Date(d.day).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    Jobs:    parseInt(d.done_jobs),
    Revenue: parseFloat(parseFloat(d.revenue).toFixed(0)),
  }));

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(238,238,245,0.3)', fontSize: 14 }}>
      Loading analytics…
    </div>
  );

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>Analytics</div>
          <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.4)', marginTop: 6 }}>Revenue and job performance overview</div>
        </div>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setDays(p.days)} style={{
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              background: days === p.days ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
              color: days === p.days ? '#a78bfa' : 'rgba(238,238,245,0.4)',
              border: days === p.days ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.07)',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Stat cards — from /api/admin/stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard icon="💰" label="Total Revenue"   value={`₹${parseFloat(stats.total_revenue || 0).toFixed(0)}`} color="#34d399" sub={`₹${parseFloat(stats.revenue_today || 0).toFixed(0)} today`} />
        <StatCard icon="🖨️" label="Jobs Completed"  value={stats.completed_jobs || 0}  color="#a78bfa" sub={`${stats.jobs_today || 0} today`} />
        <StatCard icon="🔄" label="Active Jobs"      value={stats.active_jobs    || 0}  color="#60a5fa" sub="In progress" />
        <StatCard icon="🖨️" label="Printers Online"  value={`${stats.online_printers || 0}/${stats.total_printers || 0}`} color="#fb923c" sub="Online now" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20, color: '#eeeef5' }}>Jobs Completed — Last {days} Days</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Jobs" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20, color: '#eeeef5' }}>Revenue ₹ — Last {days} Days</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'rgba(238,238,245,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Revenue" stroke="#34d399" strokeWidth={2.5} dot={{ fill: '#34d399', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Job type breakdown + top printers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Breakdown */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: '#eeeef5' }}>Job Breakdown</div>
          {[
            { label: 'Color Jobs',       value: breakdown.color_jobs    || 0, color: '#60a5fa' },
            { label: 'B&W Jobs',         value: breakdown.bw_jobs       || 0, color: '#94a3b8' },
            { label: 'Double Sided',     value: breakdown.double_sided_jobs || 0, color: '#a78bfa' },
            { label: 'Priority Jobs',    value: breakdown.priority_jobs || 0, color: '#f59e0b' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'rgba(238,238,245,0.6)' }}>{item.label}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Top printers */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: '#eeeef5' }}>Top Printers</div>
          {printers.length === 0 ? (
            <div style={{ color: 'rgba(238,238,245,0.3)', fontSize: 13 }}>No data yet</div>
          ) : printers.slice(0, 5).map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(238,238,245,0.35)' }}>{p.location}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#a78bfa' }}>{p.jobs_done}</div>
                <div style={{ fontSize: 11, color: '#34d399' }}>₹{parseFloat(p.revenue).toFixed(0)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}