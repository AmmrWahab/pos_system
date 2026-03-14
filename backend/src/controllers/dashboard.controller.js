// src/controllers/dashboard.controller.js - PROFILE-SCOPED FINAL VERSION ✅
import { ObjectId } from 'mongodb';

// ── Helper: Get accessible branchIds for a profile ─────────────
const getAccessibleBranchIds = async (db, profileId) => {
  if (!profileId) return ['default'];
  
  try {
    const profile = await db.collection('profiles').findOne({ _id: profileId });
    if (!profile) return ['default'];
    
    const branchIds = [profile.branchId].filter(Boolean);
    
    if (profile.linkedTo) {
      const linked = await db.collection('profiles').findOne({ _id: profile.linkedTo });
      if (linked?.branchId && !branchIds.includes(linked.branchId)) {
        branchIds.push(linked.branchId);
      }
    }
    
    return branchIds.length > 0 ? branchIds : ['default'];
  } catch (err) {
    console.warn('⚠️ getAccessibleBranchIds error:', err.message);
    return ['default'];
  }
};

// ── Main Dashboard Stats Controller ───────────────────────────
export const getDashboardStats = async (req, res, next) => {
  try {
    const db = req.db;
    const profileId = req.headers['x-profile-id']; // ✅ Get active profile from header
    const now = new Date();
    
    // ✅ Get accessible branchIds (own + linked)
    const accessibleBranchIds = await getAccessibleBranchIds(db, profileId);
    console.log('📊 Dashboard for profile:', profileId, '→ branches:', accessibleBranchIds);

    // ── Dates ──────────────────────────────
    const startOf30Days = new Date(now); startOf30Days.setDate(now.getDate()-29); startOf30Days.setHours(0,0,0,0);
    const startOf7Days  = new Date(now); startOf7Days.setDate(now.getDate()-6); startOf7Days.setHours(0,0,0,0);
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59);

    // ── Collections ───────────────────────
    const transactions = db.collection('transactions');
    const products     = db.collection('products');

    // ── Aggregations ─────────────────────
    // ✅ ALL queries now include branchId filter
    const [
      totalSalesAgg,
      totalTransactions,
      totalProducts,
      recentTransactions,
      monthlySalesAgg,
      lastMonthSalesAgg,
      last30Transactions,
      paymentBreakdownAgg,
      topProductsAgg,
      lowStockProducts
    ] = await Promise.all([
      
      // ✅ 1. Total sales - FILTERED BY BRANCH
      transactions.aggregate([
        { $match: { branchId: { $in: accessibleBranchIds } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]).toArray(),
      
      // ✅ 2. Total transactions - FILTERED BY BRANCH
      transactions.countDocuments({ branchId: { $in: accessibleBranchIds } }),

      // ✅ 3. Total products - FILTERED BY BRANCH
      products.countDocuments({ branchId: { $in: accessibleBranchIds } }),

      // ✅ 4. Recent 8 transactions - FILTERED BY BRANCH
      transactions.find({ branchId: { $in: accessibleBranchIds } })
        .sort({ createdAt: -1 }).limit(8).toArray(),

      // ✅ 5. This month sales - FILTERED BY BRANCH + DATE
      transactions.aggregate([
        { $match: { 
            branchId: { $in: accessibleBranchIds },
            createdAt: { $gte: startOfMonth } 
          } 
        },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }
      ]).toArray(),

      // ✅ 6. Last month sales - FILTERED BY BRANCH + DATE
      transactions.aggregate([
        { $match: { 
            branchId: { $in: accessibleBranchIds },
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } 
          } 
        },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }
      ]).toArray(),

      // ✅ 7. Last 30 days transactions - FILTERED BY BRANCH + DATE
      transactions.find({ 
        branchId: { $in: accessibleBranchIds },
        createdAt: { $gte: startOf30Days } 
      }).sort({ createdAt: 1 }).toArray(),

      // ✅ 8. Payment breakdown - FILTERED BY BRANCH
      transactions.aggregate([
        { $match: { branchId: { $in: accessibleBranchIds } } },
        { $group: { _id: "$payment", total: { $sum: "$total" }, count: { $sum: 1 } } }
      ]).toArray(),

      // ✅ 9. Top 6 products by qty sold - FILTERED BY BRANCH + $unwind items
      transactions.aggregate([
        { $match: { branchId: { $in: accessibleBranchIds } } },  // ← Filter FIRST for performance
        { $unwind: "$items" },                                    // ← Deconstruct embedded items array
        { $group: { 
            _id: "$items.name",                                   // ← Group by product name
            qtySold: { $sum: "$items.qty" }, 
            revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
            productId: { $first: "$items.productId" }             // ← Keep productId for frontend
          } 
        },
        { $sort: { qtySold: -1 } },  // ← Most sold first
        { $limit: 6 }                // ← Top 6 only
      ]).toArray(),

      // ✅ 10. Low stock products - FILTERED BY BRANCH
      products.find({ 
        branchId: { $in: accessibleBranchIds },
        stock: { $lte: 10 } 
      }).sort({ stock: 1 }).limit(5).toArray(),
    ]);

    // ── Process Results ─────────────────────
    const totalSales = totalSalesAgg[0]?.total || 0;
    const avgOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // ── Daily Revenue Map (last 30 days) ─────────────
    const dailyMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(startOf30Days); d.setDate(d.getDate()+i);
      const key = d.toISOString().slice(0,10);
      dailyMap[key] = { date: key, revenue: 0, orders: 0 };
    }
    // ✅ Only count transactions from accessible branches (already filtered in query)
    for (const tx of last30Transactions) {
      const key = tx.createdAt.toISOString().slice(0,10);
      if (dailyMap[key]) { 
        dailyMap[key].revenue += tx.total; 
        dailyMap[key].orders += 1; 
      }
    }

    // ── Weekly Revenue Map (last 7 days) ─────────────
    const weeklyMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOf7Days); d.setDate(d.getDate()+i);
      const key = d.toISOString().slice(0,10);
      weeklyMap[key] = { date: key, revenue: 0, orders: 0 };
    }
    for (const tx of last30Transactions) {
      const key = tx.createdAt.toISOString().slice(0,10);
      if (weeklyMap[key]) { 
        weeklyMap[key].revenue += tx.total; 
        weeklyMap[key].orders += 1; 
      }
    }

    // ── Month-over-month growth ─────────────
    const thisMonthTotal = monthlySalesAgg[0]?.total || 0;
    const lastMonthTotal = lastMonthSalesAgg[0]?.total || 0;
    const revenueGrowth  = lastMonthTotal > 0 
      ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) 
      : null;

    // ── Send Response ─────────────────────
    res.json({
      totalSales,
      totalTransactions,
      totalProducts,
      avgOrderValue: Math.round(avgOrderValue),
      thisMonthTotal,
      lastMonthTotal,
      revenueGrowth: parseFloat(revenueGrowth),
      thisMonthOrders: monthlySalesAgg[0]?.count || 0,
      lastMonthOrders: lastMonthSalesAgg[0]?.count || 0,
      recentTransactions,
      dailyRevenue: Object.values(dailyMap),
      weeklyRevenue: Object.values(weeklyMap),
      paymentBreakdown: paymentBreakdownAgg.map(p => ({ 
        method: p._id, 
        total: p.total || 0, 
        count: p.count 
      })),
      // ✅ Top products with proper structure
      topProducts: topProductsAgg.map(p => ({ 
        name: p._id, 
        qtySold: p.qtySold || 0, 
        revenue: p.revenue || 0,
        productId: p.productId  // For frontend linking to product page
      })),
      lowStock: lowStockProducts,
      // ✅ Include profile context for frontend debugging/display
      profileInfo: {
        id: profileId,
        accessibleBranches: accessibleBranchIds
      }
    });

  } catch (e) { 
    console.error('❌ getDashboardStats error:', e);
    next(e); 
  }
};