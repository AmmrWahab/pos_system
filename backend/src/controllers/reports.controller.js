// src/controllers/reports.controller.js
export const getReports = async (req, res, next) => {
  try {
    const db = req.db;
    const range = req.params.range || 'daily';
    const now = new Date();
    let start, groupFn;

    // ── Determine range & grouping function ───────────────
    if (range === 'daily') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0,0,0,0);
      groupFn = (d) => d.toISOString().slice(0,10);
    } else if (range === 'weekly') {
      start = new Date(now);
      start.setDate(now.getDate() - 27);
      start.setHours(0,0,0,0);
      groupFn = (d) => {
        const w = new Date(d);
        w.setDate(w.getDate() - w.getDay()); // start of week
        return w.toISOString().slice(0,10);
      };
    } else { // monthly
      start = new Date(now.getFullYear(), 0, 1);
      groupFn = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }

    // ── Fetch transactions including items ───────────────
    const transactions = await db.collection('transactions')
      .find({ createdAt: { $gte: start } })
      .sort({ createdAt: 1 })
      .toArray();

    // ── Build buckets ────────────────────────────────────
    const buckets = {};
    for (const tx of transactions) {
      const key = groupFn(tx.createdAt);
      if (!buckets[key]) buckets[key] = { label: key, revenue: 0, orders: 0, items: 0 };
      buckets[key].revenue += tx.total || 0;
      buckets[key].orders  += 1;
      buckets[key].items   += (tx.items || []).reduce((s,i) => s + (i.qty || 0), 0);
    }

    const totalRevenue = transactions.reduce((s,t) => s + (t.total || 0), 0);
    const totalOrders  = transactions.length;

    res.json({
      range,
      data: Object.values(buckets),
      totalRevenue,
      totalOrders
    });
  } catch (e) { next(e); }
};
