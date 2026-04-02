import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Search,
  Printer,
  Eye,
  Trash2,
  HandCoins,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Repeat,
  User,
  Phone,
  MapPin,
  Tag,
  Calendar,
  RotateCcw,
  Receipt,
  Percent,
} from "lucide-react";

// ─── ثوابت ───────────────────────────────────────────────────────────────────

const PAYMENT_MAP = {
  cash: {
    label: "كاش",
    icon: <HandCoins size={13} />,
    bg: "#dcfce7",
    text: "#166534",
    border: "#bbf7d0",
  },
  visa: {
    label: "فيزا",
    icon: <CreditCard size={13} />,
    bg: "#e0e7ff",
    text: "#3730a3",
    border: "#c7d2fe",
  },
  installment: {
    label: "تقسيط",
    icon: <Repeat size={13} />,
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
  },
};

// ─── حساب الحالة الفعلية للفاتورة ────────────────────────────────────────────
// نحسبها من الأرقام الحقيقية، مش نعتمد على الـ status المخزن بس
const deriveStatus = (invoice, totalReturned) => {
  const total = Number(invoice.total_after_discount) || 0;
  const returned = Number(totalReturned) || 0;

  if (returned <= 0) {
    return invoice.status === "pending" ? "pending" : "completed";
  }
  if (returned >= total) return "returned";      // مرتجع كلي
  return "partial_returned";                      // مرتجع جزئي
};

const STATUS_MAP = {
  completed: {
    label: "مكتملة",
    bg: "#dcfce7",
    text: "#166534",
    border: "#bbf7d0",
  },
  pending: {
    label: "معلقة",
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
  },
  partial_returned: {
    label: "مرتجع جزئي",
    bg: "#dbeafe",
    text: "#1e40af",
    border: "#bfdbfe",
  },
  returned: {
    label: "مرتجع كلي",
    bg: "#fee2e2",
    text: "#991b1b",
    border: "#fecaca",
  },
};

// ─── مكوّن Badge ──────────────────────────────────────────────────────────────
const Badge = ({ bg, text, border, icon, label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "4px 11px",
      borderRadius: "50px",
      fontSize: "12px",
      fontWeight: "700",
      backgroundColor: bg,
      color: text,
      border: `1px solid ${border}`,
    }}
  >
    {icon}
    {label}
  </span>
);

// ─── صف معلومة داخل المودال ───────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, valueStyle = {} }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}
  >
    <span style={{ color: "#94a3b8", flexShrink: 0 }}>{icon}</span>
    <span style={{ color: "#94a3b8", minWidth: "150px", fontSize: "13px" }}>
      {label}
    </span>
    <span style={{ fontWeight: "600", ...valueStyle }}>{value}</span>
  </div>
);

// ─── عنوان قسم داخل المودال ───────────────────────────────────────────────────
const SectionTitle = ({ label, color = "#94a3b8" }) => (
  <p
    style={{
      color,
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "1px",
      marginBottom: "10px",
    }}
  >
    {label}
  </p>
);

const SectionBox = ({ children, borderColor = "rgba(255,255,255,0.08)" }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${borderColor}`,
      borderRadius: "12px",
      padding: "16px",
    }}
  >
    {children}
  </div>
);

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
const SalesLog = ({ showToast }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    invoice: null,
    reason: "",
  });

  useEffect(() => {
    fetchInvoices();
  }, [filterDate]);

  // ─── جلب الفواتير + مجموع المرتجعات لكل فاتورة بـ subquery ───────────────
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      let query = `
        SELECT i.*,
               COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.invoice_id = i.id), 0) AS total_returned
        FROM invoices i
        ORDER BY i.id DESC
      `;
      let params = [];

      if (filterDate) {
        query = `
          SELECT i.*,
                 COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.invoice_id = i.id), 0) AS total_returned
          FROM invoices i
          WHERE date(i.created_at) = ?
          ORDER BY i.id DESC
        `;
        params = [filterDate];
      }

      const results = await db.select(query, params);
      setInvoices(results);
    } catch (err) {
      showToast("خطأ في جلب البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── جلب تفاصيل فاتورة كاملة ─────────────────────────────────────────────
  const showDetails = async (invoice) => {
    try {
      const db = await getDb();

      const items = await db.select(
        `SELECT ii.*, pv.size, pv.color 
         FROM invoice_items ii 
         LEFT JOIN product_variants pv ON ii.variant_id = pv.id 
         WHERE ii.invoice_id = ?`,
        [invoice.id]
      );

      const returnsDetails = await db.select(
        `SELECT r.*, p.name AS product_name, pv.size, pv.color
         FROM returns r
         LEFT JOIN products p ON r.product_id = p.id
         LEFT JOIN product_variants pv ON r.variant_id = pv.id
         WHERE r.invoice_id = ?`,
        [invoice.id]
      );

      const paymentHistory = await db.select(
        `SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date ASC`,
        [invoice.id]
      );

      const installmentPlan = await db.select(
        `SELECT * FROM installment_plan WHERE invoice_id = ? ORDER BY due_date ASC`,
        [invoice.id]
      );

      const totalReturned = returnsDetails.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0
      );
      const totalActualPaid = paymentHistory.reduce(
        (s, p) => s + (Number(p.amount_paid) || 0),
        0
      );

      // حساب الكمية المرتجعة لكل صنف/variant
      const returnedQtyMap = {};
      returnsDetails.forEach((r) => {
        const key = `${r.product_id}-${r.variant_id ?? "null"}`;
        returnedQtyMap[key] = (returnedQtyMap[key] || 0) + (Number(r.quantity) || 0);
      });

      const itemsAfterReturn = items.map((item) => {
        const key = `${item.product_id}-${item.variant_id ?? "null"}`;
        const retQty = returnedQtyMap[key] || 0;
        const netQty = Math.max(0, (Number(item.quantity) || 0) - retQty);
        return { ...item, returned_qty: retQty, net_qty: netQty };
      });

      setSelectedInvoice({
        ...invoice,
        items,
        itemsAfterReturn,
        returnsDetails,
        paymentHistory,
        installmentPlan,
        totalReturned,
        totalActualPaid,
      });
    } catch (err) {
      showToast("خطأ في تحميل التفاصيل", "error");
    }
  };

  // ─── حذف فاتورة ──────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteModal.reason.trim())
      return showToast("يرجى كتابة سبب الحذف", "warning");
    try {
      const db = await getDb();
      const inv = deleteModal.invoice;
      const items = await db.select(
        "SELECT * FROM invoice_items WHERE invoice_id = ?",
        [inv.id]
      );
      const snapshot = JSON.stringify({ items });

      await db.execute(
        "INSERT INTO deleted_invoices (invoice_id, invoice_number, customer_name, total_amount, reason, items_json) VALUES (?, ?, ?, ?, ?, ?)",
        [
          inv.id,
          inv.invoice_number,
          inv.customer_name || "عميل نقدي",
          inv.total_after_discount,
          deleteModal.reason,
          snapshot,
        ]
      );

      for (const item of items) {
        await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [
          item.quantity,
          item.product_id,
        ]);
      }
      await db.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [inv.id]);
      await db.execute("DELETE FROM invoices WHERE id = ?", [inv.id]);

      showToast("تم الحذف بنجاح", "success");
      setDeleteModal({ show: false, invoice: null, reason: "" });
      fetchInvoices();
    } catch (err) {
      showToast("خطأ في التنفيذ", "error");
    }
  };

  const closeModal = () => setSelectedInvoice(null);

  const filtered = invoices.filter(
    (inv) =>
      (inv.invoice_number || "").includes(searchTerm) ||
      (inv.customer_name || "").includes(searchTerm)
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fade-in" dir="rtl">

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">سجل المبيعات</h2>
          <p className="sub-title">إدارة الفواتير والتحصيلات المالية</p>
        </div>
        <div className="header-actions-group">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="premium-select"
          />
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-select"
              style={{ width: "250px", paddingRight: "35px" }}
            />
            <Search
              size={16}
              style={{ position: "absolute", right: "12px", top: "12px", color: "#94a3b8" }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper-premium">
        <table className="custom-table">
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>نظام الدفع</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center">جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" className="text-center">لا توجد فواتير</td></tr>
            ) : (
              filtered.map((inv) => {
                const pmConfig = PAYMENT_MAP[inv.payment_method] || PAYMENT_MAP.cash;
                const derivedStatus = deriveStatus(inv, inv.total_returned);
                const stConfig = STATUS_MAP[derivedStatus] || STATUS_MAP.completed;

                return (
                  <tr key={inv.id} className="table-row">
                    <td><span className="id-badge">#{inv.invoice_number}</span></td>
                    <td>{inv.customer_name || "عميل نقدي"}</td>
                    <td>
                      <Badge
                        {...pmConfig}
                        label={
                          inv.payment_method === "installment"
                            ? `تقسيط (${inv.installments_count})`
                            : pmConfig.label
                        }
                      />
                    </td>
                    <td className="bold-text">
                      {(inv.total_after_discount || 0).toLocaleString()} ج.م
                    </td>
                    <td><Badge {...stConfig} /></td>
                    <td>{new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="actions-cell-premium">
                      <button className="action-btn edit" onClick={() => showDetails(inv)}>
                        <Eye size={18} />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => setDeleteModal({ show: true, invoice: inv, reason: "" })}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          مودال التفاصيل
      ══════════════════════════════════════════════════════════════════════════ */}
      {selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target.className === "modal-overlay" && closeModal()}
        >
          <div
            className="modal-content-premium"
            style={{ maxWidth: "960px", width: "95%" }}
          >
            <div className="modal-header">
              <h3>
                <Receipt size={18} style={{ display: "inline", marginLeft: "8px" }} />
                تفاصيل فاتورة #{selectedInvoice.invoice_number}
              </h3>
            </div>

            <div
              className="premium-form"
              style={{
                padding: "20px",
                maxHeight: "82vh",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >

              {/* ── بيانات العميل + الفاتورة ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                <SectionBox>
                  <SectionTitle label="بيانات العميل" />
                  <InfoRow icon={<User size={15} />} label="الاسم"
                    value={selectedInvoice.customer_name || "عميل نقدي"} />
                  <InfoRow icon={<Phone size={15} />} label="التليفون"
                    value={selectedInvoice.customer_phone || "—"} />
                  <InfoRow icon={<MapPin size={15} />} label="العنوان"
                    value={selectedInvoice.customer_address || "—"} />
                </SectionBox>

                <SectionBox>
                  <SectionTitle label="بيانات الفاتورة" />
                  <InfoRow
                    icon={<Calendar size={15} />}
                    label="التاريخ"
                    value={new Date(selectedInvoice.created_at).toLocaleDateString("ar-EG", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  />
                  <InfoRow
                    icon={<HandCoins size={15} />}
                    label="نظام الدفع"
                    value={
                      <Badge
                        {...(PAYMENT_MAP[selectedInvoice.payment_method] || PAYMENT_MAP.cash)}
                        label={
                          selectedInvoice.payment_method === "installment"
                            ? `تقسيط (${selectedInvoice.installments_count} قسط)`
                            : (PAYMENT_MAP[selectedInvoice.payment_method] || PAYMENT_MAP.cash).label
                        }
                      />
                    }
                  />
                  <InfoRow
                    icon={<Tag size={15} />}
                    label="الحالة"
                    value={
                      <Badge
                        {...(STATUS_MAP[deriveStatus(selectedInvoice, selectedInvoice.totalReturned)]
                          || STATUS_MAP.completed)}
                      />
                    }
                  />
                </SectionBox>
              </div>

              {/* ── الملخص المالي ── */}
              <SectionBox>
                <SectionTitle label="الملخص المالي" />

                <InfoRow
                  icon={<Receipt size={15} />}
                  label="إجمالي قبل الخصم"
                  value={`${(selectedInvoice.total_before_discount || 0).toLocaleString()} ج.م`}
                />

                {(selectedInvoice.discount_value || 0) > 0 && (
                  <InfoRow
                    icon={<Percent size={15} />}
                    label={
                      selectedInvoice.discount_type === "percent"
                        ? `خصم ${selectedInvoice.discount_value}%`
                        : "خصم (مبلغ ثابت)"
                    }
                    value={`- ${(
                      selectedInvoice.discount_type === "percent"
                        ? ((selectedInvoice.total_before_discount || 0) * selectedInvoice.discount_value) / 100
                        : selectedInvoice.discount_value
                    ).toLocaleString()} ج.م`}
                    valueStyle={{ color: "#f87171" }}
                  />
                )}

                <InfoRow
                  icon={<CheckCircle2 size={15} />}
                  label="إجمالي بعد الخصم"
                  value={`${(selectedInvoice.total_after_discount || 0).toLocaleString()} ج.م`}
                  valueStyle={{ color: "#34d399", fontSize: "15px" }}
                />

                {(selectedInvoice.totalReturned || 0) > 0 && (
                  <InfoRow
                    icon={<RotateCcw size={15} />}
                    label="إجمالي المرتجعات"
                    value={`- ${(selectedInvoice.totalReturned || 0).toLocaleString()} ج.م`}
                    valueStyle={{ color: "#fb923c" }}
                  />
                )}

                <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />

                {selectedInvoice.payment_method === "installment" ? (
                  <>
                    <InfoRow
                      icon={<HandCoins size={15} />}
                      label="مقدم عند التعاقد"
                      value={`${(selectedInvoice.paid_amount || 0).toLocaleString()} ج.م`}
                      valueStyle={{ color: "#34d399" }}
                    />
                    <InfoRow
                      icon={<Repeat size={15} />}
                      label="أقساط محصلة لاحقاً"
                      value={`${Math.max(
                        0,
                        (selectedInvoice.totalActualPaid || 0) - (selectedInvoice.paid_amount || 0)
                      ).toLocaleString()} ج.م`}
                      valueStyle={{ color: "#60a5fa" }}
                    />
                    <InfoRow
                      icon={<AlertCircle size={15} />}
                      label="المتبقي النهائي"
                      value={`${Math.max(
                        0,
                        (selectedInvoice.total_after_discount || 0)
                          - (selectedInvoice.totalActualPaid || 0)
                          - (selectedInvoice.totalReturned || 0)
                      ).toLocaleString()} ج.م`}
                      valueStyle={{ color: "#f97316", fontSize: "16px" }}
                    />
                  </>
                ) : (
                  <InfoRow
                    icon={<CheckCircle2 size={15} />}
                    label="صافي المحصل"
                    value={`${Math.max(
                      0,
                      (selectedInvoice.total_after_discount || 0) - (selectedInvoice.totalReturned || 0)
                    ).toLocaleString()} ج.م`}
                    valueStyle={{ color: "#34d399", fontSize: "16px" }}
                  />
                )}
              </SectionBox>

              {/* ── الأصناف المشتراة ── */}
              <div>
                <SectionTitle label="الأصناف المشتراة" />
                <div className="table-wrapper-premium"
                  style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>الصنف</th>
                        <th>المقاس / اللون</th>
                        <th>الكمية</th>
                        <th>سعر الوحدة</th>
                        <th>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name}</td>
                          <td>{item.size || "—"} / {item.color || "—"}</td>
                          <td>{item.quantity}</td>
                          <td>{(item.unit_price || 0).toLocaleString()} ج.م</td>
                          <td className="bold-text">
                            {((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── الأصناف المرتجعة (تظهر فقط لو في مرتجعات) ── */}
              {selectedInvoice.returnsDetails.length > 0 && (
                <div>
                  <SectionTitle label="الأصناف المرتجعة" color="#fb923c" />
                  <div className="table-wrapper-premium"
                    style={{ boxShadow: "none", border: "1px solid rgba(251,146,60,0.3)" }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>الصنف</th>
                          <th>المقاس / اللون</th>
                          <th>الكمية المرتجعة</th>
                          <th>قيمة الرجع</th>
                          <th>تاريخ الرجع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.returnsDetails.map((r) => (
                          <tr key={r.id}>
                            <td>{r.product_name}</td>
                            <td>{r.size || "—"} / {r.color || "—"}</td>
                            <td style={{ color: "#fb923c", fontWeight: "700" }}>{r.quantity}</td>
                            <td style={{ color: "#f87171" }}>{(r.amount || 0).toLocaleString()} ج.م</td>
                            <td>{new Date(r.return_date).toLocaleDateString("ar-EG")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── الأصناف بعد المرتجع (تظهر فقط لو في مرتجعات) ── */}
              {selectedInvoice.returnsDetails.length > 0 && (
                <div>
                  <SectionTitle label="الأصناف الصافية بعد الرجع" color="#34d399" />
                  <div className="table-wrapper-premium"
                    style={{ boxShadow: "none", border: "1px solid rgba(52,211,153,0.25)" }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>الصنف</th>
                          <th>المقاس / اللون</th>
                          <th>الكمية الأصلية</th>
                          <th>المرتجع</th>
                          <th>الصافي</th>
                          <th>القيمة الصافية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.itemsAfterReturn.map((item) => (
                          <tr key={item.id}>
                            <td>{item.product_name}</td>
                            <td>{item.size || "—"} / {item.color || "—"}</td>
                            <td>{item.quantity}</td>
                            <td style={{ color: "#fb923c" }}>
                              {item.returned_qty > 0 ? item.returned_qty : "—"}
                            </td>
                            <td className="bold-text"
                              style={{ color: item.net_qty === 0 ? "#f87171" : "#34d399" }}>
                              {item.net_qty}
                            </td>
                            <td className="bold-text">
                              {(item.net_qty * (item.unit_price || 0)).toLocaleString()} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── بيانات الأقساط الكاملة (تظهر فقط في التقسيط) ── */}
              {selectedInvoice.payment_method === "installment" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                  {/* سجل التحصيلات */}
                  <div>
                    <SectionTitle label="سجل التحصيلات" color="#34d399" />
                    <div className="table-wrapper-premium"
                      style={{ boxShadow: "none", border: "1px solid rgba(52,211,153,0.25)" }}>
                      <table className="custom-table" style={{ fontSize: "12px" }}>
                        <thead>
                          <tr>
                            <th>التاريخ</th>
                            <th>المبلغ</th>
                            <th>طريقة الدفع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.paymentHistory.length === 0 ? (
                            <tr>
                              <td colSpan="3" style={{ textAlign: "center", color: "#94a3b8" }}>
                                لا توجد تحصيلات بعد
                              </td>
                            </tr>
                          ) : (
                            selectedInvoice.paymentHistory.map((p) => (
                              <tr key={p.id}>
                                <td>{new Date(p.payment_date).toLocaleDateString("ar-EG")}</td>
                                <td style={{ color: "#34d399", fontWeight: "700" }}>
                                  {(p.amount_paid || 0).toLocaleString()} ج.م
                                </td>
                                <td>
                                  <Badge {...(PAYMENT_MAP[p.payment_method] || PAYMENT_MAP.cash)} />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* جدول مواعيد الأقساط */}
                  <div>
                    <SectionTitle label="جدول مواعيد الأقساط" color="#f97316" />
                    <div className="table-wrapper-premium"
                      style={{ boxShadow: "none", border: "1px solid rgba(249,115,22,0.25)" }}>
                      <table className="custom-table" style={{ fontSize: "12px" }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>الموعد</th>
                            <th>المبلغ</th>
                            <th>الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.installmentPlan.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: "center", color: "#94a3b8" }}>
                                لا يوجد جدول أقساط
                              </td>
                            </tr>
                          ) : (
                            selectedInvoice.installmentPlan.map((p, idx) => (
                              <tr key={p.id}>
                                <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                                <td>{new Date(p.due_date).toLocaleDateString("ar-EG")}</td>
                                <td style={{ fontWeight: "700" }}>
                                  {(p.amount_due || 0).toLocaleString()} ج.م
                                </td>
                                <td>
                                  {p.status === "paid" ? (
                                    <Badge bg="#dcfce7" text="#166534" border="#bbf7d0"
                                      icon={<CheckCircle2 size={12} />} label="مدفوع" />
                                  ) : (
                                    <Badge bg="#fef3c7" text="#92400e" border="#fde68a"
                                      icon={<AlertCircle size={12} />} label="معلق" />
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="modal-footer">
                <button className="btn-save flex-1" onClick={() => window.print()}>
                  <Printer size={18} /> طباعة
                </button>
                <button className="btn-cancel" onClick={closeModal}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          مودال الحذف
      ══════════════════════════════════════════════════════════════════════════ */}
      {deleteModal.show && (
        <div className="modal-overlay">
          <div className="modal-content-premium" style={{ maxWidth: "400px" }}>
            <div className="modal-header"><h3>حذف فاتورة</h3></div>
            <div className="premium-form" style={{ padding: "20px" }}>
              <textarea
                className="premium-select"
                placeholder="سبب الحذف..."
                value={deleteModal.reason}
                onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
              <div className="modal-footer" style={{ marginTop: "15px" }}>
                <button className="btn-save" style={{ background: "#ef4444" }} onClick={confirmDelete}>
                  تأكيد الحذف
                </button>
                <button className="btn-cancel"
                  onClick={() => setDeleteModal({ show: false, invoice: null, reason: "" })}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesLog;