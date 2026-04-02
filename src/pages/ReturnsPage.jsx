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

  // 1. البحث وحساب المتبقي مع مراعاة نسبة الخصم
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

      // حساب نسبة الخصم الفعلية للفاتورة
      // نسبة الخصم = (قيمة الخصم / الإجمالي قبل الخصم)
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
        effectiveDiscountRate: discountFactor, // حفظ النسبة لاستخدامها في الحساب
      });

      setItemsToReturn(
        items.map((item) => ({
          ...item,
          returnQty: 0,
          // سعر القطعة بعد الخصم = السعر الأصلي * (1 - نسبة الخصم)
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
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">إدارة المرتجعات</h2>
          <p className="sub-title">
            إرجاع الفواتير مع مراعاة نسب الخصم المطبقة
          </p>
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
            بحث
          </button>
        </div>
      </div>

      {invoiceData && !invoiceData.isFullyReturned && (
        <div
          className="form-grid-layout"
          style={{ gridTemplateColumns: "2.5fr 1fr", gap: "20px" }}
        >
          <div className="left-column">
            <div className="flex justify-between items-center mb-4">
              <h4 style={{ color: "var(--text-main)" }}>
                الأصناف المتاحة (الأسعار شاملة الخصم):
              </h4>
            </div>

            <div className="table-wrapper-premium">
              <table className="custom-table">
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
                        <tr key={item.id} className="table-row">
                          <td>
                            <div style={{ fontWeight: "600" }} className="mb-1">
                              {item.product_name}
                            </div>
                            <div className="flex gap-1">
                              {item.size && (
                                <span className="badge-info">
                                  المقاس : {item.size}
                                </span>
                              )}
                              {item.color && (
                                <span className="badge-info">
                                  اللون : {item.color}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ color: "#059669" }}>
                            <div
                              style={{
                                fontSize: "14px",
                                textDecoration: "line-through",
                                color: "#94a3b8",
                              }}
                            >
                              {item.unit_price} ج.م
                            </div>
                            {item.priceAfterDiscount.toFixed(2)} ج.م
                          </td>
                          <td className="bold-text">{item.remaining_qty}</td>
                          <td>
                            <div
                              className="qty-control-pos"
                              style={{ margin: "0 auto" }}
                            >
                              <button
                                className="qty-btn"
                                onClick={() =>
                                  updateReturnQty(
                                    item.id,
                                    -1,
                                    item.remaining_qty
                                  )
                                }
                              >
                                -
                              </button>
                              <span className="qty-val">{item.returnQty}</span>
                              <button
                                className="qty-btn"
                                onClick={() =>
                                  updateReturnQty(
                                    item.id,
                                    1,
                                    item.remaining_qty
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td
                            className="bold-text"
                          >
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

          <div
            className="summary-card-pos"
            style={{ position: "sticky", top: "20px" }}
          >
            <div className="summary-header" >
              <RotateCcw size={18} /> ملخص الاسترداد
            </div>
            <div className="summary-body">
              <div className="info-item mb-1">
                <label>إجمالي الفاتورة الأصلي:</label>
                <span>{invoiceData.total_before_discount} ج.م</span>
              </div>
              <div className="info-item mb-1" style={{ color: "#e11d48", fontWeight: "600" ,fontSize:'14px'}}>
                <label>خصم الفاتورة المطبق:</label>
                <span >
                  -{" "}
                  {(
                    invoiceData.total_before_discount -
                    invoiceData.total_after_discount
                  ).toFixed(2)}{" "}
                  ج.م
                </span>
              </div>
              <div className="divider-h"></div>
              <div className="calc-item total mb-1" style={{ color: "#e11d48", fontWeight: "600" ,fontSize:'14px'}}>
                <span>المبلغ المسترد الآن:</span>
                <span >
                  {itemsToReturn
                    .reduce(
                      (acc, i) => acc + i.returnQty * i.priceAfterDiscount,
                      0
                    )
                    .toFixed(2)}{" "}
                  ج.م
                </span>
              </div>
              <div
                className="alert-box-info"
                style={{ marginTop: "15px", fontSize: "11px" }}
              >
                <Tag size={12} /> تم توزيع خصم الفاتورة بنسبة{" "}
                {(invoiceData.effectiveDiscountRate * 100).toFixed(1)}% على
                الأصناف المسترجعة لضمان دقة الحسابات.
              </div>
            </div>
<div className="summary-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
  
  <button
    className="btn-save full-width"
    style={{ 
      background: "#be123c", 
      fontWeight: "bold",
      boxShadow: "0 4px 6px -1px rgba(190, 18, 60, 0.2)" 
    }}
    onClick={processReturn}
  >
    تأكيد عملية المرتجع
  </button>

  <button  
    className="btn-save full-width"
    style={{ 
      background: "#475569", 
      border: "1px solid #334155" 
    }}
    onClick={handleReturnAll}
  >
    تحديد كل الكميات المتاحة
  </button>

</div>
          </div>
        </div>
      )}

      {invoiceData?.isFullyReturned && (
        <div
          className="alert-box-danger"
          style={{ textAlign: "center", padding: "40px" }}
        >
          <CheckCircle2
            size={48}
            style={{ color: "#ef4444", margin: "0 auto 15px" }}
          />
          <h3>الفاتورة مسترجعة بالكامل</h3>
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;
