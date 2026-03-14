// src/pages/Reports.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { useFetch } from '../hooks/useApi';
import { getTransactions, getReports } from '../utils/api';
import { fmt, fmtDate } from '../utils/format';

export default function Reports() {
  const [generating, setGenerating] = useState(null);

  const { data: recentTxs, loading } = useFetch(
    () => getTransactions({ limit: 6 }),
    [],
  );

  const generate = async (range) => {
    setGenerating(range);
    try {
      const { data } = await getReports(range);
      printReport(range, data);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally { setGenerating(null); }
  };

  const printReport = (range, data) => {
    const rows = data.transactions.map(t =>
      `<tr>
        <td>${t.id}</td>
        <td>${fmtDate(t.createdAt)}</td>
        <td>${t.items.length}</td>
        <td>USh ${t.total.toLocaleString()}</td>
        <td>${t.payment}</td>
        <td>${t.type}</td>
      </tr>`
    ).join('');

    const topRows = data.topProducts.map(p =>
      `<tr><td>${p.name}</td><td>${p.qty}</td><td>USh ${p.revenue.toLocaleString()}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html><head><title>NexusPOS ${range} Report</title>
<style>
  body { font-family: sans-serif; padding: 30px; color: #111; }
  h1 { color: #16a34a; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
  .stat-val { font-size: 22px; font-weight: 700; }
  .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 12px; }
  td { border-top: 1px solid #e2e8f0; padding: 9px 10px; font-size: 13px; }
  h2 { margin-top: 28px; font-size: 16px; }
</style></head>
<body>
  <h1>NexusPOS — ${range.charAt(0).toUpperCase() + range.slice(1)} Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Period from: ${new Date(data.from).toLocaleDateString()}</p>
  <div class="summary">
    <div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-val">USh ${data.summary.totalRevenue.toLocaleString()}</div></div>
    <div class="stat"><div class="stat-label">Transactions</div><div class="stat-val">${data.summary.totalTransactions}</div></div>
    <div class="stat"><div class="stat-label">Avg Order Value</div><div class="stat-val">USh ${data.summary.avgOrderValue.toLocaleString()}</div></div>
  </div>
  ${topRows ? `<h2>Top Products</h2><table><thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead><tbody>${topRows}</tbody></table>` : ''}
  <h2>All Transactions (${data.transactions.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Type</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Icon name="chart" color="var(--primary)" size={22} />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Reports</h1>
      </div>
      <p className="page-sub">Generate and preview sales reports.</p>

      <div className="report-layout">
        {/* Generate buttons */}
        <div className="card">
          <h2 className="card-title">Generate Reports</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Create and preview daily, weekly, and yearly sales reports as PDF.
          </p>
          {[['daily', 'Daily Report'], ['weekly', 'Weekly Report'], ['yearly', 'Yearly Report']].map(([r, label]) => (
            <button
              key={r}
              className="btn btn-primary btn-full"
              style={{ marginBottom: 10 }}
              onClick={() => generate(r)}
              disabled={!!generating}
            >
              <Icon name="print" size={14} />
              {generating === r ? 'Generating…' : label}
            </button>
          ))}
        </div>

        {/* Recent transactions preview */}
        <div className="card">
          <h2 className="card-title">Last Transactions</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>A quick view of recent transactions used to build reports.</p>
          {loading ? <Spinner /> : (
            <table>
              <thead><tr>{['Type', 'ID', 'Date', 'Total'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {(recentTxs || []).map(t => (
                  <tr key={t.id}>
                    <td><span className="badge badge-green">{t.type}</span></td>
                    <td>{t.id}</td>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                    <td>${t.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
