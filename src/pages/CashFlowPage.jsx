import React, { useState, useEffect, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  FileText,
  User,
  Clock,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  XCircle,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const fmtCurrency = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const CashFlowPage = ({ showToast }) => {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, inflow, outflow
  const [summary, setSummary] = useState({ totalInflow: 0, totalOutflow: 0, balance: 0 });

  const fetchTransactions = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const db = await getDb();
      const start = `${startDate} 00:00:00`;
      const end = `${endDate} 23:59:59`;

      // 1. إيرادات المبيعات النقدية والفيزا (تعتبر واردة للخزينة)
      const sales = await db.select(
        `SELECT 
          i.id, i.invoice_number, i.created_at, 
          i.total_after_discount as amount, 
          i.payment_method,
          i.customer_name,
          'sale' as type,
          'إيراد مبيعات' as description
         FROM invoices i
         WHERE i.created_at >= ? AND i.created_at <= ?
           AND i.status = 'completed'
           AND i.payment_method IN ('cash', 'visa')
         ORDER BY i.created_at DESC`,
        [start, end]
      );

      // 2. أقساط تم تحصيلها (دفعات إضافية على فواتير التقسيط)
      const installments = await db.select(
        `SELECT 
          ip.id, ip.payment_date as created_at, ip.amount_paid as amount,
          'installment' as type,
          'قسط من فاتورة رقم ' || i.invoice_number as description,
          i.invoice_number,
          i.customer_name
         FROM installment_payments ip
         JOIN invoices i ON ip.invoice_id = i.id
         WHERE ip.payment_date >= ? AND ip.payment_date <= ?
         ORDER BY ip.payment_date DESC`,
        [start, end]
      );

      // 3. مصروفات (خروج)
      const expenses = await db.select(
        `SELECT 
          e.id, e.expense_date as created_at, e.amount,
          e.note as description,
          ec.name as category_name,
          'expense' as type
         FROM expenses e
         LEFT JOIN expense_categories ec ON e.category_id = ec.id
         WHERE e.expense_date >= ? AND e.expense_date <= ?
         ORDER BY e.expense_date DESC`,
        [startDate, endDate]
      );

      // 4. مشتريات (مدفوعات للموردين – خروج)
      const purchases = await db.select(
        `SELECT 
          po.id, po.purchase_date as created_at, po.total_amount as amount,
          'فاتورة مشتريات رقم ' || po.id as description,
          s.name as supplier_name,
          'purchase' as type
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.purchase_date >= ? AND po.purchase_date <= ?
         ORDER BY po.purchase_date DESC`,
        [startDate, endDate]
      );

      // 5. دفعات إضافية للموردين (خروج)
      const supplierPayments = await db.select(
        `SELECT 
          sp.id, sp.paid_at as created_at, sp.amount,
          'دفعة للمورد ' || s.name as description,
          s.name as supplier_name,
          'supplier_payment' as type
         FROM supplier_payments sp
         JOIN suppliers s ON sp.supplier_id = s.id
         WHERE sp.paid_at >= ? AND sp.paid_at <= ?
           AND sp.status = 'paid'
         ORDER BY sp.paid_at DESC`,
        [start, end]
      );

      // 6. مرتجعات (مبالغ مستردة للعملاء – خروج)
      const returns = await db.select(
        `SELECT 
          r.id, r.return_date as created_at, r.amount,
          'مرتجع فاتورة رقم ' || i.invoice_number as description,
          i.customer_name,
          'return' as type
         FROM returns r
         JOIN invoices i ON r.invoice_id = i.id
         WHERE r.return_date >= ? AND r.return_date <= ?
         ORDER BY r.return_date DESC`,
        [startDate, endDate]
      );

      // دمج جميع المعاملات وتنسيقها
      const allTx = [
        ...sales.map(tx => ({ ...tx, direction: "inflow", date: tx.created_at })),
        ...installments.map(tx => ({ ...tx, direction: "inflow", date: tx.created_at })),
        ...expenses.map(tx => ({ ...tx, direction: "outflow", date: tx.created_at })),
        ...purchases.map(tx => ({ ...tx, direction: "outflow", date: tx.created_at })),
        ...supplierPayments.map(tx => ({ ...tx, direction: "outflow", date: tx.created_at })),
        ...returns.map(tx => ({ ...tx, direction: "outflow", date: tx.created_at })),
      ];

      // ترتيب تنازلي حسب التاريخ
      allTx.sort((a, b) => new Date(b.date) - new Date(a.date));

      // حساب الإجماليات
      const totalInflow = allTx.filter(t => t.direction === "inflow").reduce((s, t) => s + Number(t.amount), 0);
      const totalOutflow = allTx.filter(t => t.direction === "outflow").reduce((s, t) => s + Number(t.amount), 0);

      setTransactions(allTx);
      setSummary({
        totalInflow,
        totalOutflow,
        balance: totalInflow - totalOutflow,
      });
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل بيانات حركة الخزينة", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (filterType !== "all") {
      filtered = filtered.filter(t => t.direction === filterType);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        (t.description?.toLowerCase().includes(term)) ||
        (t.customer_name?.toLowerCase().includes(term)) ||
        (t.supplier_name?.toLowerCase().includes(term)) ||
        (t.invoice_number?.toLowerCase().includes(term))
      );
    }
    return filtered;
  }, [transactions, filterType, searchTerm]);

  const getTypeIcon = (type) => {
    switch (type) {
      case "sale": return <DollarSign size={14} />;
      case "installment": return <Clock size={14} />;
      case "expense": return <TrendingDown size={14} />;
      case "purchase": return <FileText size={14} />;
      case "supplier_payment": return <User size={14} />;
      case "return": return <XCircle size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      sale: "بيع نقدي",
      installment: "قسط مستلم",
      expense: "مصروف",
      purchase: "مشتريات",
      supplier_payment: "دفعة لمورد",
      return: "مرتجع",
    };
    return labels[type] || type;
  };

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        /* ========== GLASS/CYBER THEME ========== */
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
          transition: opacity 0.3s ease;
        }
        .premium-stat-card:hover .stat-glow { opacity: 0.3; }
        .card-inflow .stat-glow { background: #10b981; }
        .card-outflow .stat-glow { background: #ef4444; }
        .card-balance .stat-glow { background: #3b82f6; }
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
        .card-inflow .stat-icon { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-outflow .stat-icon { color: #f87171; background: rgba(239,68,68,0.1); }
        .card-balance .stat-icon { color: #60a5fa; background: rgba(59,130,246,0.1); }
        
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
        .hero-icon {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          padding: 12px;
          border-radius: 16px;
          box-shadow: 0 0 20px rgba(59,130,246,0.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 16px;
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
          border-radius: 40px;
          padding: 8px 40px 8px 16px;
          width: 240px;
          color: #f1f5f9;
          font-size: 0.85rem;
          outline: none;
          transition: all 0.2s;
        }
        .search-neon-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .search-neon-wrapper .search-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
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
          transition: all 0.2s ease;
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
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 40px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8;
        }
        .filter-chip.active {
          background: #2563eb;
          border-color: #2563eb;
          color: white;
        }
        .date-range-group {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #0b0f19;
          padding: 6px 16px;
          border-radius: 40px;
          border: 1px solid #1e293b;
        }
        .date-picker { display: flex; align-items: center; gap: 8px; color: #64748b; }
        .date-picker input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-size: 0.85rem;
          cursor: pointer;
        }
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
        .inflow-text { color: #34d399; font-weight: 700; }
        .outflow-text { color: #f87171; font-weight: 700; }
        .badge-type {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(255,255,255,0.05);
          color: #94a3b8;
        }
        .empty-row { text-align: center; padding: 50px !important; color: #64748b; }
        .loading-state {
          text-align: center;
          padding: 80px;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .font-numeric { font-variant-numeric: tabular-nums; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="hero-icon"><TrendingUp size={28} /></div>
            <div>
              <h2 className="main-title">حركة الخزينة</h2>
              <p className="sub-title">تتبع الإيرادات والمصروفات والتدفقات النقدية</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="date-range-group">
            <div className="date-picker"><Calendar size={14} /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <span className="date-sep" style={{ color: "#64748b" }}>إلى</span>
            <div className="date-picker"><Calendar size={14} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="search-neon-wrapper">
            <input type="text" placeholder="بحث (رقم الفاتورة، العميل، المورد...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-neon-input" style={{ width: 260 }} />
            <Search size={15} className="search-icon" />
          </div>
          <button className="btn-action-neon btn-primary" onClick={fetchTransactions}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            تحديث
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-inflow">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي الإيرادات (داخل)</div>
              <div className="stat-value">{fmtCurrency(summary.totalInflow)}</div>
            </div>
            <div className="stat-icon"><ArrowUpCircle size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-outflow">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المصروفات (خارج)</div>
              <div className="stat-value">{fmtCurrency(summary.totalOutflow)}</div>
            </div>
            <div className="stat-icon"><ArrowDownCircle size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-balance">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">صافي التدفق (الرصيد)</div>
              <div className="stat-value" style={{ color: summary.balance >= 0 ? "#34d399" : "#f87171" }}>{fmtCurrency(summary.balance)}</div>
            </div>
            <div className="stat-icon"><DollarSign size={20} /></div>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button className={`filter-chip ${filterType === "all" ? "active" : ""}`} onClick={() => setFilterType("all")}>الكل</button>
        <button className={`filter-chip ${filterType === "inflow" ? "active" : ""}`} onClick={() => setFilterType("inflow")}><ArrowUpCircle size={14} /> وارد</button>
        <button className={`filter-chip ${filterType === "outflow" ? "active" : ""}`} onClick={() => setFilterType("outflow")}><ArrowDownCircle size={14} /> صادر</button>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="loading-state">
          <Loader2 size={36} className="spin" />
          <p>جاري تحميل حركة الخزينة...</p>
        </div>
      ) : (
        <div className="cyber-table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>البيان</th>
                <th>الجهة / التفاصيل</th>
                <th>النوع</th>
                <th style={{ textAlign: "center" }}>الوارد</th>
                <th style={{ textAlign: "center" }}>الصادر</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr className="cyber-row-main">
                  <td colSpan="6" className="empty-row">لا توجد حركات في هذه الفترة</td>
                </tr>
              ) : (
                filteredTransactions.map((tx, idx) => (
                  <tr key={idx} className="cyber-row-main">
                    <td style={{ fontSize: "12px", color: "#64748b" }}>{new Date(tx.date).toLocaleDateString("ar-EG")}</td>
                    <td style={{ fontWeight: "500", maxWidth: "200px" }}>{tx.description}</td>
                    <td style={{ color: "#cbd5e1", fontSize: "13px" }}>
                      {tx.customer_name || tx.supplier_name || (tx.invoice_number ? `فاتورة #${tx.invoice_number}` : "—")}
                    </td>
                    <td><span className="badge-type">{getTypeIcon(tx.type)} {getTypeLabel(tx.type)}</span></td>
                    <td className="inflow-text font-numeric" style={{ textAlign: "center" }}>
                      {tx.direction === "inflow" ? fmtCurrency(tx.amount) : "—"}
                    </td>
                    <td className="outflow-text font-numeric" style={{ textAlign: "center" }}>
                      {tx.direction === "outflow" ? fmtCurrency(tx.amount) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CashFlowPage;