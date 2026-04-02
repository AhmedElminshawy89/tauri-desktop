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
} from "lucide-react";

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

      // معالجة البيانات مع حماية كاملة ضد الـ JSON التالف أو القديم
      const parsedResults = results.map((inv) => {
        let details = { items: [], returns: [] };
        try {
          if (inv.items_json) {
            const parsed = JSON.parse(inv.items_json);
            // التأكد أن البيانات المحولة تحتوي على المصفوفات المطلوبة
            details = {
              items: parsed.items || [],
              returns: parsed.returns || [],
            };
          }
        } catch (e) {
          console.error(
            "Error parsing items for invoice:",
            inv.invoice_number,
            e
          );
        }
        return { ...inv, details };
      });

      setDeletedInvoices(parsedResults);
    } catch (err) {
      showToast("خطأ في جلب سجل المحذوفات", "error");
    } finally {
      setLoading(false);
    }
  };

  // منطق البحث المتقدم
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
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">أرشيف المحذوفات التفصيلي</h2>
          <p className="sub-title">
            مراجعة كاملة للمنتجات والمرتجعات للفواتير الملغاة
          </p>
        </div>

        <div className="header-actions-group">
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة أو العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-select"
              style={{
                width: "320px",
                paddingRight: "40px",
                border: "1px solid #fff",
              }}
            />
            <Search
              size={18}
              style={{
                position: "absolute",
                right: "12px",
                top: "15px",
                color: "#fff",
              }}
            />
          </div>

          <div className="divider-v"></div>

          <button className="btn-save" onClick={fetchDeletedInvoices}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            <span>تحديث السجل</span>
          </button>
        </div>
      </div>

      <div className="table-wrapper-premium">
        <table className="custom-table">
          <thead>
            <tr>
              <th>
                <Hash size={16} className="inline-icon" /> رقم الفاتورة
              </th>
              <th>
                <User size={16} className="inline-icon" /> العميل
              </th>
              <th>الإجمالي الملغى</th>
              <th>تاريخ الحذف</th>
              <th>سبب الحذف</th>
              <th style={{ textAlign: "center" }}>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center">
                  جاري تحميل الأرشيف...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="text-center"
                  style={{ padding: "40px", color: "#94a3b8" }}
                >
                  لا توجد بيانات متاحة
                </td>
              </tr>
            ) : (
              filteredData.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td>
                    <span className="id-badge-red">#{inv.invoice_number}</span>
                  </td>
                  <td className="username-cell">
                    {inv.customer_name || "عميل نقدي"}
                  </td>
                  <td className="bold-text">
                    {inv.total_amount?.toLocaleString()} ج.م
                  </td>
                  <td>{new Date(inv.deleted_at).toLocaleString("ar-EG")}</td>
                  <td>
                    <div className="reason-tag" title={inv.reason}>
                      {inv.reason}
                    </div>
                  </td>
                  <td className="actions-cell-premium">
                    <button
                      className="action-btn edit"
                      onClick={() => setSelectedInvoice(inv)}
                      title="عرض التفاصيل"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* مودال التفاصيل المتقدم */}
      {selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target.className === "modal-overlay" && closeModal()
          }
        >
          <div
            className="modal-content-premium shadow-2xl"
            style={{ maxWidth: "750px", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h3
                style={{
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <AlertCircle size={22} />
                تفاصيل الفاتورة المحذوفة #{selectedInvoice.invoice_number}
              </h3>
            </div>

            <div className="premium-form">
              <div className="info-card-red-flat">
                <div className="info-grid">
                  <div className="info-item">
                    <span>العميل:</span>{" "}
                    <strong>
                      {selectedInvoice.customer_name || "عميل نقدي"}
                    </strong>
                  </div>
                  <div className="info-item">
                    <span>المبلغ الملغى:</span>{" "}
                    <strong className="text-red">
                      {selectedInvoice.total_amount?.toLocaleString()} ج.م
                    </strong>
                  </div>
                  <div className="info-item">
                    <span>وقت الحذف:</span>{" "}
                    <strong>
                      {new Date(selectedInvoice.deleted_at).toLocaleString(
                        "ar-EG"
                      )}
                    </strong>
                  </div>
                </div>
                <div className="reason-full-box">
                  <strong>سبب الحذف الأساسي:</strong>
                  <p>{selectedInvoice.reason || "لم يتم ذكر سبب"}</p>
                </div>
              </div>

              {/* جدول المنتجات */}
              <div
                className="section-header-mini"
                style={{ color: "#ef4444", marginTop: "25px" }}
              >
                <ShoppingBag size={18} />
                <h4>المنتجات التي كانت بالفاتورة</h4>
              </div>
              <table className="mini-details-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th className="text-center">الكمية</th>
                    <th className="text-center">السعر</th>
                    <th className="text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.details?.items &&
                  selectedInvoice.details.items.length > 0 ? (
                    selectedInvoice.details.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.product_name}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-center">
                          {item.unit_price?.toLocaleString()} ج.م
                        </td>
                        <td className="text-center font-bold">
                          {(item.quantity * item.unit_price)?.toLocaleString()}{" "}
                          ج.م
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center"
                        style={{ padding: "30px", color: "#94a3b8" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <AlertCircle size={20} />
                          <span>
                            لا توجد تفاصيل أصناف مخزنة لهذه الفاتورة (بيانات
                            قديمة)
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* سجل المرتجعات */}
              {selectedInvoice.details?.returns?.length > 0 && (
                <div style={{ marginTop: "25px" }}>
                  <div
                    className="section-header-mini"
                    style={{ color: "#f59e0b" }}
                  >
                    <RotateCcw size={18} />
                    <h4>مرتجعات تمت قبل الحذف</h4>
                  </div>
                  <table className="mini-details-table returns">
                    <thead>
                      <tr>
                        <th>تاريخ المرتجع</th>
                        <th className="text-center">المبلغ المسترد</th>
                        <th>ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.details.returns.map((ret, i) => (
                        <tr key={i}>
                          <td>
                            {new Date(ret.created_at).toLocaleDateString(
                              "ar-EG"
                            )}
                          </td>
                          <td className="text-center text-orange font-bold">
                            {ret.amount?.toLocaleString()} ج.م
                          </td>
                          <td>{ret.notes || "تلقائي"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: "30px" }}>
                <button
                  className="btn-cancel"
                  style={{ width: "100%", padding: "12px" }}
                  onClick={closeModal}
                >
                  إغلاق السجل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .id-badge-red { padding: 4px 10px;background: rgba(30, 41, 59, 0.4); color: #fff; border-radius: 6px; font-weight: 700; border: 1px solid var(--card-bg);}
        .reason-tag { padding: 6px 12px; background: rgba(30, 41, 59, 0.4); color: #fff; border-radius: 6px; font-size: 12px; max-width: auto;border: 1px solid var(--card-bg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .info-card-red-flat {  border: 1px solid #fff; border-radius: 12px; padding: 20px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px; }
        .info-item span { display: block; font-size: 12px; color: #fff; }
        .reason-full-box { background: rgba(30, 41, 59, 0.4); padding: 12px; border-radius: 8px; border-right: 4px solid #fff; margin-top: 10px; }
        .reason-full-box p { margin-top: 5px; font-size: 14px; color: #fff; }
        .section-header-mini { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        .mini-details-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .mini-details-table th,.mini-details-table.returns th { background: rgba(30, 41, 59, 0.4); padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: right; color: #eee; }
        .mini-details-table td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; }
        .text-red { color: #fff; }
        .text-orange { color: #fff; }
        .font-bold { font-weight: bold; }
        .inline-icon { vertical-align: middle; margin-left: 4px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `,
        }}
      />
    </div>
  );
};

export default DeletedInvoices;
