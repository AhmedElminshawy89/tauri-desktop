import { useState } from "react";
import { getDb } from "../lib/db";
import {
  Search,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  Tag,
} from "lucide-react";

const ReturnsPage = ({ showToast }) => {
  const [searchInvoice, setSearchInvoice] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [itemsToReturn, setItemsToReturn] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearchInvoice = async () => {
    if (!searchInvoice) return showToast("برجاء إدخال رقم الفاتورة", "warning");

    try {
      setLoading(true);
      const db = await getDb();
      const invoice = await db.select(
        "SELECT * FROM invoices WHERE invoice_number = ?",
        [searchInvoice]
      );

      if (invoice.length === 0) {
        setInvoiceData(null);
        return showToast("الفاتورة غير موجودة", "error");
      }

      const inv = invoice[0];

      let discountFactor = 0;
      if (inv.total_before_discount > 0) {
        const discountAmount =
          inv.total_before_discount - inv.total_after_discount;
        discountFactor = discountAmount / inv.total_before_discount;
      }

      const items = await db.select(
        `SELECT 
            ii.*, 
            pv.size, 
            pv.color,
            (ii.quantity - IFNULL((SELECT SUM(r.quantity) FROM returns r WHERE r.invoice_id = ii.invoice_id AND r.variant_id = ii.variant_id), 0)) as remaining_qty
         FROM invoice_items ii 
         LEFT JOIN product_variants pv ON ii.variant_id = pv.id 
         WHERE ii.invoice_id = ?`,
        [inv.id]
      );

      const isFullyReturned = items.every((item) => item.remaining_qty <= 0);

      setInvoiceData({
        ...inv,
        isFullyReturned,
        effectiveDiscountRate: discountFactor,
      });

      setItemsToReturn(
        items.map((item) => ({
          ...item,
          returnQty: 0,
          priceAfterDiscount: item.unit_price * (1 - discountFactor),
        }))
      );

      if (isFullyReturned)
        showToast("هذه الفاتورة تم استرجاعها بالكامل", "info");
    } catch (err) {
      console.error(err);
      showToast("خطأ في جلب بيانات الفاتورة", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateReturnQty = (id, delta, maxQty) => {
    setItemsToReturn((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.returnQty + delta;
          if (newQty < 0 || newQty > maxQty) return item;
          return { ...item, returnQty: newQty };
        }
        return item;
      })
    );
  };

  const handleReturnAll = () => {
    setItemsToReturn((prev) =>
      prev.map((item) => ({ ...item, returnQty: item.remaining_qty }))
    );
  };

  const processReturn = async () => {
    const activeReturns = itemsToReturn.filter((i) => i.returnQty > 0);
    if (activeReturns.length === 0)
      return showToast("حدد أصناف للمرتجع", "warning");

    try {
      const db = await getDb();
      for (const item of activeReturns) {
        if (item.variant_id) {
          await db.execute(
            "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
            [item.returnQty, item.variant_id]
          );
        }
        await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [
          item.returnQty,
          item.product_id,
        ]);

        await db.execute(
          `INSERT INTO returns (invoice_id, product_id, variant_id, quantity, amount) VALUES (?, ?, ?, ?, ?)`,
          [
            invoiceData.id,
            item.product_id,
            item.variant_id || null,
            item.returnQty,
            item.returnQty * item.priceAfterDiscount,
          ]
        );
      }

      await db.execute("UPDATE invoices SET status = 'returned' WHERE id = ?", [
        invoiceData.id,
      ]);

      showToast("تم المرتجع بنجاح بالسعر الصافي بعد الخصم", "success");
      setInvoiceData(null);
      setSearchInvoice("");
    } catch (err) {
      showToast("خطأ في المعالجة", "error");
    }
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
        .btn-save {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-save:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .premium-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 10px 16px;
          color: #f1f5f9;
          font-size: 14px;
          width: 100%;
          outline: none;
          transition: all 0.2s;
        }
        .premium-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .discount-inputs {
          display: flex;
          gap: 12px;
          align-items: center;
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
        .badge-info {
          background: rgba(59,130,246,0.1);
          color: #60a5fa;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          margin-left: 4px;
        }
        .qty-control-pos {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }
        .qty-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.2s;
        }
        .qty-btn:hover {
          background: rgba(59,130,246,0.1);
          color: #60a5fa;
          border-color: #3b82f6;
        }
        .qty-val {
          font-weight: 600;
          min-width: 24px;
          text-align: center;
        }
        .summary-card-pos {
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          overflow: hidden;
          position: sticky;
          top: 20px;
        }
        .summary-header {
          background: rgba(239,68,68,0.1);
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f87171;
        }
        .summary-body {
          padding: 20px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 13px;
        }
        .info-item label {
          color: #94a3b8;
        }
        .divider-h {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 12px 0;
        }
        .calc-item {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 600;
        }
        .alert-box-info {
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 10px;
          padding: 12px;
          font-size: 12px;
          color: #60a5fa;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .summary-footer {
          padding: 16px 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .full-width {
          width: 100%;
          justify-content: center;
        }
        .alert-box-danger {
          background: rgba(239,68,68,0.05);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">إدارة المرتجعات</h2>
          <p className="sub-title">إرجاع الفواتير مع مراعاة نسب الخصم المطبقة</p>
        </div>
        <div className="discount-inputs">
          <input
            type="text"
            placeholder="رقم الفاتورة..."
            value={searchInvoice}
            onChange={(e) => setSearchInvoice(e.target.value)}
            className="premium-input"
            style={{ width: "250px" }}
          />
          <button
            onClick={handleSearchInvoice}
            className="btn-save"
            disabled={loading}
          >
            <Search size={16} /> بحث
          </button>
        </div>
      </div>

      {invoiceData && !invoiceData.isFullyReturned && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.5fr 1fr",
            gap: "24px",
            marginTop: "8px",
          }}
        >
          <div className="cyber-table-container">
            <div className="cyber-table">
              <table className="cyber-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>السعر (صافي)</th>
                    <th>المتبقي</th>
                    <th className="text-center">كمية المرتجع</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsToReturn.map(
                    (item) =>
                      item.remaining_qty > 0 && (
                        <tr key={item.id} className="cyber-row-main">
                          <td>
                            <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                              {item.product_name}
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {item.size && (
                                <span className="badge-info">مقاس: {item.size}</span>
                              )}
                              {item.color && (
                                <span className="badge-info">لون: {item.color}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div
                              style={{
                                fontSize: "12px",
                                textDecoration: "line-through",
                                color: "#64748b",
                              }}
                            >
                              {item.unit_price} ج.م
                            </div>
                            <span style={{ color: "#34d399", fontWeight: 600 }}>
                              {item.priceAfterDiscount.toFixed(2)} ج.م
                            </span>
                          </td>
                          <td className="num-primary">{item.remaining_qty}</td>
                          <td className="text-center">
                            <div className="qty-control-pos">
                              <button
                                className="qty-btn"
                                onClick={() =>
                                  updateReturnQty(item.id, -1, item.remaining_qty)
                                }
                              >
                                -
                              </button>
                              <span className="qty-val">{item.returnQty}</span>
                              <button
                                className="qty-btn"
                                onClick={() =>
                                  updateReturnQty(item.id, 1, item.remaining_qty)
                                }
                              >
                                +
                              </button>
                            </div>
                           </td>
                          <td className="num-success">
                            {(item.returnQty * item.priceAfterDiscount).toFixed(
                              2
                            )}{" "}
                            ج.م
                           </td>
                         </tr>
                      )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="summary-card-pos">
            <div className="summary-header">
              <RotateCcw size={18} /> ملخص الاسترداد
            </div>
            <div className="summary-body">
              <div className="info-item">
                <label>إجمالي الفاتورة الأصلي:</label>
                <span>{invoiceData.total_before_discount} ج.م</span>
              </div>
              <div className="info-item" style={{ color: "#f87171" }}>
                <label>خصم الفاتورة المطبق:</label>
                <span>
                  -{" "}
                  {(
                    invoiceData.total_before_discount -
                    invoiceData.total_after_discount
                  ).toFixed(2)}{" "}
                  ج.م
                </span>
              </div>
              <div className="divider-h"></div>
              <div className="calc-item" style={{ color: "#f97316", marginBottom: "8px" }}>
                <span>المبلغ المسترد الآن:</span>
                <span>
                  {itemsToReturn
                    .reduce(
                      (acc, i) => acc + i.returnQty * i.priceAfterDiscount,
                      0
                    )
                    .toFixed(2)}{" "}
                  ج.م
                </span>
              </div>
              <div className="alert-box-info">
                <Tag size={14} /> تم توزيع خصم الفاتورة بنسبة{" "}
                {(invoiceData.effectiveDiscountRate * 100).toFixed(1)}% على
                الأصناف المسترجعة لضمان دقة الحسابات.
              </div>
            </div>
            <div className="summary-footer">
              <button
                className="btn-save full-width"
                style={{ background: "#be123c" }}
                onClick={processReturn}
              >
                <RotateCcw size={16} /> تأكيد عملية المرتجع
              </button>
              <button
                className="btn-save full-width"
                style={{ background: "#475569" }}
                onClick={handleReturnAll}
              >
                تحديد كل الكميات المتاحة
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceData?.isFullyReturned && (
        <div className="alert-box-danger">
          <CheckCircle2 size={48} style={{ color: "#f87171", margin: "0 auto 16px" }} />
          <h3 style={{ marginBottom: "8px" }}>الفاتورة مسترجعة بالكامل</h3>
          <p style={{ color: "#64748b" }}>لا يمكن إجراء مرتجع جديد لهذه الفاتورة.</p>
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;