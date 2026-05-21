import React, { useEffect, useState } from 'react';
import { getDb } from "../lib/db";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Users, DollarSign, Package, ShoppingBag, RefreshCw, 
  ArrowUpRight, AlertTriangle, FileText, TrendingUp, Percent
} from 'lucide-react';

const StatsPage = ({ showToast }) => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalInvoices: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalExpenses: 0,
    cogs: 0,
    netProfit: 0,
    profitMargin: 0,
    debt: 0,
    alertProductsCount: 0,
    chartData: [],
    topProducts: [],
    recentInvoices: []
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      const salesRes = await db.select("SELECT SUM(total_after_discount) as total, COUNT(*) as count FROM invoices WHERE status='completed'");
      const prodCount = await db.select("SELECT COUNT(*) as count FROM products");
      const custCount = await db.select("SELECT COUNT(*) as count FROM customers");
      const expRes = await db.select("SELECT SUM(amount) as total FROM expenses");
      const cogsRes = await db.select("SELECT SUM(ii.quantity * ii.cost_price_at_sale) as total FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.status='completed'");
      const debtRes = await db.select("SELECT SUM(total_after_discount) as total FROM invoices WHERE status='pending' OR status='unpaid'");
      const alertProd = await db.select("SELECT COUNT(*) as count FROM products WHERE stock <= 5");

      const chartRes = await db.select(`
        SELECT strftime('%m/%d', created_at) as date, SUM(total_after_discount) as total 
        FROM invoices WHERE status='completed' GROUP BY date ORDER BY date DESC LIMIT 7
      `);

      const topProds = await db.select(`
        SELECT product_name as name, SUM(quantity) as qty, SUM(total_price) as total_val
        FROM invoice_items GROUP BY product_name ORDER BY qty DESC LIMIT 5
      `);

      const recentInv = await db.select(`
        SELECT id, total_after_discount as total, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 2
      `);

      const totalSales = salesRes[0]?.total || 0;
      const totalExpenses = expRes[0]?.total || 0;
      const totalCogs = cogsRes[0]?.total || 0;
      const netProfit = totalSales - totalCogs - totalExpenses;
      const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

      setStats({
        totalSales,
        totalInvoices: salesRes[0]?.count || 0,
        totalProducts: prodCount[0]?.count || 0,
        totalCustomers: custCount[0]?.count || 0,
        totalExpenses,
        cogs: totalCogs,
        netProfit,
        profitMargin,
        debt: debtRes[0]?.total || 0,
        alertProductsCount: alertProd[0]?.count || 0,
        chartData: chartRes.reverse(),
        topProducts: topProds,
        recentInvoices: recentInv
      });
    } catch (error) {
      console.error(error);
      if(showToast) showToast("فشل تحديث بيانات لوحة التحكم", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const formatCurrency = (val) => {
    return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        /* ========== GLASS/CYBER THEME (consistent with all pages) ========== */
        .page-container {
          padding: 24px;
          background: transparent;
          min-height: 100vh;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .premium-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .premium-stat-card {
          position: relative;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 18px 20px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-stat-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 12px 24px -10px rgba(0,0,0,0.6);
        }
        .stat-glow {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          top: -20px;
          right: -20px;
          filter: blur(40px);
          opacity: 0.15;
          transition: opacity 0.3s ease;
        }
        .premium-stat-card:hover .stat-glow { opacity: 0.3; }
        .card-indigo .stat-glow { background: #6366f1; }
        .card-emerald .stat-glow { background: #10b981; }
        .card-amber .stat-glow { background: #f59e0b; }
        .card-red .stat-glow { background: #ef4444; }
        .card-cyan .stat-glow { background: #06b6d4; }
        .card-pink .stat-glow { background: #ec4899; }
        .stat-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          z-index: 1;
        }
        .stat-left { flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
        .stat-value { font-size: 22px; font-weight: 700; color: #f8fafc; }
        .stat-unit { font-size: 12px; color: #64748b; margin-right: 4px; }
        .stat-info { font-size: 11px; color: #64748b; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; }
        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-indigo .stat-icon { color: #818cf8; background: rgba(99,102,241,0.1); }
        .card-emerald .stat-icon { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-amber .stat-icon { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .card-red .stat-icon { color: #f87171; background: rgba(239,68,68,0.1); }
        .card-cyan .stat-icon { color: #22d3ee; background: rgba(6,182,212,0.1); }
        .card-pink .stat-icon { color: #f472b6; background: rgba(236,72,153,0.1); }
        
        .page-header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding: 20px 28px;
          background: rgba(30, 41, 59, 0.3);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(8px);
        }
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .live-badge {
          background: rgba(16,185,129,0.1);
          color: #10b981;
          border: 1px solid rgba(16,185,129,0.2);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }
        .btn-action-neon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .btn-primary { background: #2563eb; color: #ffffff; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .cyber-table-container {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .cyber-table {
          width: 100%;
          border-collapse: collapse;
          text-align: right;
        }
        .cyber-table th {
          background: rgba(15, 23, 42, 0.8);
          padding: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
        }
        .cyber-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .cyber-row-main:hover { background: rgba(30, 41, 59, 0.3); }
        .glass-card {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
        }
        .glass-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .glass-card-title {
          font-size: 15px;
          font-weight: 700;
          color: #f1f5f9;
        }
        .alert-card {
          background: linear-gradient(135deg, rgba(239,68,68,0.05) 0%, rgba(0,0,0,0.2) 100%);
          border-left: 3px solid #ef4444;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .main-layout {
          display: grid;
          grid-template-columns: 2.2fr 1fr;
          gap: 24px;
        }
        .left-column { display: flex; flex-direction: column; gap: 24px; }
        .right-column { display: flex; flex-direction: column; gap: 24px; }
        @media (max-width: 1024px) {
          .main-layout { grid-template-columns: 1fr; }
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          margin-bottom: 10px;
        }
        .rank-badge {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
        }
        .rank-1 { background: #fbbf24; color: #000; }
        .rank-2 { background: #94a3b8; color: #000; }
        .rank-other { background: #1e293b; color: #64748b; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="live-badge"><span style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%" }}></span> مباشر ومحدث</div>
            <div>
              <h2 className="main-title">لوحة التحكم الإستراتيجية</h2>
              <p className="sub-title">نظرة شاملة ومتقدمة على تدفقات الحسابات، الأرباح، والعمليات الحالية</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <button className="btn-action-neon btn-primary" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            تحديث ذكي
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-indigo">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المبيعات</div>
              <div className="stat-value">{formatCurrency(stats.totalSales)} <span className="stat-unit">ج.م</span></div>
              <div className="stat-info">عبر {stats.totalInvoices} فاتورة</div>
            </div>
            <div className="stat-icon"><ShoppingBag size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">صافي الأرباح</div>
              <div className="stat-value">{formatCurrency(stats.netProfit)} <span className="stat-unit">ج.م</span></div>
              <div className="stat-info">هامش الربح: {stats.profitMargin.toFixed(1)}%</div>
            </div>
            <div className="stat-icon"><TrendingUp size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">تكلفة المشتريات (COGS)</div>
              <div className="stat-value">{formatCurrency(stats.cogs)} <span className="stat-unit">ج.م</span></div>
              <div className="stat-info">تكلفة السلع المباعة</div>
            </div>
            <div className="stat-icon"><DollarSign size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-red">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">المصروفات العامة</div>
              <div className="stat-value">{formatCurrency(stats.totalExpenses)} <span className="stat-unit">ج.م</span></div>
              <div className="stat-info">المستندات والصادرات</div>
            </div>
            <div className="stat-icon"><Percent size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-cyan">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">قيمة المخزون الكلي</div>
              <div className="stat-value">{stats.totalProducts} <span className="stat-unit">صنف</span></div>
              <div className="stat-info">السلع النشطة بالمستودع</div>
            </div>
            <div className="stat-icon"><Package size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-pink">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">ديون العملاء المعلقة</div>
              <div className="stat-value">{formatCurrency(stats.debt)} <span className="stat-unit">ج.م</span></div>
              <div className="stat-info">مبالغ الفواتير غير المدفوعة</div>
            </div>
            <div className="stat-icon"><Users size={20} /></div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left Column */}
        <div className="left-column">
          {/* Chart Card */}
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">تحليل منحنى المبيعات والسيولة الأسبوعية</h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>آخر 7 حركات تجميعية يومية</span>
            </div>
            <div style={{ height: 300 }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b" }}>جاري مزامنة قواعد البيانات...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="glowSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: 10, border: '1px solid #1e293b', color: '#fff', fontSize: 12 }} />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#glowSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Invoices Card */}
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">سجل الفواتير والعمليات الأخيرة</h3>
              <button style={{ background: "transparent", color: "#60a5fa", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>عرض الكل</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.recentInvoices.map((inv, index) => (
                <div key={index} className="item-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", padding: 8, borderRadius: 8 }}><FileText size={16} /></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{inv.id}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>التاريخ: {inv.created_at?.split(' ')[0]}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{formatCurrency(inv.total)} ج.م</span>
                    <span style={{
                      fontSize: 11, padding: "4px 8px", borderRadius: 6, fontWeight: 700,
                      background: inv.status === 'completed' ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: inv.status === 'completed' ? "#10b981" : "#f87171"
                    }}>
                      {inv.status === 'completed' ? 'مدفوع كامل' : 'آجل متبقي'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="right-column">
          {/* Alert Card */}
          <div className="glass-card alert-card" style={{ borderLeft: "3px solid #ef4444" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={20} color="#f87171" />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>تنبيه وإدارة النواقص</h4>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#f87171" }}>{stats.alertProductsCount}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>منتجات قاربت على النفاد وتطلب رصيداً</span>
            </div>
          </div>

          {/* Top Products Card */}
          <div className="glass-card">
            <h3 className="glass-card-title" style={{ marginBottom: 18 }}>الأصناف الأكثر طلباً ومبيعاً</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stats.topProducts.map((prod, idx) => (
                <div key={idx} className="item-row" style={{ border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", borderRadius: 0, padding: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : 'rank-other'}`}>{idx + 1}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{prod.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>تم بيع {prod.qty} وحدة</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>{formatCurrency(prod.total_val)} ج.م</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;