import React , { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Search,
  RefreshCw,
  Loader2,
  Eye,
  X,
  Package,
  HandCoins,
  CreditCard,
  Repeat,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const CommissionReport = ({ showToast }) => {
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const [invoicesModal, setInvoicesModal] = useState({ open: false, employee: null, invoices: [] });
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ open: false, invoice: null, items: [], payments: [] });
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadEmployeeStats = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const monthStr = selectedMonth.toString().padStart(2, '0');
      const yearStr = selectedYear.toString();

      const rows = await db.select(
        `SELECT 
          e.id,
          e.name,
          e.commission_rate,
          COUNT(i.id) as invoice_count,
          COALESCE(SUM(i.total_after_discount), 0) as total_sales,
          COALESCE(SUM(i.total_after_discount * (e.commission_rate / 100.0)), 0) as total_commission
         FROM employees e
         LEFT JOIN invoices i ON i.seller_id = e.id 
           AND i.status = 'completed'
           AND strftime('%m', i.created_at) = ? 
           AND strftime('%Y', i.created_at) = ?
         WHERE e.is_active = 1
         GROUP BY e.id
         ORDER BY total_sales DESC`,
        [monthStr, yearStr]
      );
      setMonthlyStats(rows);
    } catch (error) {
      console.error(error);
      showToast?.("خطأ في تحميل بيانات العمولات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeeStats();
  }, [selectedMonth, selectedYear]);

  const fetchEmployeeInvoices = async (employee) => {
    setLoadingInvoices(true);
    try {
      const db = await getDb();
      const monthStr = selectedMonth.toString().padStart(2, '0');
      const yearStr = selectedYear.toString();
      const invoices = await db.select(
        `SELECT i.*, e.name as seller_name
         FROM invoices i
         LEFT JOIN employees e ON i.seller_id = e.id
         WHERE i.seller_id = ? 
           AND i.status = 'completed'
           AND strftime('%m', i.created_at) = ?
           AND strftime('%Y', i.created_at) = ?
         ORDER BY i.id DESC`,
        [employee.id, monthStr, yearStr]
      );
      setInvoicesModal({ open: true, employee, invoices });
    } catch (error) {
      console.error(error);
      showToast?.("خطأ في تحميل فواتير الموظف", "error");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchInvoiceDetails = async (invoice) => {
    setLoadingDetails(true);
    try {
      const db = await getDb();
      const items = await db.select(
        `SELECT ii.*, p.name as product_name, pv.size, pv.color
         FROM invoice_items ii
         LEFT JOIN products p ON ii.product_id = p.id
         LEFT JOIN product_variants pv ON ii.variant_id = pv.id
         WHERE ii.invoice_id = ?`,
        [invoice.id]
      );
      const payments = await db.select(
        `SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date ASC`,
        [invoice.id]
      );
      setDetailsModal({ open: true, invoice, items, payments });
    } catch (error) {
      console.error(error);
      showToast?.("خطأ في تحميل تفاصيل الفاتورة", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  const PaymentIcon = ({ method }) => {
    if (method === "cash") return <HandCoins size={14} className="text-green-400" />;
    if (method === "visa") return <CreditCard size={14} className="text-blue-400" />;
    return <Repeat size={14} className="text-amber-400" />;
  };

  const filteredStats = monthlyStats.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSales = filteredStats.reduce((sum, emp) => sum + emp.total_sales, 0);
  const totalCommission = filteredStats.reduce((sum, emp) => sum + emp.total_commission, 0);

  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  const toggleExpand = (empId) => {
    setExpandedEmployee(expandedEmployee === empId ? null : empId);
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
        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }
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
        .main-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
        }
        .sub-title {
          color: #94a3b8;
          font-size: 0.9rem;
          margin: 4px 0 0;
        }
        .premium-control-bar {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 18px 24px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
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
        .btn-add { background: #2563eb; color: #ffffff; }
        .btn-add:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
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
          padding: 12px 16px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .blur-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .cyber-modal {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
          overflow: hidden;
        }
        .wide-modal { max-width: 780px; }
        .modal-cyber-header {
          padding: 18px 24px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-cyber-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: white; }
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; }
        .modal-close-btn:hover { color: white; }
        .cyber-form { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .cyber-input-group { display: flex; flex-direction: column; gap: 8px; }
        .cyber-input-group label { font-size: 13px; color: #94a3b8; display: inline-flex; align-items: center; gap: 6px; }
        .cyber-input-group input {
          background: #070a12;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 12px;
          color: white;
          font-size: 14px;
          transition: border 0.2s ease;
        }
        .cyber-input-group input:focus { border-color: #2563eb; outline: none; }
        .cyber-modal-actions { display: flex; gap: 12px; margin-top: 8px; }
        .cyber-btn-submit {
          flex: 1; padding: 12px; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; font-size: 14px; border: none; cursor: pointer;
        }
        .cyber-btn-submit:hover { background: #1d4ed8; }
        .cyber-btn-dismiss {
          padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #94a3b8; font-weight: 600; font-size: 14px; border: none; cursor: pointer;
        }
        .cyber-btn-dismiss:hover { background: #334155; color: white; }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .text-green-400 { color: #4ade80; }
        .text-blue-400 { color: #60a5fa; }
        .text-amber-400 { color: #fbbf24; }
        .text-emerald-400 { color: #34d399; }
        .text-gray-400 { color: #94a3b8; }
        .font-semibold { font-weight: 600; }
        .text-center { text-align: center; }
        .cursor-pointer { cursor: pointer; }
        .py-4 { padding: 1rem 0; }
      `}</style>

      {/* Hero Stats Cards - نفس تصميم باقي الصفحات */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card indigo">
          <div className="stat-icon-wrapper"><TrendingUp size={24} /></div>
          <div>
            <div className="stat-label">إجمالي المبيعات</div>
            <div className="stat-value">{fmt(totalSales)}</div>
          </div>
        </div>
        <div className="premium-stat-card emerald">
          <div className="stat-icon-wrapper"><DollarSign size={24} /></div>
          <div>
            <div className="stat-label">إجمالي العمولات</div>
            <div className="stat-value">{fmt(totalCommission)}</div>
          </div>
        </div>
        <div className="premium-stat-card cyan">
          <div className="stat-icon-wrapper"><Users size={24} /></div>
          <div>
            <div className="stat-label">موظف نشط</div>
            <div className="stat-value">{filteredStats.length}</div>
          </div>
        </div>
      </div>

      {/* Header with title */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">تقرير عمولات الموظفين</h2>
          <p className="sub-title">عرض المبيعات والعمولات الشهرية للموظفين</p>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper" style={{ width: "280px" }}>
            <input
              type="text"
              placeholder="بحث باسم الموظف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
            />
            <Search size={16} className="search-icon" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <div className="threshold-control" style={{ display: "flex", gap: "8px", background: "#0b0f19", padding: "6px 16px", borderRadius: "40px" }}>
            <span style={{ color: "#94a3b8" }}>الشهر</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="premium-select" style={{ background: "transparent", border: "none", color: "white" }}>
              {monthNames.map((name, idx) => (<option key={idx+1} value={idx+1}>{name}</option>))}
            </select>
          </div>
          <div className="threshold-control" style={{ display: "flex", gap: "8px", background: "#0b0f19", padding: "6px 16px", borderRadius: "40px" }}>
            <span style={{ color: "#94a3b8" }}>السنة</span>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="premium-select" style={{ background: "transparent", border: "none", color: "white" }}>
              {[2023,2024,2025,2026,2027].map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
          <button className="btn-action-neon btn-add" onClick={loadEmployeeStats}>
            <RefreshCw size={18} className={loading ? "spin" : ""} /> تحديث
          </button>
        </div>
      </div>

      {loading && (
        <div className="cyber-table-container" style={{ textAlign: "center", padding: "60px" }}>
          <Loader2 size={40} className="spin text-blue-400" style={{ color: "#60a5fa" }} />
          <p style={{ marginTop: "16px", color: "#94a3b8" }}>جاري تحميل بيانات العمولات...</p>
        </div>
      )}

      {!loading && (
        <div className="cyber-table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>نسبة العمولة</th>
                <th>عدد الفواتير</th>
                <th>إجمالي المبيعات</th>
                <th>قيمة العمولة</th>
                <th style={{ textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.length === 0 ? (
                <tr><td colSpan="6" className="text-center" style={{ padding: "60px", color: "#64748b" }}>لا توجد بيانات في هذه الفترة</td></tr>
              ) : (
                filteredStats.map((emp) => {
                  const isExpanded = expandedEmployee === emp.id;
                  return (
                    <React.Fragment key={emp.id}>
                      <tr className="cyber-row-main cursor-pointer" onClick={() => toggleExpand(emp.id)}>
                        <td className="font-semibold">{emp.name}</td>
                        <td><span className="product-badge" style={{ background: "#1e293b", padding: "2px 8px", borderRadius: "20px", color: "#60a5fa" }}>{emp.commission_rate}%</span></td>
                        <td>{emp.invoice_count}</td>
                        <td className="text-emerald-400">{fmt(emp.total_sales)}</td>
                        <td className="text-green-400">{fmt(emp.total_commission)}</td>
                        <td className="table-actions-cell">
                          <button className="cyber-btn-mini edit" onClick={(e) => { e.stopPropagation(); toggleExpand(emp.id); }}>
                            <ChevronDown size={18} className={isExpanded ? "rotated" : ""} style={{ transition: "transform 0.2s" }} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="cyber-nested-row">
                          <td colSpan="6" style={{ padding: 0 }}>
                            <div className="nested-wrapper" style={{ padding: "20px", borderLeft: "3px solid #2563eb", background: "rgba(0,0,0,0.2)" }}>
                              <div className="nested-header">
                                <div className="nested-title"><h4>فواتير الشهر</h4></div>
                              </div>
                              {emp.invoice_count === 0 ? (
                                <div className="nested-empty" style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>لا توجد فواتير لهذا الموظف في الشهر المحدد</div>
                              ) : (
                                <div className="inline-fetch-placeholder" style={{ textAlign: "center", marginTop: "12px" }}>
                                  <button className="cyber-btn-mini edit" onClick={() => fetchEmployeeInvoices(emp)} style={{ padding: "6px 16px", width: "auto", gap: "6px" }}>
                                    <Eye size={16} /> عرض جميع فواتير {emp.name}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* مودال فواتير الموظف */}
      {invoicesModal.open && (
        <div className="blur-overlay" onClick={() => setInvoicesModal({ open: false, employee: null, invoices: [] })}>
          <div className="cyber-modal wide-modal" style={{ maxWidth: "850px", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3><Users size={18} style={{ display: "inline", marginLeft: "8px" }} /> فواتير {invoicesModal.employee?.name} - {monthNames[selectedMonth-1]} {selectedYear}</h3>
              <button className="modal-close-btn" onClick={() => setInvoicesModal({ open: false, employee: null, invoices: [] })}>✕</button>
            </div>
            <div className="cyber-form" style={{ padding: "20px" }}>
              {loadingInvoices ? (
                <div className="text-center py-4"><Loader2 size={28} className="spin" style={{ color: "#60a5fa" }} /><p className="mt-2 text-gray-400">جاري تحميل الفواتير...</p></div>
              ) : invoicesModal.invoices.length === 0 ? (
                <div className="text-center py-4 text-gray-400">لا توجد فواتير لهذا الموظف في الشهر المحدد</div>
              ) : (
                <div className="cyber-table-container">
                  <table className="cyber-table">
                    <thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>طريقة الدفع</th><th></th></tr></thead>
                    <tbody>
                      {invoicesModal.invoices.map(inv => (
                        <tr key={inv.id} className="cyber-row-main cursor-pointer" onClick={() => fetchInvoiceDetails(inv)}>
                          <td className="font-mono" style={{ color: "#60a5fa" }}>#{inv.invoice_number}</td>
                          <td>{new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
                          <td className="num-success">{fmt(inv.total_after_discount)}</td>
                          <td><div className="flex items-center gap-2"><PaymentIcon method={inv.payment_method} /><span>{inv.payment_method === "cash" ? "كاش" : inv.payment_method === "visa" ? "فيزا" : "تقسيط"}</span></div></td>
                          <td className="table-actions-cell"><button className="cyber-btn-mini edit" onClick={(e) => { e.stopPropagation(); fetchInvoiceDetails(inv); }}><Eye size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="cyber-modal-actions end-aligned" style={{ justifyContent: "flex-end" }}>
                <button className="cyber-btn-dismiss" onClick={() => setInvoicesModal({ open: false, employee: null, invoices: [] })}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال تفاصيل الفاتورة */}
      {detailsModal.open && (
        <div className="blur-overlay" onClick={() => setDetailsModal({ open: false, invoice: null, items: [], payments: [] })}>
          <div className="cyber-modal wide-modal" style={{ maxWidth: "900px", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3><Package size={18} style={{ display: "inline", marginLeft: "8px" }} /> تفاصيل الفاتورة #{detailsModal.invoice?.invoice_number}</h3>
              <button className="modal-close-btn" onClick={() => setDetailsModal({ open: false, invoice: null, items: [], payments: [] })}>✕</button>
            </div>
            <div className="cyber-form" style={{ padding: "20px" }}>
              {loadingDetails ? (
                <div className="text-center py-4"><Loader2 size={28} className="spin" style={{ color: "#60a5fa" }} /><p className="mt-2 text-gray-400">جاري تحميل التفاصيل...</p></div>
              ) : (
                <>
                  <div className="spec-section-box" style={{ marginTop: 0 }}>
                    <div className="spec-box-title"><span>معلومات الفاتورة</span></div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                      <div><span className="spec-card-label" style={{ color: "#94a3b8" }}>العميل:</span> <strong>{detailsModal.invoice?.customer_name || "عميل نقدي"}</strong></div>
                      <div><span className="spec-card-label" style={{ color: "#94a3b8" }}>البائع:</span> <strong>{detailsModal.invoice?.seller_name || "—"}</strong></div>
                      <div><span className="spec-card-label" style={{ color: "#94a3b8" }}>طريقة الدفع:</span> <strong className="flex items-center gap-1"><PaymentIcon method={detailsModal.invoice?.payment_method} /> {detailsModal.invoice?.payment_method === "cash" ? "كاش" : detailsModal.invoice?.payment_method === "visa" ? "فيزا" : "تقسيط"}</strong></div>
                      <div><span className="spec-card-label" style={{ color: "#94a3b8" }}>التاريخ:</span> <strong>{new Date(detailsModal.invoice?.created_at).toLocaleString("ar-EG")}</strong></div>
                      <div><span className="spec-card-label" style={{ color: "#94a3b8" }}>الإجمالي:</span> <strong className="text-emerald-400">{fmt(detailsModal.invoice?.total_after_discount)}</strong></div>
                      <div><span className="spec-card-label" style={{ color: "#94a3b8" }}>المدفوع:</span> <strong>{fmt(detailsModal.invoice?.paid_amount)}</strong></div>
                    </div>
                  </div>

                  <div className="spec-section-box">
                    <div className="spec-box-title"><Package size={14} /> الأصناف المشتراة</div>
                    <div className="cyber-table-container">
                      <table className="cyber-table">
                        <thead><tr><th>المنتج</th><th>المقاس/اللون</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                        <tbody>
                          {detailsModal.items?.length ? detailsModal.items.map((it, i) => (
                            <tr key={i} className="cyber-row-main">
                              <td>{it.product_name}</td>
                              <td>{it.size || "—"} {it.color ? `/ ${it.color}` : ""}</td>
                              <td className="text-center">{it.quantity}</td>
                              <td>{fmt(it.unit_price)}</td>
                              <td className="num-success">{fmt(it.quantity * it.unit_price)}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan="5" className="text-center py-4 text-gray-400">لا توجد أصناف مسجلة</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {detailsModal.payments?.length > 0 && (
                    <div className="spec-section-box">
                      <div className="spec-box-title"><HandCoins size={14} /> سجل المدفوعات</div>
                      <div className="cyber-table-container">
                        <table className="cyber-table">
                          <thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr></thead>
                          <tbody>
                            {detailsModal.payments.map((p, i) => (
                              <tr key={i} className="cyber-row-main">
                                <td>{new Date(p.payment_date).toLocaleString()}</td>
                                <td className="num-success">{fmt(p.amount_paid)}</td>
                                <td>{p.note || "تحصيل"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="cyber-modal-actions end-aligned" style={{ justifyContent: "flex-end" }}>
                <button className="cyber-btn-dismiss" onClick={() => setDetailsModal({ open: false, invoice: null, items: [], payments: [] })}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionReport;