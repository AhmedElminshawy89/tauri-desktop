// src/pages/ComprehensiveReportPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  Truck,
  RotateCcw,
  RefreshCw,
  Loader2,
  Eye,
  X,
  Users,
  Clock,
  FileText,
  HandCoins,
  Percent,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const fmtCurrency = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const MonthlyReportsPage = ({ showToast }) => {
  const [reportType, setReportType] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    summary: {
      sales: 0,
      invoicesCount: 0,
      purchases: 0,
      purchasesCount: 0,
      expenses: 0,
      returns: 0,
      profit: 0,
      margin: 0,
      attendance: 0,
    },
    details: {
      sales: [],
      purchases: [],
      expenses: [],
      returns: [],
      products: [],
      employees: [],
    },
    charts: {
      dailySales: [],
      categorySales: [],
    },
  });
  const [detailsModal, setDetailsModal] = useState({ open: false, type: "", title: "", data: [] });
  const [expandedSections, setExpandedSections] = useState({
    sales: true,
    purchases: false,
    expenses: false,
    returns: false,
  });

  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  const fetchReport = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      let start, end;
      if (reportType === "monthly") {
        start = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        end = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${lastDay}`;
      } else {
        start = startDate;
        end = endDate;
      }

      // 1. المبيعات
      const salesRes = await db.select(
        `SELECT SUM(total_after_discount) as total, COUNT(*) as count
         FROM invoices
         WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
         AND status = 'completed'`,
        [start, end]
      );
      const totalSales = salesRes[0]?.total || 0;
      const invoicesCount = salesRes[0]?.count || 0;

      // 2. المشتريات
      const purchasesRes = await db.select(
        `SELECT SUM(total_amount) as total, COUNT(*) as count
         FROM purchase_orders
         WHERE date(purchase_date) >= date(?) AND date(purchase_date) <= date(?)`,
        [start, end]
      );
      const totalPurchases = purchasesRes[0]?.total || 0;
      const purchasesCount = purchasesRes[0]?.count || 0;

      // 3. المصروفات
      const expensesRes = await db.select(
        `SELECT SUM(amount) as total, COUNT(*) as count, category_id
         FROM expenses
         WHERE date(expense_date) >= date(?) AND date(expense_date) <= date(?)`,
        [start, end]
      );
      const totalExpenses = expensesRes[0]?.total || 0;

      // 4. المرتجعات
      const returnsRes = await db.select(
        `SELECT SUM(amount) as total, COUNT(*) as count
         FROM returns
         WHERE date(return_date) >= date(?) AND date(return_date) <= date(?)`,
        [start, end]
      );
      const totalReturns = returnsRes[0]?.total || 0;

      // 5. تكلفة البضاعة المباعة (COGS)
      const cogsRes = await db.select(
        `SELECT SUM(ii.quantity * ii.cost_price_at_sale) as total
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE date(i.created_at) >= date(?) AND date(i.created_at) <= date(?)
         AND i.status = 'completed'`,
        [start, end]
      );
      const totalCogs = cogsRes[0]?.total || 0;

      const grossProfit = totalSales - totalCogs;
      const netProfit = grossProfit - totalExpenses - totalReturns;
      const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

      // 6. الحضور
      const attendanceRes = await db.select(
        `SELECT COUNT(DISTINCT employee_id) as count
         FROM attendance
         WHERE date = date(?)`,
        [start]
      );
      const attendanceCount = attendanceRes[0]?.count || 0;

      // 7. تفاصيل المبيعات (للجدول التفصيلي)
      const salesDetails = await db.select(
        `SELECT id, invoice_number, customer_name, total_after_discount as total, created_at as date, payment_method
         FROM invoices
         WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
         AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 50`,
        [start, end]
      );

      // 8. تفاصيل المشتريات
      const purchasesDetails = await db.select(
        `SELECT po.id, po.total_amount, po.paid_amount, po.purchase_date as date, s.name as supplier_name
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         WHERE date(po.purchase_date) >= date(?) AND date(po.purchase_date) <= date(?)
         ORDER BY po.purchase_date DESC
         LIMIT 50`,
        [start, end]
      );

      // 9. تفاصيل المصروفات مع الفئة
      const expensesDetails = await db.select(
        `SELECT e.amount, e.note, e.expense_date as date, ec.name as category_name
         FROM expenses e
         LEFT JOIN expense_categories ec ON e.category_id = ec.id
         WHERE date(e.expense_date) >= date(?) AND date(e.expense_date) <= date(?)
         ORDER BY e.expense_date DESC
         LIMIT 50`,
        [start, end]
      );

      // 10. تفاصيل المرتجعات
      const returnsDetails = await db.select(
        `SELECT r.amount, r.quantity, r.return_date as date, i.invoice_number, i.customer_name
         FROM returns r
         JOIN invoices i ON r.invoice_id = i.id
         WHERE date(r.return_date) >= date(?) AND date(r.return_date) <= date(?)
         ORDER BY r.return_date DESC
         LIMIT 50`,
        [start, end]
      );

      // 11. أفضل 5 منتجات مبيعاً
      const topProducts = await db.select(
        `SELECT p.name, SUM(ii.quantity) as qty, SUM(ii.total_price) as revenue
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE date(i.created_at) >= date(?) AND date(i.created_at) <= date(?)
         AND i.status = 'completed'
         GROUP BY p.id
         ORDER BY revenue DESC
         LIMIT 5`,
        [start, end]
      );

      // 12. المبيعات اليومية (للرسم البياني)
      const dailySales = await db.select(
        `SELECT date(created_at) as day, SUM(total_after_discount) as total
         FROM invoices
         WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
         AND status = 'completed'
         GROUP BY day
         ORDER BY day ASC`,
        [start, end]
      );

      // 13. المبيعات حسب الفئة
      const categorySales = await db.select(
        `SELECT p.category, SUM(ii.total_price) as total
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE date(i.created_at) >= date(?) AND date(i.created_at) <= date(?)
         AND i.status = 'completed'
         AND p.category IS NOT NULL AND p.category != ''
         GROUP BY p.category
         ORDER BY total DESC
         LIMIT 6`,
        [start, end]
      );

      setReportData({
        summary: {
          sales: totalSales,
          invoicesCount,
          purchases: totalPurchases,
          purchasesCount,
          expenses: totalExpenses,
          returns: totalReturns,
          profit: netProfit,
          margin,
          attendance: attendanceCount,
        },
        details: {
          sales: salesDetails,
          purchases: purchasesDetails,
          expenses: expensesDetails,
          returns: returnsDetails,
          products: topProducts,
          employees: [],
        },
        charts: {
          dailySales,
          categorySales,
        },
      });
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل التقرير", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedMonth, selectedYear, startDate, endDate]);

  const openDetailsModal = (type, title, data) => {
    setDetailsModal({ open: true, type, title, data });
  };

  const formatDateRange = () => {
    if (reportType === "monthly") {
      return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    }
    return `${startDate} إلى ${endDate}`;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  if (loading && !reportData.summary.sales) {
    return (
      <div className="page-container animate-fade-in" style={{ textAlign: "center", padding: "80px" }}>
        <Loader2 size={40} className="spin" style={{ color: "#60a5fa" }} />
        <p style={{ marginTop: 16, color: "#94a3b8" }}>جاري تحميل التقرير الشامل...</p>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
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
          transition: all 0.3s ease;
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
        }
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
        .stat-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
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
        .stat-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 6px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
        }
        .stat-btn:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
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
          flex-wrap: wrap;
        }
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .btn-action-neon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 40px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: #1e293b;
          color: #94a3b8;
        }
        .btn-action-neon:hover {
          background: #334155;
          color: white;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .date-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #0b0f19;
          padding: 6px 16px;
          border-radius: 40px;
          border: 1px solid #1e293b;
        }
        .date-selector select, .date-selector input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-size: 13px;
          padding: 4px 0;
        }
        .tab-buttons {
          display: flex;
          gap: 8px;
        }
        .tab-btn {
          padding: 6px 16px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
        }
        .tab-btn.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        .chart-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }
        .glass-card {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
        }
        .card-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f1f5f9;
        }
        .details-section {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 16px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          cursor: pointer;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .section-title {
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .blur-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .cyber-modal {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          width: 100%;
          max-width: 900px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .modal-cyber-header {
          padding: 18px 24px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-cyber-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: white; }
        .modal-close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .cyber-modal-body { overflow-y: auto; padding: 24px; }
        .cyber-table {
          width: 100%;
          border-collapse: collapse;
        }
        .cyber-table th {
          background: rgba(15, 23, 42, 0.8);
          padding: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
        }
        .cyber-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div>
          <h2 className="main-title">التقارير الشاملة</h2>
          <p className="sub-title">إحصائيات تفصيلية للمبيعات، المشتريات، المصروفات، المرتجعات، والموظفين حسب الشهر أو الفترة المخصصة</p>
        </div>
        <div className="header-actions-group">
          <div className="tab-buttons">
            <button className={`tab-btn ${reportType === "monthly" ? "active" : ""}`} onClick={() => setReportType("monthly")}>شهري</button>
            <button className={`tab-btn ${reportType === "custom" ? "active" : ""}`} onClick={() => setReportType("custom")}>فترة مخصصة</button>
          </div>
          {reportType === "monthly" ? (
            <div className="date-selector">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                {monthNames.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          ) : (
            <div className="date-selector">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span>إلى</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
          <button className="btn-action-neon btn-primary" onClick={fetchReport}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> عرض
          </button>
        </div>
      </div>

      {/* بطاقات الملخص الرئيسية (كما في الطلب) */}
      <div className="premium-stats-grid">
        {/* المبيعات */}
        <div className="premium-stat-card">
          <div className="stat-glow" style={{ background: "#10b981" }}></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المبيعات</div>
              <div className="stat-value" style={{ color: "#34d399" }}>{fmtCurrency(reportData.summary.sales)}</div>
              <div className="stat-sub">{reportData.summary.invoicesCount} فاتورة</div>
              <button className="stat-btn" onClick={() => openDetailsModal("sales", "تفاصيل المبيعات", reportData.details.sales)}><Eye size={12} /> التفاصيل</button>
            </div>
            <div className="stat-icon"><ShoppingCart size={20} /></div>
          </div>
        </div>

        {/* المشتريات */}
        <div className="premium-stat-card">
          <div className="stat-glow" style={{ background: "#8b5cf6" }}></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المشتريات</div>
              <div className="stat-value" style={{ color: "#a78bfa" }}>{fmtCurrency(reportData.summary.purchases)}</div>
              <div className="stat-sub">{reportData.summary.purchasesCount} فاتورة</div>
              <button className="stat-btn" onClick={() => openDetailsModal("purchases", "تفاصيل المشتريات", reportData.details.purchases)}><Eye size={12} /> التفاصيل</button>
            </div>
            <div className="stat-icon"><Truck size={20} /></div>
          </div>
        </div>

        {/* المصروفات */}
        <div className="premium-stat-card">
          <div className="stat-glow" style={{ background: "#ef4444" }}></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">المصروفات</div>
              <div className="stat-value" style={{ color: "#f87171" }}>{fmtCurrency(reportData.summary.expenses)}</div>
              <div className="stat-sub">إجمالي المصروفات</div>
              <button className="stat-btn" onClick={() => openDetailsModal("expenses", "تفاصيل المصروفات", reportData.details.expenses)}><Eye size={12} /> التفاصيل</button>
            </div>
            <div className="stat-icon"><TrendingDown size={20} /></div>
          </div>
        </div>

        {/* المرتجعات */}
        <div className="premium-stat-card">
          <div className="stat-glow" style={{ background: "#f59e0b" }}></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">المرتجعات</div>
              <div className="stat-value" style={{ color: "#fbbf24" }}>{fmtCurrency(reportData.summary.returns)}</div>
              <div className="stat-sub">إجمالي المسترد</div>
              <button className="stat-btn" onClick={() => openDetailsModal("returns", "تفاصيل المرتجعات", reportData.details.returns)}><Eye size={12} /> التفاصيل</button>
            </div>
            <div className="stat-icon"><RotateCcw size={20} /></div>
          </div>
        </div>

        {/* صافي الربح */}
        <div className="premium-stat-card">
          <div className="stat-glow" style={{ background: "#3b82f6" }}></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">صافي الربح</div>
              <div className="stat-value" style={{ color: reportData.summary.profit >= 0 ? "#34d399" : "#f87171" }}>{fmtCurrency(reportData.summary.profit)}</div>
              <div className="stat-sub">بعد خصم جميع المصروفات</div>
            </div>
            <div className="stat-icon"><DollarSign size={20} /></div>
          </div>
        </div>

        {/* الحضور */}
        <div className="premium-stat-card">
          <div className="stat-glow" style={{ background: "#ec4899" }}></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">الحضور</div>
              <div className="stat-value" style={{ color: "#f472b6" }}>{reportData.summary.attendance}</div>
              <div className="stat-sub">موظف حاضر</div>
            </div>
            <div className="stat-icon"><Users size={20} /></div>
          </div>
        </div>
      </div>

      {/* المخططات البيانية */}
      <div className="chart-grid">
        {/* المبيعات اليومية */}
        <div className="glass-card">
          <div className="card-title"><TrendingUp size={18} /> المبيعات اليومية</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={reportData.charts.dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: 8 }} formatter={(v) => fmtCurrency(v)} />
              <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} dot={{ fill: "#60a5fa", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* توزيع المبيعات حسب الفئة */}
        <div className="glass-card">
          <div className="card-title"><PieChart size={18} /> المبيعات حسب الفئة</div>
          {reportData.charts.categorySales.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>لا توجد بيانات فئات</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={reportData.charts.categorySales} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {reportData.charts.categorySales.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtCurrency(v)} contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* أفضل المنتجات مبيعاً */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div className="card-title"><Package size={18} /> أفضل المنتجات مبيعاً</div>
        <div className="cyber-table-container" style={{ boxShadow: "none" }}>
          <table className="cyber-table">
            <thead><tr><th>#</th><th>المنتج</th><th>الكمية المباعة</th><th>الإيرادات</th></tr></thead>
            <tbody>
              {reportData.details.products.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: "center", padding: 20 }}>لا توجد بيانات</td></tr>
              ) : (
                reportData.details.products.map((p, i) => (
                  <tr key={i}><td>{i+1}</td><td>{p.name}</td><td>{fmt(p.qty)} قطعة</td><td className="font-numeric" style={{ color: "#34d399" }}>{fmtCurrency(p.revenue)}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* تفاصيل الأقسام القابلة للطي (اختياري لتوسيع المعلومات دون مغادرة الصفحة) */}
      <div className="details-section">
        <div className="section-header" onClick={() => toggleSection("sales")}>
          <span className="section-title"><ShoppingCart size={16} /> تفاصيل المبيعات</span>
          <span>{expandedSections.sales ? "▲" : "▼"}</span>
        </div>
        {expandedSections.sales && (
          <div style={{ padding: "16px" }}>
            {reportData.details.sales.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20 }}>لا توجد مبيعات في هذه الفترة</div>
            ) : (
              <table className="cyber-table">
                <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
                <tbody>
                  {reportData.details.sales.slice(0, 10).map((inv) => (
                    <tr key={inv.id}><td>#{inv.invoice_number}</td><td>{inv.customer_name || "عميل نقدي"}</td><td>{fmtCurrency(inv.total)}</td><td>{new Date(inv.date).toLocaleDateString("ar-EG")}</td></tr>
                  ))}
                  {reportData.details.sales.length > 10 && <tr><td colSpan="4" style={{ textAlign: "center" }}>... وعرض {reportData.details.sales.length} فاتورة في نافذة التفاصيل</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* مودال التفاصيل الكاملة */}
      {detailsModal.open && (
        <div className="blur-overlay" onClick={() => setDetailsModal({ open: false, type: "", title: "", data: [] })}>
          <div className="cyber-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>{detailsModal.title}</h3>
              <button className="modal-close-btn" onClick={() => setDetailsModal({ open: false, type: "", title: "", data: [] })}><X size={20} /></button>
            </div>
            <div className="cyber-modal-body">
              {detailsModal.type === "sales" && (
                <table className="cyber-table">
                  <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead>
                  <tbody>
                    {detailsModal.data.map((inv) => (
                      <tr key={inv.id}><td>#{inv.invoice_number}</td><td>{inv.customer_name || "عميل نقدي"}</td><td>{fmtCurrency(inv.total)}</td><td>{inv.payment_method === "cash" ? "كاش" : inv.payment_method === "visa" ? "فيزا" : "تقسيط"}</td><td>{new Date(inv.date).toLocaleDateString("ar-EG")}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detailsModal.type === "purchases" && (
                <table className="cyber-table">
                  <thead><tr><th>رقم الفاتورة</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>التاريخ</th></tr></thead>
                  <tbody>
                    {detailsModal.data.map((po) => (
                      <tr key={po.id}><td>#{po.id}</td><td>{po.supplier_name}</td><td>{fmtCurrency(po.total_amount)}</td><td>{fmtCurrency(po.paid_amount)}</td><td>{new Date(po.date).toLocaleDateString("ar-EG")}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detailsModal.type === "expenses" && (
                <table className="cyber-table">
                  <thead><td><th>الفئة</th><th>المبلغ</th><th>الملاحظات</th><th>التاريخ</th></td></thead>
                  <tbody>
                    {detailsModal.data.map((exp, i) => (
                      <tr key={i}><td>{exp.category_name || "عام"}</td><td>{fmtCurrency(exp.amount)}</td><td>{exp.note || "—"}</td><td>{new Date(exp.date).toLocaleDateString("ar-EG")}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detailsModal.type === "returns" && (
                <table className="cyber-table">
                  <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>الكمية</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
                  <tbody>
                    {detailsModal.data.map((ret, i) => (
                      <tr key={i}><td>#{ret.invoice_number}</td><td>{ret.customer_name}</td><td>{ret.quantity}</td><td>{fmtCurrency(ret.amount)}</td><td>{new Date(ret.date).toLocaleDateString("ar-EG")}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#64748b", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
        التقرير للفترة: {formatDateRange()}
      </div>
    </div>
  );
};

export default MonthlyReportsPage;