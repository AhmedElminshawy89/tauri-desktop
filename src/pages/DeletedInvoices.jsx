import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Search,
  RefreshCw,
  Eye,
  Hash,
  User,
  X,
  ShoppingBag,
  RotateCcw,
  AlertCircle,
  CalendarDays,
  HandCoins,
  Clock,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const DeletedInvoices = ({ showToast }) => {
  const [deletedInvoices, setDeletedInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeletedInvoices();
  }, []);

  const fetchDeletedInvoices = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const results = await db.select(
        "SELECT * FROM deleted_invoices ORDER BY deleted_at DESC"
      );

      const parsedResults = results.map((inv) => {
        let details = { items: [], returns: [], installment_plan: [], payments: [] };
        try {
          if (inv.items_json) {
            const parsed = JSON.parse(inv.items_json);
            details = {
              items: parsed.items || [],
              returns: parsed.returns || [],
              installment_plan: parsed.installment_plan || [],
              payments: parsed.payments || [],
            };
          }
        } catch (e) {
          console.error("Error parsing items for invoice:", inv.invoice_number, e);
        }
        return { ...inv, details };
      });

      setDeletedInvoices(parsedResults);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في جلب سجل المحذوفات", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = deletedInvoices.filter((inv) => {
    const search = searchTerm.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(search) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(search)) ||
      (inv.reason && inv.reason.toLowerCase().includes(search))
    );
  });

  const closeModal = () => setSelectedInvoice(null);

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
        .stat-content { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
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
        .stat-details { flex: 1; }
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
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
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
        .id-badge-red {
          display: inline-block;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 4px 10px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
        }
        .reason-tag {
          display: inline-block;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .action-btn {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.2s;
        }
        .action-btn.edit:hover { color: #60a5fa; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
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
          max-height: 90vh;
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
        .modal-cyber-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
        }
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
        .modal-close-btn:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .cyber-modal-body {
          overflow-y: auto;
          padding: 24px;
        }
        .cyber-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .info-card-red-flat {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        .info-item span {
          display: block;
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 4px;
        }
        .info-item strong {
          color: #f1f5f9;
          font-weight: 600;
        }
        .reason-full-box {
          background: rgba(239,68,68,0.05);
          border-right: 3px solid #ef4444;
          padding: 12px 16px;
          border-radius: 8px;
        }
        .reason-full-box strong {
          color: #f87171;
          font-size: 13px;
        }
        .reason-full-box p {
          margin: 6px 0 0;
          font-size: 13px;
          color: #cbd5e1;
        }
        .section-header-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 24px 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .section-header-mini h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        .mini-details-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .mini-details-table th {
          background: rgba(15, 23, 42, 0.6);
          padding: 12px;
          text-align: right;
          color: #94a3b8;
          font-weight: 600;
          border-bottom: 1px solid #1e293b;
        }
        .mini-details-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .text-center { text-align: center; }
        .text-red { color: #f87171; }
        .text-orange { color: #fb923c; }
        .font-bold { font-weight: 700; }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">أرشيف المحذوفات التفصيلي</h2>
          <p className="sub-title">مراجعة كاملة للمنتجات والمرتجعات والأقساط للفواتير الملغاة</p>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة أو العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
              style={{ width: "320px" }}
            />
            <Search size={18} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchDeletedInvoices}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            تحديث السجل
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th><Hash size={16} style={{ verticalAlign: "middle", marginLeft: "4px" }} /> رقم الفاتورة</th>
              <th><User size={16} style={{ verticalAlign: "middle", marginLeft: "4px" }} /> العميل</th>
              <th>الإجمالي الملغى</th>
              <th>تاريخ الحذف</th>
              <th>سبب الحذف</th>
              <th style={{ textAlign: "center" }}>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#94a3b8" }}>جاري تحميل الأرشيف...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>لا توجد فواتير محذوفة</td></tr>
            ) : (
              filteredData.map((inv) => (
                <tr key={inv.id} className="cyber-row-main">
                  <td><span className="id-badge-red">#{inv.invoice_number}</span></td>
                  <td>{inv.customer_name || "عميل نقدي"}</td>
                  <td className="num-primary">{fmt(inv.total_amount)}</td>
                  <td>{new Date(inv.deleted_at).toLocaleString("ar-EG")}</td>
                  <td><div className="reason-tag" title={inv.reason}>{inv.reason}</div></td>
                  <td style={{ textAlign: "center" }}>
                    <button className="action-btn edit" onClick={() => setSelectedInvoice(inv)}>
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Details */}
      {selectedInvoice && (
        <div className="blur-overlay" onClick={closeModal}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3><AlertCircle size={20} style={{ color: "#f87171" }} /> تفاصيل الفاتورة المحذوفة #{selectedInvoice.invoice_number}</h3>
              <button className="modal-close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="cyber-modal-body">
              {/* Info Card */}
              <div className="info-card-red-flat">
                <div className="info-grid">
                  <div className="info-item"><span>العميل</span><strong>{selectedInvoice.customer_name || "عميل نقدي"}</strong></div>
                  <div className="info-item"><span>المبلغ الملغى</span><strong className="text-red">{fmt(selectedInvoice.total_amount)}</strong></div>
                  <div className="info-item"><span>وقت الحذف</span><strong>{new Date(selectedInvoice.deleted_at).toLocaleString("ar-EG")}</strong></div>
                </div>
                <div className="reason-full-box">
                  <strong>سبب الحذف الأساسي</strong>
                  <p>{selectedInvoice.reason || "لم يتم ذكر سبب"}</p>
                </div>
              </div>

              {/* Items */}
              <div className="section-header-mini" style={{ color: "#f87171" }}>
                <ShoppingBag size={18} />
                <h4>المنتجات التي كانت بالفاتورة</h4>
              </div>
              <table className="mini-details-table">
                <thead><tr><th>المنتج</th><th className="text-center">الكمية</th><th className="text-center">السعر</th><th className="text-center">الإجمالي</th></tr></thead>
                <tbody>
                  {selectedInvoice.details?.items && selectedInvoice.details.items.length > 0 ? (
                    selectedInvoice.details.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.product_name}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-center">{fmt(item.unit_price)}</td>
                        <td className="text-center font-bold text-orange">{fmt(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}><AlertCircle size={20} /> لا توجد تفاصيل أصناف مخزنة لهذه الفاتورة</td></tr>
                  )}
                </tbody>
              </table>

              {/* Installment Plan */}
              {selectedInvoice.details?.installment_plan && selectedInvoice.details.installment_plan.length > 0 && (
                <>
                  <div className="section-header-mini" style={{ color: "#fb923c" }}>
                    <CalendarDays size={18} />
                    <h4>خطة الأقساط المسجلة</h4>
                  </div>
                  <table className="mini-details-table">
                    <thead><tr><th>#</th><th>تاريخ الاستحقاق</th><th className="text-center">المبلغ المطلوب</th><th>الحالة</th><th>تاريخ الدفع الفعلي</th></tr></thead>
                    <tbody>
                      {selectedInvoice.details.installment_plan.map((plan, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{new Date(plan.due_date).toLocaleDateString("ar-EG")}</td>
                          <td className="text-center">{fmt(plan.amount_due)}</td>
                          <td>{plan.status === "paid" ? <span style={{ color: "#34d399" }}>مدفوع</span> : <span style={{ color: "#fb923c" }}>معلق</span>}</td>
                          <td>{plan.payment_date ? new Date(plan.payment_date).toLocaleDateString("ar-EG") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Payments */}
              {selectedInvoice.details?.payments && selectedInvoice.details.payments.length > 0 && (
                <>
                  <div className="section-header-mini" style={{ color: "#60a5fa" }}>
                    <HandCoins size={18} />
                    <h4>سجل التحصيلات السابقة</h4>
                  </div>
                  <table className="mini-details-table">
                    <thead><tr><th>تاريخ الدفع</th><th className="text-center">المبلغ المدفوع</th><th>ملاحظات</th></tr></thead>
                    <tbody>
                      {selectedInvoice.details.payments.map((pay, idx) => (
                        <tr key={idx}>
                          <td>{new Date(pay.payment_date).toLocaleString("ar-EG")}</td>
                          <td className="text-center font-bold text-orange">{fmt(pay.amount_paid)}</td>
                          <td>{pay.note || "تحصيل"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Returns */}
              {selectedInvoice.details?.returns && selectedInvoice.details.returns.length > 0 && (
                <>
                  <div className="section-header-mini" style={{ color: "#f97316" }}>
                    <RotateCcw size={18} />
                    <h4>مرتجعات تمت قبل الحذف</h4>
                  </div>
                  <table className="mini-details-table">
                    <thead><tr><th>تاريخ المرتجع</th><th className="text-center">المبلغ المسترد</th><th>ملاحظات</th></tr></thead>
                    <tbody>
                      {selectedInvoice.details.returns.map((ret, i) => (
                        <tr key={i}>
                          <td>{new Date(ret.created_at).toLocaleDateString("ar-EG")}</td>
                          <td className="text-center font-bold text-orange">{fmt(ret.amount)}</td>
                          <td>{ret.notes || "تلقائي"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="cyber-modal-footer">
              <button className="btn-action-neon btn-secondary" onClick={closeModal}>إغلاق السجل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedInvoices;