import React, { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  Receipt,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";

const formatCurrency = (val) => {
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ProfitLossReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    totalSales: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalExpenses: 0,
    totalCommissions: 0,
    totalReturns: 0,
    netProfit: 0,
    salesCount: 0,
  });

  const [recentExpenses, setRecentExpenses] = useState([]);
  const [topReturnedProducts, setTopReturnedProducts] = useState([]);

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const db = await getDb();
      const params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];

      const salesRes = await db.select(
        `SELECT 
          COALESCE(SUM(total_after_discount), 0) as total_sales,
          COALESCE(SUM(commission_amount), 0) as total_commissions,
          COUNT(id) as sales_count
         FROM invoices 
         WHERE created_at >= ? AND created_at <= ? AND status = 'completed'`,
        params
      );
      const sales = salesRes[0] || { total_sales: 0, total_commissions: 0, sales_count: 0 };

      const cogsRes = await db.select(
        `SELECT 
          COALESCE(SUM(ii.quantity * ii.cost_price_at_sale), 0) as total_cogs
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE i.created_at >= ? AND i.created_at <= ? AND i.status = 'completed'`,
        params
      );
      const cogs = cogsRes[0]?.total_cogs || 0;

      const expensesRes = await db.select(
        `SELECT COALESCE(SUM(amount), 0) as total_expenses 
         FROM expenses 
         WHERE expense_date >= ? AND expense_date <= ?`,
        params
      );
      const expensesTotal = expensesRes[0]?.total_expenses || 0;

      const returnsRes = await db.select(
        `SELECT COALESCE(SUM(amount), 0) as total_returns 
         FROM returns 
         WHERE return_date >= ? AND return_date <= ?`,
        params
      );
      const returnsTotal = returnsRes[0]?.total_returns || 0;

      const grossProfit = sales.total_sales - cogs;
      const netProfit = grossProfit - (expensesTotal + sales.total_commissions) - returnsTotal;

      setReportData({
        totalSales: sales.total_sales,
        totalCogs: cogs,
        grossProfit: grossProfit,
        totalExpenses: expensesTotal,
        totalCommissions: sales.total_commissions,
        totalReturns: returnsTotal,
        netProfit: netProfit,
        salesCount: sales.sales_count,
      });

      const detailedExpenses = await db.select(
        `SELECT e.amount, e.note, e.expense_date, ec.name as cat_name
         FROM expenses e
         LEFT JOIN expense_categories ec ON e.category_id = ec.id
         WHERE e.expense_date >= ? AND e.expense_date <= ?
         ORDER BY e.expense_date DESC LIMIT 5`,
        params
      );
      setRecentExpenses(detailedExpenses || []);

      const topReturns = await db.select(
        `SELECT p.name, SUM(r.quantity) as return_qty, SUM(r.amount) as return_loss
         FROM returns r
         JOIN products p ON r.product_id = p.id
         WHERE r.return_date >= ? AND r.return_date <= ?
         GROUP BY p.id ORDER BY return_loss DESC LIMIT 5`,
        params
      );
      setTopReturnedProducts(topReturns || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

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
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .premium-stat-card {
          position: relative;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 20px;
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
        .card-blue .stat-glow { background: #3b82f6; }
        .card-emerald .stat-glow { background: #10b981; }
        .card-amber .stat-glow { background: #f59e0b; }
        .card-red .stat-glow { background: #ef4444; }
        .stat-content {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-emerald .icon-box { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .card-red .icon-box { color: #f87171; background: rgba(239,68,68,0.1); }
        .stat-details { flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }
        .stat-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
        
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
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .search-neon-wrapper { position: relative; }
        .search-neon-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 11px 42px 11px 16px;
          width: 280px;
          color: #f1f5f9;
          font-size: 13.5px;
          transition: all 0.25s ease;
        }
        .search-neon-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
          outline: none;
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
        .btn-secondary { background: #1e293b; color: #94a3b8; }
        .btn-secondary:hover { background: #334155; color: white; }
        
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
        
        .layout-bottom {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        .glass-box {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 24px;
        }
        .box-title {
          font-size: 16px;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 20px;
          padding-right: 12px;
          border-right: 3px solid #3b82f6;
        }
        .income-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          margin-bottom: 10px;
        }
        .divider {
          border-top: 1px dashed rgba(255,255,255,0.08);
          margin: 16px 0;
        }
        .total-block {
          display: flex;
          justify-content: space-between;
          padding: 16px 20px;
          border-radius: 12px;
          margin-top: 16px;
          font-weight: 700;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .text-success { color: #34d399; }
        .text-warning { color: #fbbf24; }
        .text-danger { color: #f87171; }
        .text-info { color: #60a5fa; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="icon-box" style={{ width: 48, height: 48, background: "rgba(59,130,246,0.15)" }}>
              <BarChart3 size={24} style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <h2 className="main-title">الأرباح والخسائر</h2>
              <p className="sub-title">التحليلات المادية ومراجعة صافي الأرباح والخسائر</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper" style={{ width: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0b0f19", padding: "6px 12px", borderRadius: "40px" }}>
              <Calendar size={14} />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="search-neon-input" style={{ width: "130px", padding: "6px 8px" }} />
              <span style={{ color: "#64748b" }}>←</span>
              <Calendar size={14} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="search-neon-input" style={{ width: "130px", padding: "6px 8px" }} />
            </div>
          </div>
          <button className="btn-action-neon btn-primary" onClick={fetchReport} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {loading ? "جاري التحديث..." : "تحديث البيانات"}
          </button>
        </div>
      </div>

      {/* Stats Cards (KPI) */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><ShoppingCart size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي الإيرادات المكتملة</div>
              <div className="stat-value">{formatCurrency(reportData.totalSales)} <span style={{ fontSize: "14px" }}>ج.م</span></div>
              <div className="stat-sub">عبر <strong>{reportData.salesCount}</strong> فاتورة مبيعات</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Package size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">تكلفة البضاعة المباعة (COGS)</div>
              <div className="stat-value" style={{ color: "#fbbf24" }}>{formatCurrency(reportData.totalCogs)} <span style={{ fontSize: "14px" }}>ج.م</span></div>
              <div className="stat-sub">مبني على سعر التكلفة الفعلي وقت البيع</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-red">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Receipt size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">التشغيل، المصاريف والعمولات</div>
              <div className="stat-value" style={{ color: "#f87171" }}>{formatCurrency(reportData.totalExpenses + reportData.totalCommissions)} <span style={{ fontSize: "14px" }}>ج.م</span></div>
              <div className="stat-sub">مصاريف: {formatCurrency(reportData.totalExpenses)} | عمولات: {formatCurrency(reportData.totalCommissions)}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card" style={{ borderColor: reportData.netProfit >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)" }}>
          <div className="stat-glow" style={{ background: reportData.netProfit >= 0 ? "#10b981" : "#ef4444" }}></div>
          <div className="stat-content">
            <div className="icon-box" style={{ background: reportData.netProfit >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: reportData.netProfit >= 0 ? "#34d399" : "#f87171" }}>
              <DollarSign size={24} />
            </div>
            <div className="stat-details">
              <div className="stat-label">صافي ربح الفترة النهائي</div>
              <div className="stat-value" style={{ color: reportData.netProfit >= 0 ? "#34d399" : "#f87171" }}>{formatCurrency(reportData.netProfit)} <span style={{ fontSize: "14px" }}>ج.م</span></div>
              <div className="stat-sub">القيمة الصافية بعد خصم كافة المصاريف</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Analysis Section */}
      <div className="layout-bottom">
        {/* Income Statement */}
        <div className="glass-box">
          <h3 className="box-title">كشف وقائمة حساب الدخل التفصيلية</h3>
          
          <div className="income-row">
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>إجمالي المبيعات (صافي الفواتير)</span>
            <span style={{ fontWeight: "700", color: "#f3f4f6" }}>+{formatCurrency(reportData.totalSales)} ج.م</span>
          </div>
          <div className="income-row">
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>يُخصم: تكلفة المشتريات المباعة (COGS)</span>
            <span style={{ fontWeight: "700", color: "#fbbf24" }}>-{formatCurrency(reportData.totalCogs)} ج.م</span>
          </div>

          <div className="divider"></div>

          <div className="income-row" style={{ background: "rgba(16,185,129,0.08)" }}>
            <span style={{ fontWeight: "600", fontSize: "14px" }}>مجمل الربح التجاري (Gross Profit)</span>
            <span style={{ fontWeight: "800", color: "#34d399" }}>{formatCurrency(reportData.grossProfit)} ج.م</span>
          </div>

          <div className="divider"></div>

          <div className="income-row">
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>يُخصم: المصروفات العامة والتشغيلية</span>
            <span style={{ fontWeight: "700", color: "#f87171" }}>-{formatCurrency(reportData.totalExpenses)} ج.م</span>
          </div>
          <div className="income-row">
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>يُخصم: مستحقات وعمولات البيع للموظفين</span>
            <span style={{ fontWeight: "700", color: "#f87171" }}>-{formatCurrency(reportData.totalCommissions)} ج.م</span>
          </div>
          <div className="income-row">
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>يُخصم: خسائر ومبالغ المرتجعات</span>
            <span style={{ fontWeight: "700", color: "#f87171" }}>-{formatCurrency(reportData.totalReturns)} ج.م</span>
          </div>

          <div className="total-block" style={{ background: reportData.netProfit >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${reportData.netProfit >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>
            <span style={{ fontSize: "16px" }}>صافي العائد والربح المالي النهائي</span>
            <span style={{ fontSize: "20px", color: reportData.netProfit >= 0 ? "#34d399" : "#f87171" }}>{formatCurrency(reportData.netProfit)} ج.م</span>
          </div>
        </div>

        {/* Side Tables */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Recent Expenses */}
          <div className="glass-box">
            <h3 className="box-title" style={{ borderRightColor: "#ef4444" }}>أحدث حركات مصروفات</h3>
            {recentExpenses.length === 0 ? (
              <div className="income-row" style={{ justifyContent: "center", color: "#64748b" }}>لا توجد حركات مصروفات مسجلة</div>
            ) : (
              recentExpenses.map((exp, idx) => (
                <div key={idx} className="income-row" style={{ padding: "10px 12px" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{exp.cat_name || "عام"}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>{exp.note || "بدون ملاحظة"}</div>
                  </div>
                  <span style={{ color: "#f87171", fontWeight: "700", fontSize: "13px" }}>{formatCurrency(exp.amount)} ج.م</span>
                </div>
              ))
            )}
          </div>

          {/* Top Returned Products */}
          <div className="glass-box">
            <h3 className="box-title" style={{ borderRightColor: "#f59e0b" }}>المرتجعات الأكثر خسارة</h3>
            {topReturnedProducts.length === 0 ? (
              <div className="income-row" style={{ justifyContent: "center", color: "#64748b" }}>لا توجد مرتجعات بالفترة الحالية</div>
            ) : (
              topReturnedProducts.map((prod, idx) => (
                <div key={idx} className="income-row" style={{ padding: "10px 12px" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{prod.name}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>الكمية: {prod.return_qty}</div>
                  </div>
                  <span style={{ color: "#f59e0b", fontWeight: "700", fontSize: "13px" }}>-{formatCurrency(prod.return_loss)} ج.م</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}