import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const PendingInvoices = ({ showToast }) => {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, invoice: null });
  const navigate = useNavigate();

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
    navigate(`/cashier/edit/${invoiceId}`);
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
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={28} style={{ color: "#f59e0b" }} />
            <h2 className="main-title">الفواتير المعلقة</h2>
          </div>
          <p className="sub-title">استئناف أو عرض تفاصيل الفواتير التي لم تُكتمل</p>
        </div>
        <div className="header-actions-group">
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-select"
              style={{ width: 280, paddingRight: 36 }}
            />
            <Search size={15} style={{ position: "absolute", right: 12, top: 13, color: "#94a3b8" }} />
          </div>
          <button className="btn-save" onClick={fetchPendingInvoices}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      <div className="table-wrapper-premium">
        <table className="custom-table">
          <thead>
            <tr>
              <th><Hash size={16} /> رقم الفاتورة</th>
              <th><User size={16} /> العميل</th>
              <th>البائع</th>
              <th>الإجمالي</th>
              <th>تاريخ الإنشاء</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center" style={{ padding: 50 }}>جاري التحميل...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center" style={{ padding: 50 }}>لا توجد فواتير معلقة</td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td><span className="id-badge">#{inv.invoice_number}</span></td>
                  <td>{inv.customer_name || "عميل نقدي"}</td>
                  <td>{inv.seller_name || "—"}</td>
                  <td className="bold-text">{fmt(inv.total_after_discount)}</td>
                  <td>{new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
                  <td className="actions-cell-premium" style={{ gap: "8px" }}>
                    <button
                      className="action-btn view"
                      onClick={() => fetchInvoiceDetails(inv)}
                      title="عرض التفاصيل"
                      style={{ background: "#3b82f6" }}
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      className="action-btn edit"
                      onClick={() => handleResume(inv.id)}
                      title="استئناف الفاتورة"
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => setDeleteConfirm({ show: true, invoice: inv })}
                      title="إلغاء الفاتورة"
                      style={{ background: "#ef4444" }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for invoice details */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content-premium" style={{ maxWidth: "900px", width: "95%", maxHeight: "90vh", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: "space-between" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Receipt size={20} />
                تفاصيل الفاتورة المعلقة #{selectedInvoice.invoice_number}
              </h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", maxHeight: "calc(90vh - 80px)" }}>
              {loadingDetails ? (
                <div style={{ textAlign: "center", padding: "40px" }}>جاري تحميل التفاصيل...</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><User size={14} /> بيانات العميل</h4>
                      <div><User size={12} /> الاسم: {selectedInvoice.customer_name || "عميل نقدي"}</div>
                      <div><Phone size={12} /> الهاتف: {selectedInvoice.customer_phone || "—"}</div>
                      <div><MapPin size={12} /> العنوان: {selectedInvoice.customer_address || "—"}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><FileText size={14} /> بيانات الفاتورة</h4>
                      <div><Calendar size={12} /> التاريخ: {new Date(selectedInvoice.created_at).toLocaleDateString("ar-EG")}</div>
                      <div><HandCoins size={12} /> طريقة الدفع: {selectedInvoice.payment_method === "cash" ? "كاش" : selectedInvoice.payment_method === "visa" ? "فيزا" : "تقسيط"}</div>
                      <div><AlertCircle size={12} /> الحالة: معلقة</div>
                      <div><User size={12} /> البائع: {selectedInvoice.seller_name || "—"}</div>
                    </div>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><DollarSign size={14} /> الملخص المالي</h4>
                    <div>إجمالي قبل الخصم: {fmt(selectedInvoice.total_before_discount)}</div>
                    {selectedInvoice.discount_value > 0 && (
                      <div>الخصم: - {selectedInvoice.discount_type === "percent" ? `${selectedInvoice.discount_value}%` : fmt(selectedInvoice.discount_value)}</div>
                    )}
                    <div style={{ fontWeight: "bold", marginTop: "8px" }}>الصافي النهائي: {fmt(selectedInvoice.total_after_discount)}</div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><Package size={14} /> الأصناف المشتراة</h4>
                    <div className="table-wrapper-premium" style={{ boxShadow: "none" }}>
                      <table className="custom-table" style={{ fontSize: "13px" }}>
                        <thead>
                          <tr>
                            <th>الصنف</th>
                            <th>المقاس/اللون</th>
                            <th>الكمية</th>
                            <th>سعر الوحدة</th>
                            <th>الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetails?.items?.length > 0 ? (
                            invoiceDetails.items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.product_name}</td>
                                <td>{item.size || "—"} / {item.color || "—"}</td>
                                <td>{item.quantity}</td>
                                <td>{fmt(item.unit_price)}</td>
                                <td className="bold-text">{fmt(item.quantity * item.unit_price)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="text-center">لا توجد أصناف مسجلة</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {invoiceDetails?.payments?.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                      <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><HandCoins size={14} /> سجل المدفوعات</h4>
                      <div className="table-wrapper-premium" style={{ boxShadow: "none" }}>
                        <table className="custom-table" style={{ fontSize: "13px" }}>
                          <thead>
                            <tr>
                              <th>تاريخ الدفع</th>
                              <th>المبلغ</th>
                              <th>الملاحظات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceDetails.payments.map((p, idx) => (
                              <tr key={idx}>
                                <td>{new Date(p.payment_date).toLocaleString("ar-EG")}</td>
                                <td className="bold-text">{fmt(p.amount_paid)}</td>
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

            <div className="modal-footer" style={{ justifyContent: "space-between", gap: "12px" }}>
              <button className="btn-save" onClick={() => handleResume(selectedInvoice.id)}>
                <RotateCcw size={18} /> استئناف الفاتورة
              </button>
              <button className="btn-cancel" onClick={closeModal}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.invoice && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ show: false, invoice: null })}>
          <div className="modal-content-premium" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon red" style={{ background: "rgba(239,68,68,0.1)", borderRadius: "50%", padding: "10px", display: "inline-flex" }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <h3>تأكيد إلغاء الفاتورة</h3>
            </div>
            <div style={{ padding: "20px" }}>
              <p style={{ marginBottom: "8px" }}>هل أنت متأكد من إلغاء الفاتورة رقم <strong>#{deleteConfirm.invoice.invoice_number}</strong> نهائياً؟</p>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>هذا الإجراء لا يمكن التراجع عنه، وسيتم حذف جميع بيانات الفاتورة.</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between", gap: "12px" }}>
              <button className="btn-save" style={{ background: "#ef4444", color: "white" }} onClick={handleCancelConfirmed}>
                <Trash2 size={16} /> نعم، إلغاء الفاتورة
              </button>
              <button className="btn-cancel" onClick={() => setDeleteConfirm({ show: false, invoice: null })}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingInvoices;