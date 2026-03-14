// src/pages/Dashboard.jsx
import toast from 'react-hot-toast';  // ✅ Add this
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { getDashboardStats } from '../utils/api';
import { fmt, fmtDate } from '../utils/format';


/* ── colour palette ─────────────────────────────────────────────────────── */
const C = {
  green:  '#16a34a',
  greenL: '#dcfce7',
  blue:   '#3b82f6',
  blueL:  '#dbeafe',
  yellow: '#f59e0b',
  yellowL:'#fef9c3',
  pink:   '#ec4899',
  pinkL:  '#fce7f3',
  purple: '#8b5cf6',
  red:    '#ef4444',
  muted:  '#64748b',
  border: '#e2e8f0',
};

const PIE_COLORS = [C.green, C.blue, C.purple, C.yellow, C.pink];


/* ── helpers ─────────────────────────────────────────────────────────────── */
const shortDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtAxis = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
};

/* ── Custom tooltip ──────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? fmt(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, iconBg, iconColor, growth, growthLabel, prefix }) {
  const positive = parseFloat(growth) >= 0;
  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1 }}>
        <p className="stat-label">{label}</p>
        <p className="stat-val">{prefix}{value}</p>
        {growth !== undefined && growth !== null && (
          <p style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: positive ? C.green : C.red, fontWeight: 600 }}>
            <span style={{ fontSize: 14 }}>{positive ? '↑' : '↓'}</span>
            {Math.abs(growth)}% {growthLabel || 'vs last month'}
          </p>
        )}
        {!growth && <p className="stat-sub">{sub}</p>}
      </div>
      <div className="stat-icon" style={{ background: iconBg }}>
        <Icon name={icon} color={iconColor} size={18} />
      </div>
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function ChartCard({ title, subtitle, children, style, action }) {
  return (
    <div className="card" style={{ padding: '22px 24px', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ══ DASHBOARD ══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState('30'); // '7' | '30'
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
  const loadStats = async () => {
    try {
      const r = await getDashboardStats();
      setStats(r.data);
      setIsOffline(false);
    } catch (error) {
      console.warn('Dashboard stats failed:', error);
      // ✅ Set empty stats instead of null
      setStats({
        totalSales: 0,
        thisMonthTotal: 0,
        thisMonthOrders: 0,
        totalTransactions: 0,
        avgOrderValue: 0,
        revenueGrowth: 0,
        dailyRevenue: [],
        weeklyRevenue: [],
        paymentBreakdown: [],
        topProducts: [],
        recentTransactions: [],
        lowStock: [],
        lastMonthTotal: 0,
        lastMonthOrders: 0,
      });
      setIsOffline(true);
      toast.error('Dashboard data unavailable (offline)', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };
  
  loadStats();
  
  // ✅ Listen for online/offline events
  const handleOnline = () => {
    setIsOffline(false);
    loadStats();
  };
  const handleOffline = () => setIsOffline(true);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

  if (loading) return <Spinner />;
  if (!stats)  return <p style={{ color: C.red }}>Failed to load stats.</p>;

  const revenueData = range === '7' ? (stats.weeklyRevenue || []) : (stats.dailyRevenue || []);

const pieData = (stats.paymentBreakdown || []).map(p => ({
  name: p.method || 'Unknown',
  value: p.total || 0,
  count: p.count || 0,
}));

const barData = (stats.topProducts || []).map(p => ({
  name: p.name ? (p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name) : 'Unknown',
  'Units Sold': p.qtySold || 0,
  Revenue: p.revenue || 0,
}));


  return (
    <div style={{ paddingBottom: 32 }}>

      {/* Header */}
<div style={{ marginBottom: 28 }}>
  <h1 className="page-title">Dashboard</h1>
  <p className="page-sub">Welcome back! Here's what's happening in your store.</p>
</div>

{/* ✅ Add This Offline Banner */}
{isOffline && (
  <div style={{
    background: '#fef9c3',
    border: '1px solid #f59e0b',
    borderRadius: 8,
    padding: '10px 16px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#b45309',
    fontSize: 13,
    fontWeight: 600
  }}>
    <span>📦</span>
    <span>Offline Mode - Showing cached data</span>
    <button 
      onClick={() => window.location.reload()}
      style={{
        marginLeft: 'auto',
        padding: '4px 12px',
        borderRadius: 6,
        border: '1px solid #b45309',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600
      }}
    >
      Retry
    </button>
  </div>
)}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Total Revenue"
          value={fmt(stats.totalSales)}
          icon="dollar" iconBg={C.greenL} iconColor={C.green}
          growth={stats.revenueGrowth}
        />
        <StatCard
          label="This Month"
          value={fmt(stats.thisMonthTotal)}
          sub={`${stats.thisMonthOrders} orders`}
          icon="trend" iconBg={C.blueL} iconColor={C.blue}
        />
        <StatCard
          label="Transactions"
          value={stats.totalTransactions}
          sub="Total orders processed"
          icon="card" iconBg={C.yellowL} iconColor={C.yellow}
        />
        <StatCard
          label="Avg. Order Value"
          value={fmt(stats.avgOrderValue)}
          sub="Per transaction"
          icon="chart" iconBg={C.pinkL} iconColor={C.pink}
        />
      </div>

      {/* ── Revenue area chart ─────────────────────────────────────────────── */}
      <ChartCard
        title="Revenue Over Time"
        subtitle={range === '7' ? 'Last 7 days' : 'Last 30 days'}
        style={{ marginBottom: 24 }}
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            {[['7', '7 Days'], ['30', '30 Days']].map(([v, l]) => (
              <button key={v} onClick={() => setRange(v)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: '1.5px solid', fontFamily: 'inherit', cursor: 'pointer',
                borderColor: range === v ? C.green : C.border,
                background: range === v ? C.greenL : '#fff',
                color: range === v ? C.green : C.muted,
              }}>{l}</button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.green} stopOpacity={0.15} />
                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.blue} stopOpacity={0.12} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} interval={range === '7' ? 0 : 4} />
            <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.green} strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: C.green }} />
            <Area type="monotone" dataKey="orders"  name="Orders"  stroke={C.blue}  strokeWidth={2}   fill="url(#ordersGrad)"   dot={false} activeDot={{ r: 4, fill: C.blue  }} yAxisId={0} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Middle row: Top Products bar + Payment pie ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Top Products */}
        <ChartCard title="Top Selling Products" subtitle="By units sold">
          {barData.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 13 }}>No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={true} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="Units Sold" fill={C.green}  radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Payment breakdown */}
        <ChartCard title="Payment Methods" subtitle="Revenue by method">
          {pieData.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 13 }}>No payment data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {pieData.map((p, i) => {
                  const pct = stats.paymentBreakdown.reduce((s, x) => s + x.total, 0);
                  const share = pct > 0 ? ((p.value / pct) * 100).toFixed(0) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block' }} />
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>{p.name}</span>
                        <span style={{ color: C.muted }}>({p.count} orders)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{fmt(p.value)}</span>
                        <span style={{ background: '#f1f5f9', borderRadius: 6, padding: '1px 7px', color: C.muted, fontSize: 11 }}>{share}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── Bottom row: Recent transactions + Low stock ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>

        {/* Recent transactions */}
        <ChartCard title="Recent Transactions" subtitle="Latest 8 orders">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                {['ID', 'Date', 'Total', 'Payment'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.muted, padding: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stats.recentTransactions || []).map((t, i) => (
                <tr key={String(t._id || i)} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 0', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: C.muted }}>
                    {t._id 
  ? (typeof t._id === 'string' ? t._id.slice(-8) : String(t._id).slice(-8))
  : '--------'
}
                  </td>
                  <td style={{ padding: '10px 0', fontSize: 12, color: C.muted }}>
                    {t.createdAt ? fmtDate(t.createdAt) : '-'}
                  </td>
                  <td style={{ padding: '10px 0', fontWeight: 700, fontSize: 13 }}>
                    {t.total !== undefined ? fmt(t.total) : '-'}
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: t.payment === 'Cash' ? C.greenL : t.payment === 'Card' ? C.blueL : C.yellowL,
                      color: t.payment === 'Cash' ? C.green : t.payment === 'Card' ? C.blue : C.yellow,
                    }}>
                      {t.payment || '-'}
                    </span>
                  </td>
                </tr>
              ))}


              {!stats.recentTransactions.length && (
                <tr><td colSpan={4} style={{ padding: '30px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </ChartCard>

        {/* Low stock alert */}
        <ChartCard title="Low Stock Alert" subtitle="Products with ≤ 10 units">
          {stats.lowStock.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 0', color: C.green, gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✓</div>
              <p style={{ fontWeight: 600, fontSize: 13 }}>All products well stocked</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.lowStock.map((p, i) => {
                const pct = Math.min(100, (p.stock / 10) * 100);
                const color = p.stock <= 3 ? C.red : p.stock <= 6 ? C.yellow : C.green;
                return (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.name}</span>
                      <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{p.stock} left</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 10, transition: 'width .3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monthly comparison mini-stat */}
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Month Comparison</p>
            <div style={{ display: 'flex', gap: 14 }}>
              {[
                { label: 'This Month', val: fmt(stats.thisMonthTotal), sub: `${stats.thisMonthOrders} orders`, color: C.green, bg: C.greenL },
                { label: 'Last Month', val: fmt(stats.lastMonthTotal), sub: `${stats.lastMonthOrders} orders`, color: C.blue,  bg: C.blueL  },
              ].map(m => (
                <div key={m.label} style={{ flex: 1, background: m.bg, borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 10, color: m.color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{m.label}</p>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{m.val}</p>
                  <p style={{ fontSize: 11, color: C.muted }}>{m.sub}</p>
                </div>
              ))}
            </div>
            {stats.revenueGrowth !== null && (
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, fontWeight: 600, color: stats.revenueGrowth >= 0 ? C.green : C.red }}>
                {stats.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.revenueGrowth)}% revenue vs last month
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
