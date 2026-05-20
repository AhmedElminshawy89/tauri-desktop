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
  Users,
  Clock,
  DollarSign,
  FileText,
  Package,
  Edit,
  CalendarDays,
  Wallet,
} from "lucide-react";
import EditBill from "./EditBill";

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
const deriveStatus = (invoice, totalReturned) => {
  const total = Number(invoice.total_after_discount) || 0;
  const returned = Number(totalReturned) || 0;

  if (returned <= 0) {
    return invoice.status === "pending" ? "pending" : "completed";
  }
  if (returned >= total) return "returned";
  return "partial_returned";
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
const Badge = ({ bg, text, border, icon, label, onClick }) => (
  <span
    onClick={onClick}
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
      cursor: onClick ? "pointer" : "default",
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
const SectionTitle = ({ label, color = "#94a3b8", icon }) => (
  <p
    style={{
      color,
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "1px",
      marginBottom: "10px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    }}
  >
    {icon}
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
  const [editInvoiceId, setEditInvoiceId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    invoice: null,
    reason: "",
  });

  // ─── جلب الفواتير ──────────────────────────────────────────────────────────
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      let query = `
        SELECT i.*,
               COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.invoice_id = i.id), 0) AS total_returned,
               e.name AS seller_name,
               e.commission_rate
        FROM invoices i
        LEFT JOIN employees e ON i.seller_id = e.id
        ORDER BY i.id DESC
      `;
      let params = [];

      if (filterDate) {
        query = `
          SELECT i.*,
                 COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.invoice_id = i.id), 0) AS total_returned,
                 e.name AS seller_name,
                 e.commission_rate
          FROM invoices i
          LEFT JOIN employees e ON i.seller_id = e.id
          WHERE date(i.created_at) = ?
          ORDER BY i.id DESC
        `;
        params = [filterDate];
      }

      const results = await db.select(query, params);
      
      let filteredResults = results;
      if (filterStatus) {
        filteredResults = results.filter((inv) => {
          const status = deriveStatus(inv, inv.total_returned);
          return status === filterStatus;
        });
      }
      
      setInvoices(filteredResults);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في جلب البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── جلب تفاصيل فاتورة كاملة ─────────────────────────────────────────────────
  const showDetails = async (invoice) => {
    try {
      const db = await getDb();
      
      const items = await db.select(
        `SELECT ii.*, pv.size, pv.color, p.name as product_name 
         FROM invoice_items ii 
         LEFT JOIN products p ON ii.product_id = p.id
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

      // جلب سجل المدفوعات (يشمل الدفعة المقدمة والأقساط)
      const paymentHistory = await db.select(
        `SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date ASC`,
        [invoice.id]
      );

      const totalReturned = returnsDetails.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0
      );
      
      // ✅ إجمالي المحصل = مجموع كل المدفوعات (لأن الدفعة المقدمة موجودة في paymentHistory)
      const totalActualPaid = paymentHistory.reduce(
        (s, p) => s + (Number(p.amount_paid) || 0),
        0
      );
      
      // الدفعة المقدمة هي أول دفعة في السجل (إن وجدت) أو 0
      const downPayment = paymentHistory.length > 0 ? paymentHistory[0].amount_paid : 0;

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

      let sellerInfo = null;
      if (invoice.seller_id) {
        const [seller] = await db.select(
          "SELECT id, name, commission_rate, total_sales, phone FROM employees WHERE id = ?",
          [invoice.seller_id]
        );
        sellerInfo = seller;
      }

      setSelectedInvoice({
        ...invoice,
        items: items,
        itemsAfterReturn: itemsAfterReturn,
        returnsDetails: returnsDetails,
        paymentHistory: paymentHistory,
        totalReturned: totalReturned,
        totalActualPaid: totalActualPaid,
        downPayment: downPayment,
        sellerInfo: sellerInfo,
      });
      
    } catch (err) {
      console.error("Error in showDetails:", err);
      if (showToast) showToast("خطأ في تحميل التفاصيل", "error");
    }
  };

  // ─── طباعة الفاتورة ─────────────────────────────────────────────────────
  const printInvoice = (invoice) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString("ar-EG");
    const totalBefore = Number(invoice.total_before_discount) || 0;
    let discountAmount = 0;
    if (invoice.discount_value && invoice.discount_value > 0) {
      if (invoice.discount_type === "percent") {
        discountAmount = (totalBefore * invoice.discount_value) / 100;
      } else {
        discountAmount = Number(invoice.discount_value);
      }
    }
    const totalAfter = Number(invoice.total_after_discount) || 0;
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة #${invoice.invoice_number}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 15px;
              width: 280px;
              margin: auto;
              background: white;
              color: black;
            }
            .header { text-align: center; margin-bottom: 15px; }
            .header h2 { margin: 0; font-size: 16px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th, .items-table td { padding: 4px 0; text-align: right; }
            .total-row { font-weight: bold; font-size: 14px; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; }
            .footer { text-align: center; margin-top: 12px; font-size: 10px; }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>اسم المحل</h2>
            <p style="font-size: 10px;">نظام كودينج كورنر</p>
          </div>
          <div class="divider"></div>
          
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span>رقم: #${invoice.invoice_number}</span>
            <span>${invoiceDate}</span>
          </div>
          <div style="font-size: 11px;">العميل: ${invoice.customer_name || "عميل نقدي"}</div>
          <div style="font-size: 10px;">البائع: ${invoice.seller_name || "—"}</div>
          
          <div class="divider"></div>
          
          <table class="items-table">
            <thead>
              <tr><th>الصنف</th><th>ق</th><th>السعر</th><th>الإجمالي</th></tr>
            </thead>
            <tbody>
              ${invoice.items?.map(item => `
                <tr>
                  <td>${item.product_name}${item.size ? ` (${item.size})` : ''}${item.color ? ` - ${item.color}` : ''}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: left;">${(item.unit_price || 0).toFixed(2)}</td>
                  <td style="text-align: left;">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <div style="display: flex; justify-content: space-between;">
            <span>الإجمالي:</span>
            <span>${totalBefore.toFixed(2)} ج.م</span>
          </div>
          ${discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>الخصم:</span>
              <span>- ${discountAmount.toFixed(2)} ج.م</span>
            </div>
          ` : ''}
          
          <div class="total-row" style="display: flex; justify-content: space-between;">
            <span>الصافي:</span>
            <span>${totalAfter.toFixed(2)} ج.م</span>
          </div>
          
          <div class="footer">
            <p>شكراً لزيارتكم</p>
          </div>
        </body>
      </html>
    `;

    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  };

const confirmDelete = async () => {
  if (!deleteModal.reason.trim()) {
    if (showToast) showToast("يرجى كتابة سبب الحذف", "warning");
    return;
  }
  try {
    const db = await getDb();
    const inv = deleteModal.invoice;
    
    await db.execute("BEGIN TRANSACTION");
    
    // 1. جلب الأصناف لحفظ نسخة في deleted_invoices
    const items = await db.select(
      "SELECT * FROM invoice_items WHERE invoice_id = ?",
      [inv.id]
    );
    const snapshot = JSON.stringify({ items });

    // 2. إدراج سجل في deleted_invoices
    await db.execute(
      `INSERT INTO deleted_invoices 
       (invoice_id, invoice_number, customer_name, total_amount, reason, items_json, deleted_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        inv.id,
        inv.invoice_number,
        inv.customer_name || "عميل نقدي",
        inv.total_after_discount,
        deleteModal.reason,
        snapshot,
      ]
    );

    // 3. حذف جميع السجلات المرتبطة يدويًا لتجنب FOREIGN KEY error
    await db.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [inv.id]);
    await db.execute("DELETE FROM installment_payments WHERE invoice_id = ?", [inv.id]);
    await db.execute("DELETE FROM installment_plan WHERE invoice_id = ?", [inv.id]);
    await db.execute("DELETE FROM returns WHERE invoice_id = ?", [inv.id]);
    
    // 4. استرجاع المخزون (إن وجد)
    for (const item of items) {
      if (item.variant_id) {
        await db.execute("UPDATE product_variants SET stock = stock + ? WHERE id = ?", [
          item.quantity,
          item.variant_id,
        ]);
      } else {
        await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [
          item.quantity,
          item.product_id,
        ]);
      }
    }
    
    // 5. حذف الفاتورة نفسها
    await db.execute("DELETE FROM invoices WHERE id = ?", [inv.id]);
    
    await db.execute("COMMIT");

    if (showToast) showToast("تم الحذف بنجاح", "success");
    setDeleteModal({ show: false, invoice: null, reason: "" });
    fetchInvoices();
  } catch (err) {
    console.error(err);
    try {
      const db = await getDb();
      await db.execute("ROLLBACK");
    } catch (e) {}
    if (showToast) showToast("خطأ في التنفيذ", "error");
  }
};

  const closeModal = () => setSelectedInvoice(null);
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditInvoiceId(null);
    fetchInvoices();
  };

  const openEditModal = (invoice) => {
    setEditInvoiceId(invoice.id);
    setShowEditModal(true);
    closeModal();
  };

  const filtered = invoices.filter(
    (inv) =>
      (inv.invoice_number || "").includes(searchTerm) ||
      (inv.customer_name || "").includes(searchTerm) ||
      (inv.seller_name || "").includes(searchTerm)
  );

  const stats = {
    total: invoices.reduce((sum, inv) => sum + (inv.total_after_discount || 0), 0),
    count: invoices.length,
    completed: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "completed").length,
    pending: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "pending").length,
    returned: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "returned").length,
    partial_returned: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "partial_returned").length,
  };

  useEffect(() => {
    fetchInvoices();
    
    const handleStorageChange = (e) => {
      if (e.key === 'invoices_updated' || e.key === 'invoice_updated') {
        console.log("📢 Detected invoice update, refreshing...");
        fetchInvoices();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [filterDate, filterStatus]);

  return (
    <div className="page-container animate-fade-in" dir="rtl">

      {/* إحصائيات سريعة */}
      <div className="stats-grid-premium" style={{ marginBottom: "20px" }}>
        <div className="stat-card-premium emerald">
          <div className="stat-icon-wrapper"><DollarSign size={24} /></div>
          <div>
            <div className="stat-label">إجمالي المبيعات</div>
            <div className="stat-value">{stats.total.toLocaleString()} ج.م</div>
          </div>
        </div>
        <div className="stat-card-premium indigo">
          <div className="stat-icon-wrapper"><FileText size={24} /></div>
          <div>
            <div className="stat-label">عدد الفواتير</div>
            <div className="stat-value">{stats.count}</div>
          </div>
        </div>
        <div className="stat-card-premium green">
          <div className="stat-icon-wrapper"><CheckCircle2 size={24} /></div>
          <div>
            <div className="stat-label">مكتملة</div>
            <div className="stat-value">{stats.completed}</div>
          </div>
        </div>
        <div className="stat-card-premium amber">
          <div className="stat-icon-wrapper"><Clock size={24} /></div>
          <div>
            <div className="stat-label">معلقة</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">سجل المبيعات</h2>
          <p className="sub-title">إدارة الفواتير والتحصيلات المالية وتتبع الأداء</p>
        </div>
        <div className="header-actions-group" style={{ gap: "12px", flexWrap: "wrap" }}>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="premium-select"
            style={{ padding: "10px" }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="premium-select"
            style={{ padding: "10px" }}
          >
            <option value="">كل الحالات</option>
            <option value="completed">مكتملة</option>
            <option value="pending">معلقة</option>
            <option value="partial_returned">مرتجع جزئي</option>
            <option value="returned">مرتجع كلي</option>
          </select>
          <button 
            onClick={() => fetchInvoices()}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px" }}
          >
            <RotateCcw size={16} /> تحديث
          </button>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل أو البائع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-select"
              style={{ width: "280px", paddingRight: "35px" }}
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
              <th>البائع</th>
              <th>نظام الدفع</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center">جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="8" className="text-center">لا توجد فواتير</td></tr>
            ) : (
              filtered.map((inv) => {
                const pmConfig = PAYMENT_MAP[inv.payment_method] || PAYMENT_MAP.cash;
                const derivedStatus = deriveStatus(inv, inv.total_returned);
                const stConfig = STATUS_MAP[derivedStatus] || STATUS_MAP.completed;

                return (
                  <tr key={inv.id} className="table-row">
                    <td><span className="id-badge">#{inv.invoice_number}</span></td>
                    <td style={{ fontWeight: "500" }}>{inv.customer_name || "عميل نقدي"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} style={{ color: "#64748b" }} />
                        <span>{inv.seller_name || "—"}</span>
                        {inv.commission_rate > 0 && (
                          <span style={{ fontSize: "11px", color: "#10b981" }}>
                            ({inv.commission_rate}%)
                          </span>
                        )}
                      </div>
                    </td>
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
                      <button className="action-btn edit" onClick={() => openEditModal(inv)}>
                        <Edit size={18} />
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

      {/* مودال التفاصيل */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={(e) => e.target.className === "modal-overlay" && closeModal()}>
          <div className="modal-content-premium" style={{ maxWidth: "1100px", width: "95%", maxHeight: "90vh", overflow: "hidden" }}>
            <div className="modal-header">
              <h3>
                <Receipt size={18} style={{ display: "inline", marginLeft: "8px" }} />
                تفاصيل فاتورة #{selectedInvoice.invoice_number}
              </h3>
            </div>

            <div style={{ padding: "20px", maxHeight: "calc(90vh - 80px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* بيانات العميل + الفاتورة + البائع */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <SectionBox>
                  <SectionTitle label="بيانات العميل" icon={<User size={14} />} />
                  <InfoRow icon={<User size={15} />} label="الاسم" value={selectedInvoice.customer_name || "عميل نقدي"} />
                  <InfoRow icon={<Phone size={15} />} label="التليفون" value={selectedInvoice.customer_phone || "—"} />
                  <InfoRow icon={<MapPin size={15} />} label="العنوان" value={selectedInvoice.customer_address || "—"} />
                </SectionBox>

                <SectionBox>
                  <SectionTitle label="بيانات الفاتورة" icon={<FileText size={14} />} />
                  <InfoRow icon={<Calendar size={15} />} label="التاريخ" value={new Date(selectedInvoice.created_at).toLocaleDateString("ar-EG")} />
                  <InfoRow icon={<HandCoins size={15} />} label="نظام الدفع" value={<Badge {...(PAYMENT_MAP[selectedInvoice.payment_method] || PAYMENT_MAP.cash)} label={selectedInvoice.payment_method === "installment" ? `تقسيط (${selectedInvoice.installments_count} قسط)` : (PAYMENT_MAP[selectedInvoice.payment_method] || PAYMENT_MAP.cash).label} />} />
                  <InfoRow icon={<Tag size={15} />} label="الحالة" value={<Badge {...(STATUS_MAP[deriveStatus(selectedInvoice, selectedInvoice.totalReturned)] || STATUS_MAP.completed)} />} />
                  <InfoRow icon={<Users size={15} />} label="البائع" value={<span>{selectedInvoice.seller_name || selectedInvoice.sellerInfo?.name || "—"}</span>} />
                </SectionBox>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <SectionBox>
                  <SectionTitle label="الملخص المالي" icon={<DollarSign size={14} />} />
                  <InfoRow icon={<Receipt size={15} />} label="إجمالي قبل الخصم" value={`${(selectedInvoice.total_before_discount || 0).toLocaleString()} ج.م`} />
                  {(selectedInvoice.discount_value || 0) > 0 && (
                    <InfoRow icon={<Percent size={15} />} label={selectedInvoice.discount_type === "percent" ? `خصم ${selectedInvoice.discount_value}%` : "خصم (مبلغ ثابت)"} value={`- ${selectedInvoice.discount_type === "percent" ? ((selectedInvoice.total_before_discount || 0) * selectedInvoice.discount_value) / 100 : selectedInvoice.discount_value} ج.م`} valueStyle={{ color: "#f87171" }} />
                  )}
                  
                  <InfoRow icon={<CheckCircle2 size={15} />} label="إجمالي بعد الخصم" value={`${(selectedInvoice.total_after_discount || 0).toLocaleString()} ج.م`} valueStyle={{ color: "#34d399" }} />
                  <InfoRow icon={<CheckCircle2 size={15} />} label="صافي المحصل" value={`${Math.max(0, (selectedInvoice.total_after_discount || 0) - (selectedInvoice.totalReturned || 0)).toLocaleString()} ج.م`} valueStyle={{ color: "#34d399", fontSize: "16px" }} />
                  {(selectedInvoice.totalReturned || 0) > 0 && (
                    <InfoRow icon={<RotateCcw size={15} />} label="إجمالي المرتجعات" value={`- ${(selectedInvoice.totalReturned || 0).toLocaleString()} ج.م`} valueStyle={{ color: "#fb923c" }} />
                  )}
                  <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />
                </SectionBox>

                {selectedInvoice.payment_method === "installment" && (
                  <SectionBox>
                    <SectionTitle label="تفاصيل الدفع للأقساط" icon={<DollarSign size={14} />} />
                    <>
                      <InfoRow 
                        icon={<Wallet size={15} />} 
                        label="المبلغ المدفوع (مقدم)" 
                        value={`${(selectedInvoice.downPayment || 0).toLocaleString()} ج.م`} 
                        valueStyle={{ color: "#34d399" }} 
                      />
                      <InfoRow 
                        icon={<AlertCircle size={15} />} 
                        label="المتبقي على العميل" 
                        value={`${Math.max(0, (selectedInvoice.total_after_discount || 0) - (selectedInvoice.totalActualPaid || 0) - (selectedInvoice.totalReturned || 0)).toLocaleString()} ج.م`} 
                        valueStyle={{ color: "#f97316", fontSize: "16px" }} 
                      />
                      <InfoRow 
                        icon={<Repeat size={15} />} 
                        label="عدد المدفوعات" 
                        value={`${selectedInvoice.paymentHistory?.length || 0} دفعة`} 
                        valueStyle={{ color: "#60a5fa" }} 
                      />
                      <InfoRow 
                        icon={<CheckCircle2 size={15} />} 
                        label="إجمالي المحصل" 
                        value={`${(selectedInvoice.totalActualPaid || 0).toLocaleString()} ج.م`} 
                        valueStyle={{ color: "#34d399" }} 
                      />
                    </>
                  </SectionBox>
                )}
              </div>

              {/* سجل التحصيلات */}
              {selectedInvoice.payment_method === "installment" && selectedInvoice.paymentHistory && selectedInvoice.paymentHistory.length > 0 && (
                <div>
                  <SectionTitle label="سجل التحصيلات" color="#60a5fa" icon={<Clock size={14} />} />
                  <div className="table-wrapper-premium" style={{ boxShadow: "none", border: "1px solid rgba(96,165,250,0.3)" }}>
                    <table className="custom-table" style={{ fontSize: "13px" }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>تاريخ الدفع</th>
                          <th>المبلغ المدفوع</th>
                          <th>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.paymentHistory.map((p, idx) => (
                          <tr key={p.id}>
                            <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                            <td>{new Date(p.payment_date).toLocaleDateString("ar-EG")}</td>
                            <td style={{ color: "#34d399", fontWeight: "bold" }}>+{p.amount_paid.toLocaleString()} ج.م</td>
                            <td style={{ fontSize: "12px", color: "#64748b" }}>{p.note || "تحصيل"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* الأصناف المشتراة */}
              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <SectionTitle label="الأصناف المشتراة" icon={<Package size={14} />} />
                  <div className="table-wrapper-premium" style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <table className="custom-table" style={{ fontSize: "13px" }}>
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
                            <td className="bold-text">{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()} ج.م</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* الأصناف المرتجعة */}
              {selectedInvoice.returnsDetails && selectedInvoice.returnsDetails.length > 0 && (
                <div>
                  <SectionTitle label="الأصناف المرتجعة" color="#fb923c" icon={<RotateCcw size={14} />} />
                  <div className="table-wrapper-premium" style={{ boxShadow: "none", border: "1px solid rgba(251,146,60,0.3)" }}>
                    <table className="custom-table" style={{ fontSize: "13px" }}>
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

              {/* Footer */}
              <div className="modal-footer">
                <button className="btn-save flex-1" onClick={() => printInvoice(selectedInvoice)}>
                  <Printer size={18} /> طباعة
                </button>
                <button className="btn-save flex-1" onClick={() => openEditModal(selectedInvoice)}>
                  <Edit size={18} /> تعديل
                </button>
                <button className="btn-cancel" onClick={closeModal}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال تعديل الفاتورة */}
      {showEditModal && editInvoiceId && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div 
            className="modal-content-premium" 
            style={{ maxWidth: "95%", width: "95%", maxHeight: "90vh", overflow: "auto", padding: "0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <EditBill 
              invoiceId={editInvoiceId} 
              onBack={closeEditModal} 
              showToast={showToast} 
            />
          </div>
        </div>
      )}

      {/* مودال الحذف */}
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
                <button className="btn-cancel" onClick={() => setDeleteModal({ show: false, invoice: null, reason: "" })}>
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