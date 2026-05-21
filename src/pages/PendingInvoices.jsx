import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Search,
  RefreshCw,
  Eye,
  Hash,
  User,
  RotateCcw,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  HandCoins,
  Receipt,
  Package,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import CashierPage from "./CashierPage";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const PendingInvoices = ({ showToast }) => {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, invoice: null });
  const [editInvoiceId, setEditInvoiceId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchPendingInvoices = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const rows = await db.select(
        `SELECT i.*, 
                e.name AS seller_name
         FROM invoices i
         LEFT JOIN employees e ON i.seller_id = e.id
         WHERE i.status = 'pending'
         ORDER BY i.id DESC`
      );
      setInvoices(rows || []);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في جلب الفواتير المعلقة", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingInvoices();
  }, []);

  const handleResume = (invoiceId) => {
    setEditInvoiceId(invoiceId);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditInvoiceId(null);
    fetchPendingInvoices();
    window.dispatchEvent(new CustomEvent("pendingCountUpdated"));
  };

  const handleCancelConfirmed = async () => {
    const invoice = deleteConfirm.invoice;
    if (!invoice) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [invoice.id]);
      await db.execute("DELETE FROM invoices WHERE id = ?", [invoice.id]);
      if (showToast) showToast("تم إلغاء الفاتورة المعلقة", "success");
      setDeleteConfirm({ show: false, invoice: null });
      await fetchPendingInvoices();
      window.dispatchEvent(new CustomEvent("pendingCountUpdated"));
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في الإلغاء: " + err.message, "error");
    }
  };

  const fetchInvoiceDetails = async (invoice) => {
    setSelectedInvoice(invoice);
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
        "SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date ASC",
        [invoice.id]
      );
      setInvoiceDetails({ items, payments });
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في تحميل تفاصيل الفاتورة", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedInvoice(null);
    setInvoiceDetails(null);
  };

  const filtered = invoices.filter((inv) =>
    (inv.invoice_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        .card-amber .stat-glow { background: #f59e0b; }
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
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
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
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
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
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .id-badge {
          display: inline-block;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 4px 10px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
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
        .action-btn.view { background: #3b82f6; color: white; border: none; }
        .action-btn.view:hover { background: #2563eb; }
        .action-btn.edit:hover { color: #60a5fa; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .action-btn.delete { background: #ef4444; color: white; border: none; }
        .action-btn.delete:hover { background: #dc2626; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Clock size={28} style={{ color: "#f59e0b" }} />
            <div>
              <h2 className="main-title">الفواتير المعلقة</h2>
              <p className="sub-title">استئناف أو عرض تفاصيل الفواتير التي لم تُكتمل</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
              style={{ width: 280 }}
            />
            <Search size={15} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchPendingInvoices}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            تحديث
          </button>
        </div>
      </div>

      {/* Stats Card (optional, just for consistency) */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Clock size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">الفواتير المعلقة</div>
              <div className="stat-value">{invoices.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th><Hash size={16} style={{ verticalAlign: "middle", marginLeft: "4px" }} /> رقم الفاتورة</th>
              <th><User size={16} style={{ verticalAlign: "middle", marginLeft: "4px" }} /> العميل</th>
              <th>البائع</th>
              <th>الإجمالي</th>
              <th>تاريخ الإنشاء</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#94a3b8" }}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>لا توجد فواتير معلقة</td></tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="cyber-row-main">
                  <td><span className="id-badge">#{inv.invoice_number}</span></td>
                  <td>{inv.customer_name || "عميل نقدي"}</td>
                  <td>{inv.seller_name || "—"}</td>
                  <td className="num-primary">{fmt(inv.total_after_discount)}</td>
                  <td>{new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
                  <td className="actions-cell-premium" style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                    <button className="action-btn view" onClick={() => fetchInvoiceDetails(inv)} title="عرض التفاصيل">
                      <Eye size={18} />
                    </button>
                    <button className="action-btn edit" onClick={() => handleResume(inv.id)} title="استئناف الفاتورة">
                      <RotateCcw size={18} />
                    </button>
                    <button className="action-btn delete" onClick={() => setDeleteConfirm({ show: true, invoice: inv })} title="إلغاء الفاتورة">
                      <Trash2 size={18} />
                    </button>
                   </td>
                 </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Invoice Details */}
      {selectedInvoice && (
        <div className="blur-overlay" onClick={closeModal}>
          <div className="cyber-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3><Receipt size={18} style={{ marginLeft: "8px" }} /> تفاصيل الفاتورة المعلقة #{selectedInvoice.invoice_number}</h3>
              <button className="modal-close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="cyber-modal-body">
              {loadingDetails ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>جاري تحميل التفاصيل...</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><User size={14} /> بيانات العميل</div>
                      <div style={{ fontSize: "13px", marginBottom: "6px" }}><User size={12} style={{ marginLeft: "4px" }} /> الاسم: {selectedInvoice.customer_name || "عميل نقدي"}</div>
                      <div style={{ fontSize: "13px", marginBottom: "6px" }}><Phone size={12} style={{ marginLeft: "4px" }} /> الهاتف: {selectedInvoice.customer_phone || "—"}</div>
                      <div style={{ fontSize: "13px" }}><MapPin size={12} style={{ marginLeft: "4px" }} /> العنوان: {selectedInvoice.customer_address || "—"}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><FileText size={14} /> بيانات الفاتورة</div>
                      <div style={{ fontSize: "13px", marginBottom: "6px" }}><Calendar size={12} style={{ marginLeft: "4px" }} /> التاريخ: {new Date(selectedInvoice.created_at).toLocaleDateString("ar-EG")}</div>
                      <div style={{ fontSize: "13px", marginBottom: "6px" }}><HandCoins size={12} style={{ marginLeft: "4px" }} /> طريقة الدفع: {selectedInvoice.payment_method === "cash" ? "كاش" : selectedInvoice.payment_method === "visa" ? "فيزا" : "تقسيط"}</div>
                      <div style={{ fontSize: "13px", marginBottom: "6px" }}><AlertCircle size={12} style={{ marginLeft: "4px" }} /> الحالة: معلقة</div>
                      <div style={{ fontSize: "13px" }}><User size={12} style={{ marginLeft: "4px" }} /> البائع: {selectedInvoice.seller_name || "—"}</div>
                    </div>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><DollarSign size={14} /> الملخص المالي</div>
                    <div style={{ fontSize: "13px", marginBottom: "4px" }}>إجمالي قبل الخصم: {fmt(selectedInvoice.total_before_discount)}</div>
                    {selectedInvoice.discount_value > 0 && (
                      <div style={{ fontSize: "13px", marginBottom: "4px" }}>الخصم: - {selectedInvoice.discount_type === "percent" ? `${selectedInvoice.discount_value}%` : fmt(selectedInvoice.discount_value)}</div>
                    )}
                    <div style={{ fontSize: "15px", fontWeight: "bold", marginTop: "8px", color: "#34d399" }}>الصافي النهائي: {fmt(selectedInvoice.total_after_discount)}</div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><Package size={14} /> الأصناف المشتراة</div>
                    <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <table className="cyber-table" style={{ fontSize: "13px" }}>
                        <thead>
                          <tr>
                            <th>الصنف</th>
                            <th>المقاس/اللون</th>
                            <th style={{ textAlign: "center" }}>الكمية</th>
                            <th>سعر الوحدة</th>
                            <th>الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetails?.items?.length > 0 ? (
                            invoiceDetails.items.map((item, idx) => (
                              <tr key={idx} className="cyber-row-main">
                                <td>{item.product_name}</td>
                                <td>{item.size || "—"} / {item.color || "—"}</td>
                                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                                <td>{fmt(item.unit_price)}</td>
                                <td className="num-primary">{fmt(item.quantity * item.unit_price)}</td>
                               </tr>
                            ))
                          ) : (
                            <tr><td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>لا توجد أصناف مسجلة</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {invoiceDetails?.payments?.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><HandCoins size={14} /> سجل المدفوعات</div>
                      <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <table className="cyber-table" style={{ fontSize: "13px" }}>
                          <thead>
                            <tr>
                              <th>تاريخ الدفع</th>
                              <th style={{ textAlign: "center" }}>المبلغ</th>
                              <th>ملاحظات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceDetails.payments.map((p, idx) => (
                              <tr key={idx} className="cyber-row-main">
                                <td>{new Date(p.payment_date).toLocaleString("ar-EG")}</td>
                                <td className="num-success" style={{ textAlign: "center" }}>{fmt(p.amount_paid)}</td>
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
            </div>
            <div className="cyber-modal-footer">
              <button className="btn-action-neon btn-primary" onClick={() => handleResume(selectedInvoice.id)}>
                <RotateCcw size={18} /> استئناف الفاتورة
              </button>
              <button className="btn-action-neon btn-secondary" onClick={closeModal}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteConfirm.show && deleteConfirm.invoice && (
        <div className="blur-overlay" onClick={() => setDeleteConfirm({ show: false, invoice: null })}>
          <div className="cyber-modal" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3 style={{ color: "#f87171" }}>تأكيد إلغاء الفاتورة</h3>
              <button className="modal-close-btn" onClick={() => setDeleteConfirm({ show: false, invoice: null })}><X size={20} /></button>
            </div>
            <div className="cyber-modal-body" style={{ textAlign: "center" }}>
              <AlertTriangle size={48} style={{ color: "#f87171", marginBottom: "16px" }} />
              <p style={{ marginBottom: "8px" }}>هل أنت متأكد من إلغاء الفاتورة رقم <strong>#{deleteConfirm.invoice.invoice_number}</strong> نهائياً؟</p>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>هذا الإجراء لا يمكن التراجع عنه، وسيتم حذف جميع بيانات الفاتورة.</p>
              <div className="cyber-modal-actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button className="cyber-btn-submit danger-bg" style={{ background: "#ef4444" }} onClick={handleCancelConfirmed}>
                  <Trash2 size={16} /> نعم، إلغاء الفاتورة
                </button>
                <button className="cyber-btn-dismiss" onClick={() => setDeleteConfirm({ show: false, invoice: null })}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit/Resume Invoice (CashierPage) */}
      {showEditModal && editInvoiceId && (
        <div className="blur-overlay" onClick={closeEditModal}>
          <div className="cyber-modal" style={{ maxWidth: "95%", width: "95%", maxHeight: "90vh", overflow: "auto", padding: "0" }} onClick={(e) => e.stopPropagation()}>
            <CashierPage 
              invoiceId={editInvoiceId} 
              onModalClose={closeEditModal} 
              showToast={showToast} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingInvoices;