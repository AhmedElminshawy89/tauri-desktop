import { useState, useEffect, useRef, useCallback } from "react";
import { getDb } from "../lib/db";
import {
  Banknote,
  CreditCard,
  Repeat,
  Save,
  ArrowRight,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  User,
  Phone,
  MapPin,
  Tag,
  ShoppingCart,
  ChevronDown,
  Sparkles,
  Printer,
  PauseCircle,
  Eye,
  LogOut,
  Users,
} from "lucide-react";

/* ─────────────────────────────────────────
   Editable Cell
───────────────────────────────────────── */
const EditableCell = ({ value, onSave, type = "text", style = {}, minValue, showToast }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = type === "number" ? parseFloat(val) || 0 : val;
    if (minValue !== undefined && parsed < minValue) {
      showToast?.(`القيمة لا يمكن أن تقل عن ${minValue}`, "error");
      setVal(value);
      return;
    }
    if (String(val) !== String(value)) onSave(val);
  };

  if (editing)
    return (
      <input
        ref={ref}
        type={type}
        value={val}
        className="ei-inline-input"
        style={style}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setVal(value); setEditing(false); }
        }}
      />
    );

  return (
    <span className="ei-editable-cell" style={style} onClick={() => setEditing(true)} title="اضغط للتعديل">
      {value}
      <span className="ei-pencil">✎</span>
    </span>
  );
};

/* ─────────────────────────────────────────
   Customer Field with autocomplete
───────────────────────────────────────── */
const CustomerField = ({ icon, label, value, onChange, suggestions = [], onSelectSuggestion, type = "text", placeholder, onAddNew }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef();

  useEffect(() => {
    setOpen(suggestions.length > 0);
  }, [suggestions]);

  useEffect(() => {
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="ei-field-wrap" ref={wrapRef}>
      <label className="ei-field-label">
        <span className="ei-field-icon">{icon}</span>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="ei-field-input"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div className="ei-suggestions">
            {suggestions.map((c, i) => (
              <div key={i} className="ei-suggestion-item" onClick={() => { onSelectSuggestion?.(c); setOpen(false); }}>
                <div className="ei-suggestion-name">{c.customer_name}</div>
                <div className="ei-suggestion-meta">
                  {c.customer_phone && <span><Phone size={10}/> {c.customer_phone}</span>}
                  {c.customer_address && <span><MapPin size={10}/> {c.customer_address}</span>}
                </div>
              </div>
            ))}
            <div className="ei-suggestion-new" onClick={() => { onAddNew?.(); setOpen(false); }}>
              <Sparkles size={11}/> تسجيل عميل جديد بهذا الاسم
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────── */
const EditBill = ({ invoiceId: initialInvoiceId, onBack, showToast }) => {
  const [invoiceInput, setInvoiceInput] = useState(initialInvoiceId ? String(initialInvoiceId) : "");
  const [activeInvoiceId, setActiveInvoiceId] = useState(initialInvoiceId ?? null);
  const invoiceInputRef = useRef();

  const handleLookup = async () => {
    const val = invoiceInput.trim();
    if (!val) { 
      showToast?.("أدخل رقم الفاتورة", "error"); 
      return; 
    }
    try {
      const db = await getDb();
      // البحث فقط في invoice_number وليس في id
      const rows = await db.select(
        "SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1", 
        [val]
      );
      if (!rows.length) { 
        showToast?.(`الفاتورة رقم "${val}" غير موجودة`, "error"); 
        return; 
      }
      setActiveInvoiceId(rows[0].id);
    } catch (e) { 
      showToast?.("خطأ في البحث: " + e.message, "error"); 
    }
  };

  /* ── State ── */
  const [invoice, setInvoice] = useState(null);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [customerId, setCustomerId] = useState(null);
  const [discount, setDiscount] = useState({ value: 0, type: "fixed" });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [seller, setSeller] = useState(null);
  const [sellerId, setSellerId] = useState(null);
  const [employeesList, setEmployeesList] = useState([]);
  const [showSellerModal, setShowSellerModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);

  const [loading, setLoading] = useState(!!initialInvoiceId);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [highlightRow, setHighlightRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [printMode, setPrintMode] = useState(null);

  const searchRef = useRef();

  /* ── Totals ── */
  const totalBefore = cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const discAmt = discount.type === "percent"
    ? totalBefore * (parseFloat(discount.value || 0) / 100)
    : parseFloat(discount.value || 0);
  const finalTotal = Math.max(0, totalBefore - discAmt);
  const actualPaid = paymentMethod === "installment" ? parseFloat(paidAmount || 0) : finalTotal;
  const remaining = Math.max(0, finalTotal - actualPaid);

  /* ── Load Employees ── */
  const loadEmployees = async () => {
    try {
      const db = await getDb();
      const rows = await db.select(
        `SELECT id, name, commission_rate, total_sales, last_sale_date 
         FROM employees 
         WHERE is_active = 1 
         ORDER BY name`
      );
      setEmployeesList(rows || []);
    } catch (e) {
      console.warn(e);
    }
  };

  /* ── Load Invoice ── */
  const loadInvoice = useCallback(async () => {
    if (!activeInvoiceId) return;
    setLoading(true);
    try {
      const db = await getDb();
      const [inv] = await db.select("SELECT * FROM invoices WHERE id = $1 LIMIT 1", [activeInvoiceId]);
      if (!inv) { showToast?.("الفاتورة غير موجودة", "error"); onBack?.(); return; }
      setInvoice(inv);

      setCustomer({
        name: inv.customer_name || "",
        phone: inv.customer_phone || "",
        address: inv.customer_address || "",
      });
      setCustomerId(inv.customer_id ?? null);
      setDiscount({ value: inv.discount_value ?? 0, type: inv.discount_type || "fixed" });

      if (inv.seller_id) {
        setSellerId(inv.seller_id);
        setSeller({ id: inv.seller_id, name: inv.seller_name, commission_rate: inv.commission_rate || 0 });
      }

      const method = inv.payment_method || "cash";
      setPaymentMethod(method);
      setPaidAmount(method === "installment" ? (inv.paid_amount ?? 0) : (inv.total_after_discount ?? 0));

      const items = await db.select(
        `SELECT ii.*, p.cost_price, pv.stock AS variant_stock, pv.color, pv.size
         FROM invoice_items ii
         LEFT JOIN products p ON p.id = ii.product_id
         LEFT JOIN product_variants pv ON pv.id = ii.variant_id
         WHERE ii.invoice_id = $1`,
        [activeInvoiceId]
      );

      setCart(items.map((i) => ({
        cartKey: i.variant_id ?? i.product_id,
        id: i.product_id,
        variant_id: i.variant_id ?? null,
        name: i.product_name,
        sale_price: i.unit_price,
        cost_price: i.cost_price || 0,
        quantity: i.quantity,
        stock: (i.variant_stock ?? 0) + i.quantity,
        size: i.size || "",
        color: i.color || "",
        originalQty: i.quantity,
      })));
    } catch (e) {
      showToast?.("خطأ في تحميل الفاتورة: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [activeInvoiceId]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);
  useEffect(() => { loadEmployees(); }, []);

  /* ── Product Search ── */
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    try {
      const db = await getDb();
      const rows = await db.select(
        `SELECT p.id, p.name, p.barcode, p.cost_price, p.sale_price, p.category,
                pv.id AS variant_id, pv.color, pv.size, pv.stock, pv.variant_barcode
         FROM products p
         LEFT JOIN product_variants pv ON pv.product_id = p.id
         WHERE (p.name LIKE $1 OR p.barcode = $2 OR pv.variant_barcode = $2) AND pv.stock > 0
         LIMIT 12`,
        [`%${q}%`, q]
      );
      setSearchResults(rows);
      if (rows.length === 1 && (rows[0].barcode === q || rows[0].variant_barcode === q)) {
        addToCart(rows[0]);
      }
    } catch (e) { console.warn(e); }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) { showToast?.("المنتج نفذ من المخزن", "error"); return; }
    const cartKey = product.variant_id ?? product.id;
    const ex = cart.find((i) => i.cartKey === cartKey);
    if (ex) {
      if (ex.quantity + 1 > product.stock) { showToast?.(`المتاح: ${product.stock}`, "warning"); return; }
      setCart(cart.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, {
        cartKey, id: product.id, variant_id: product.variant_id ?? null,
        name: product.name, sale_price: product.sale_price, cost_price: product.cost_price,
        quantity: 1, stock: product.stock, size: product.size || "", color: product.color || "",
        originalQty: 0,
      }]);
      setHighlightRow(cartKey);
      setTimeout(() => setHighlightRow(null), 900);
    }
    setSearchQuery("");
    setSearchResults([]);
    searchRef.current?.focus();
  };

  const updateQty = (cartKey, delta) => {
    setCart(cart.map((item) => {
      if (item.cartKey !== cartKey) return item;
      const nq = item.quantity + delta;
      if (delta > 0 && nq > item.stock) { showToast?.(`المتاح: ${item.stock}`, "warning"); return item; }
      return nq > 0 ? { ...item, quantity: nq } : item;
    }));
  };

  const editField = (cartKey, field, raw) => {
    const value = field === "sale_price" ? parseFloat(raw) || 0 : raw;
    setCart(cart.map((i) => {
      if (i.cartKey !== cartKey) return i;
      if (field === "sale_price" && value < (i.cost_price || 0)) {
        showToast?.(`السعر لا يقل عن التكلفة (${i.cost_price} ج.م)`, "error");
        return i;
      }
      return { ...i, [field]: value };
    }));
  };

  /* ── Customer Search ── */
  const handleCustomerSearch = async (name) => {
    setCustomer((c) => ({ ...c, name }));
    setCustomerId(null);
    if (name.length < 2) { setCustomerSuggestions([]); return; }
    try {
      const db = await getDb();
      let rows = [];
      try {
        rows = await db.select(
          `SELECT id AS customer_id, name AS customer_name, phone AS customer_phone, address AS customer_address
           FROM customers WHERE name LIKE $1 LIMIT 6`,
          [`%${name}%`]
        );
      } catch {
        rows = await db.select(
          `SELECT DISTINCT customer_name, customer_phone, customer_address
           FROM invoices WHERE customer_name LIKE $1 LIMIT 6`,
          [`%${name}%`]
        );
      }
      setCustomerSuggestions(rows);
    } catch (e) { console.warn(e); }
  };

  const selectCustomer = (c) => {
    setCustomer({
      name: c.customer_name,
      phone: c.customer_phone || "",
      address: c.customer_address || "",
    });
    setCustomerId(c.customer_id ?? null);
    setCustomerSuggestions([]);
  };

  const onAddNewCustomerAction = () => {
    setCustomerId(null);
    setCustomer(prev => ({ ...prev, phone: "", address: "" }));
    showToast?.("تم اختيار وضع تسجيل عميل جديد", "info");
  };

  /* ── Seller Functions ── */
  const selectSeller = (selectedSeller) => {
    setSeller(selectedSeller);
    setSellerId(selectedSeller.id);
    setShowSellerModal(false);
    showToast?.(`تم تغيير البائع إلى ${selectedSeller.name}`, "success");
  };

  /* ── Print Receipt ── */
  const printReceipt = () => {
    const generateReceiptHTML = () => {
      return `
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>فاتورة #${invoice?.invoice_number}</title>
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
            </style>
          </head>
          <body>
            <div class="header">
              <h2>اسم المحل</h2>
              <p style="font-size: 10px;">نظام كودينج كورنر</p>
            </div>
            <div class="divider"></div>
            
            <div style="display: flex; justifyContent: space-between; font-size: 11px;">
              <span>رقم: #${invoice?.invoice_number}</span>
              <span>${new Date().toLocaleDateString("ar-EG")}</span>
            </div>
            <div style="font-size: 11px;">العميل: ${customer.name || "عميل نقدي"}</div>
            <div style="font-size: 10px;">البائع: ${seller?.name || invoice?.seller_name || "—"}</div>
            
            <div class="divider"></div>
            
            <table class="items-table">
              <thead>
                <tr><th>الصنف</th><th>ق</th><th>السعر</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                ${cart.map(item => `
                  <tr>
                    <td>${item.name}${item.size ? ` (${item.size})` : ''}${item.color ? ` - ${item.color}` : ''}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: left;">${item.sale_price.toFixed(2)}</td>
                    <td style="text-align: left;">${(item.quantity * item.sale_price).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="divider"></div>
            
            <div style="display: flex; justify-content: space-between;">
              <span>الإجمالي:</span>
              <span>${totalBefore.toFixed(2)} ج.م</span>
            </div>
            ${discAmt > 0 ? `
              <div style="display: flex; justify-content: space-between;">
                <span>الخصم:</span>
                <span>- ${discAmt.toFixed(2)} ج.م</span>
              </div>
            ` : ''}
            
            <div class="total-row" style="display: flex; justify-content: space-between;">
              <span>الصافي:</span>
              <span>${finalTotal.toFixed(2)} ج.م</span>
            </div>
            
            <div class="footer">
              <p>شكراً لزيارتكم</p>
            </div>
          </body>
        </html>
      `;
    };

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(generateReceiptHTML());
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      };
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(generateReceiptHTML());
      iframe.contentDocument.close();
      setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 100);
    }
  };

  /* ── Save ── */
  const saveEdits = async (shouldPrint = true) => {
    if (cart.length === 0) { showToast?.("السلة فارغة", "error"); return; }
    setSaving(true);
    try {
      const db = await getDb();

      let finalCustomerId = customerId;
      if (!finalCustomerId && customer.name.trim()) {
        try {
          const existing = await db.select(
            "SELECT id FROM customers WHERE name = $1 LIMIT 1",
            [customer.name.trim()]
          );
          if (existing.length) {
            finalCustomerId = existing[0].id;
          } else {
            await db.execute("INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3)", 
              [customer.name.trim(), customer.phone, customer.address]);
            const [res] = await db.select("SELECT last_insert_rowid() AS id");
            finalCustomerId = res?.id;
          }
        } catch {
          // customers table may not exist
        }
      }

      // 1. تحديث المخزون - استرجاع الكميات القديمة
      const oldItems = await db.select("SELECT * FROM invoice_items WHERE invoice_id = $1", [activeInvoiceId]);
      for (const oldItem of oldItems) {
        const newItem = cart.find((i) => 
          oldItem.variant_id ? i.variant_id === oldItem.variant_id : i.id === oldItem.product_id
        );
        const diff = oldItem.quantity - (newItem ? newItem.quantity : 0);
        if (diff !== 0) {
          const table = oldItem.variant_id ? "product_variants" : "products";
          const id = oldItem.variant_id || oldItem.product_id;
          await db.execute(`UPDATE ${table} SET stock = stock + $1 WHERE id = $2`, [diff, id]);
        }
      }
      
      // 2. خصم الكميات الجديدة
      for (const newItem of cart) {
        const existed = oldItems.find((o) => 
          newItem.variant_id ? o.variant_id === newItem.variant_id : o.product_id === newItem.id
        );
        if (!existed) {
          const table = newItem.variant_id ? "product_variants" : "products";
          await db.execute(`UPDATE ${table} SET stock = stock - $1 WHERE id = $2`, [newItem.quantity, newItem.variant_id || newItem.id]);
        }
      }

      // 3. حذف الأصناف القديمة وإضافة الجديدة
      await db.execute("DELETE FROM invoice_items WHERE invoice_id = $1", [activeInvoiceId]);
      for (const item of cart) {
        await db.execute(
          `INSERT INTO invoice_items (invoice_id, product_id, variant_id, product_name, quantity, unit_price, total_price, cost_price_at_sale)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [activeInvoiceId, item.id, item.variant_id, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price, item.cost_price || 0]
        );
      }

      // 4. حساب العمولة
      const commissionAmount = seller ? (finalTotal * (seller.commission_rate || 0) / 100) : (invoice?.commission_amount || 0);

      // 5. تحديث الفاتورة
      await db.execute(
        `UPDATE invoices SET
           customer_name = $1, customer_phone = $2, customer_address = $3, customer_id = $4,
           total_before_discount = $5, discount_value = $6, discount_type = $7,
           total_after_discount = $8, payment_method = $9, paid_amount = $10, remaining_amount = $11,
           seller_id = $12, seller_name = $13, commission_amount = $14
         WHERE id = $15`,
        [
          customer.name, customer.phone, customer.address, finalCustomerId,
          totalBefore, discount.value, discount.type, finalTotal,
          paymentMethod, actualPaid, remaining,
          sellerId || invoice?.seller_id, seller?.name || invoice?.seller_name, commissionAmount,
          activeInvoiceId,
        ]
      );

      // 6. إرسال إشارة للتحديث
      localStorage.setItem('invoices_updated', Date.now().toString());
      localStorage.setItem('invoice_updated', activeInvoiceId.toString());

      if (shouldPrint) {
        try {
          printReceipt();
        } catch (error) {
          console.error("Error printing:", error);
          showToast?.("تم حفظ التعديلات ولكن حدث خطأ في الطباعة", "warning");
        }
      }

      showToast?.("تم حفظ التعديلات بنجاح ✓", "success");
      setShowConfirm(false);
      
      onBack?.();
      
    } catch (e) {
      console.error(e);
      showToast?.("خطأ في الحفظ: " + e, "error");
    } finally {
      setSaving(false);
      setPrintMode(null);
    }
  };

  const stockColor = (stock, qty) => {
    const r = stock - qty;
    return r <= 0 ? "#ef4444" : r <= 3 ? "#f59e0b" : "#10b981";
  };

  if (loading)
    return (
      <div className="ei-root">
        <div className="ei-loading">
          <RotateCcw size={32} className="ei-spinner" />
          <p>جاري تحميل الفاتورة…</p>
        </div>
      </div>
    );

  if (!activeInvoiceId)
    return (
      <div className="ei-root">
        <div className="ei-lookup-screen">
          <div className="ei-lookup-card ei-animate">
            <div className="ei-lookup-icon">🔍</div>
            <h2 className="ei-lookup-title">تعديل فاتورة</h2>
            <p className="ei-lookup-sub">أدخل رقم الفاتورة للبحث</p>
            <div className="ei-lookup-row">
              <input
                ref={invoiceInputRef}
                type="text"
                value={invoiceInput}
                onChange={(e) => setInvoiceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="0001"
                autoFocus
                className="ei-lookup-input"
              />
              <button onClick={handleLookup} className="ei-lookup-btn">
                <Search size={16} /> بحث
              </button>
            </div>
            {onBack && (
              <button onClick={onBack} className="ei-back-link">
                <ArrowRight size={14} /> رجوع للقائمة
              </button>
            )}
          </div>
        </div>
      </div>
    );

  return (
    <div className="ei-root ei-animate">

      <div className="ei-topbar">
        <div className="ei-topbar-badge">
          <div>
            <span className="lbl">رقم الفاتورة</span>
            <span className="val">#{invoice?.invoice_number}</span>
          </div>
        </div>
        <div className="ei-topbar-sep" />
        <div className="ei-topbar-badge">
          <div>
            <span className="lbl">الحالة</span>
            <span className={`ei-status-pill ${invoice?.status === "completed" ? "complete" : "pending"}`}>
              {invoice?.status === "completed" ? "مكتملة" : "معلقة"}
            </span>
          </div>
        </div>
        <div className="ei-topbar-sep" />
        <div className="ei-topbar-badge">
          <div>
            <span className="lbl">تاريخ الإنشاء</span>
            <span className="val">
              {invoice?.created_at ? new Date(invoice.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </span>
          </div>
        </div>
        <div className="ei-topbar-spacer" />
        <div className="ei-shortcut">
          <kbd>/ بحث</kbd>
          <kbd>↵ أضف</kbd>
          <kbd>Esc رجوع</kbd>
        </div>
      </div>

      {/* Page header */}
      <div className="ei-page-header">
        <div>
          <h2 className="ei-page-title">
            تعديل الفاتورة
            <span className="ei-count-badge" style={{ marginRight: 10 }}>{cart.length} صنف</span>
          </h2>
          <p className="ei-page-sub">
            فاتورة رقم: <strong style={{ color: "var(--text)" }}>#{invoice?.invoice_number}</strong>
            <span className="ei-edit-badge">وضع التعديل</span>
            {customerId && <span className="ei-linked-badge"><CheckCircle2 size={9}/> مرتبط بعميل</span>}
          </p>
        </div>
        <div className="ei-header-actions">
          <div className="ei-search-wrap">
            <div className="ei-search-box">
              <Search size={16} style={{ color: "var(--text3)" }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="/ إضافة منتج بالاسم أو الباركود…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchResults.length > 0 && addToCart(searchResults[0])}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="ei-dropdown">
                {searchResults.map((p) => (
                  <div key={`${p.id}-${p.variant_id}`} className="ei-dropdown-item" onClick={() => addToCart(p)}>
                    <div>
                      <div className="pname">{p.name} {p.size && <span style={{ fontSize: 11, color: "var(--text3)" }}>{p.size}</span>} {p.color && <span style={{ fontSize: 11, color: "var(--text3)" }}>{p.color}</span>}</div>
                      <div className="pmeta">
                        <span className="ei-stock-dot" style={{ background: stockColor(p.stock, 0) }} />
                        {p.stock} متاح
                      </div>
                    </div>
                    <span className="ei-price-chip">{p.sale_price} ج.م</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="ei-btn ei-btn-secondary" onClick={onBack}>
            <ArrowRight size={15} /> رجوع
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="ei-layout">

        {/* Items table */}
        <div className="ei-table-card">
          <table className="ei-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th style={{ textAlign: "left" }}>السعر</th>
                <th style={{ textAlign: "center" }}>الكمية</th>
                <th style={{ textAlign: "center" }}>المخزون</th>
                <th style={{ textAlign: "left" }}>الإجمالي</th>
                <th style={{ textAlign: "center" }}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.cartKey} className={`${highlightRow === item.cartKey ? "ei-row-highlight" : ""} ${item.originalQty === 0 ? "ei-row-new" : ""}`}>
                  <td>
                    <div className="ei-product-name">
                      {item.originalQty === 0 && <span className="ei-new-chip">جديد</span>}
                      {item.name}
                    </div>
                    {(item.size || item.color) && (
                      <div className="ei-product-variant">{item.size} {item.color}</div>
                    )}
                  </td>
                  <td>
                    <EditableCell
                      value={item.sale_price}
                      type="number"
                      minValue={item.cost_price || 0}
                      onSave={(v) => editField(item.cartKey, "sale_price", v)}
                      style={{ color: "var(--text)" }}
                      showToast={showToast}
                    />
                    <small style={{ color: "var(--text3)", fontSize: 11 }}> ج.م</small>
                  </td>
                  <td>
                    <div className="ei-qty-ctrl">
                      <button className="ei-qty-btn" onClick={() => updateQty(item.cartKey, 1)}>+</button>
                      <span className="ei-qty-val">{item.quantity}</span>
                      <button className="ei-qty-btn" onClick={() => updateQty(item.cartKey, -1)}>−</button>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="ei-stock-badge" style={{ background: stockColor(item.stock, item.quantity) }}>
                      {item.stock - item.quantity} متبقي
                    </span>
                  </td>
                  <td>
                    <span className="ei-total-cell">{(item.quantity * item.sale_price).toFixed(2)}</span>
                    <small style={{ color: "var(--text3)", fontSize: 11 }}> ج.م</small>
                  </td>
                  <td>
                    <button className="ei-del-btn" onClick={() => setDeleteTarget(item)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="ei-empty-row">
                      <div className="ei-empty-icon">🛒</div>
                      <div>السلة فارغة</div>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>ابحث أو امسح باركود لإضافة منتج</div>
                    </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary sidebar */}
        <div className="ei-summary">
          <div className="ei-summary-header">
            <div className="ei-summary-header-icon"><ShoppingCart size={16} /></div>
            فاتورة #{invoice?.invoice_number}
          </div>

          <div className="ei-summary-body">
            {/* Seller Section */}
            <div className="ei-customer-section">
              <div className="ei-customer-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} /> البائع / الكاشير
                </div>
                <button 
                  onClick={() => setShowSellerModal(true)}
                  style={{ 
                    fontSize: '12px', 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    color: '#3b82f6', 
                    border: '1px solid rgba(59, 130, 246, 0.3)', 
                    padding: '4px 10px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <RotateCcw size={14} /> تغيير البائع
                </button>
              </div>
              
              <div style={{ 
                background: 'var(--surface2)', 
                padding: '10px', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{seller?.name || invoice?.seller_name || "—"}</span>
                  {seller?.commission_rate !== undefined && (
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '8px' }}>
                      عمولة: {seller.commission_rate}%
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--accent)' }}>
                  {seller?.total_sales > 0 && `إجمالي المبيعات: ${seller.total_sales.toFixed(0)} ج.م`}
                </span>
              </div>
            </div>

            <div className="ei-calc-divider" />

            {/* Customer Section */}
            <div className="ei-customer-section">
              <div className="ei-customer-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} /> بيانات العميل
                </div>
                
                {(customer.name || customer.phone) && (
                  <button 
                    onClick={() => {
                      setCustomer({ name: "", phone: "", address: "" });
                      setCustomerId(null);
                      setCustomerSuggestions([]);
                    }}
                    style={{ 
                      fontSize: '12px', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      color: '#ef4444', 
                      border: 'none', 
                      padding: '4px 10px', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3
                    }}
                  >
                    <RotateCcw size={14} /> تغيير العميل
                  </button>
                )}
              </div>

              <CustomerField
                icon={<User size={12} />}
                label="اسم العميل"
                value={customer.name}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                suggestions={customerSuggestions}
                onSelectSuggestion={selectCustomer}
                placeholder="ابحث باسم العميل…"
                onAddNew={onAddNewCustomerAction}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <CustomerField
                  icon={<Phone size={12} />}
                  label="الهاتف"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                />
                <CustomerField
                  icon={<MapPin size={12} />}
                  label="العنوان"
                  value={customer.address}
                  onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                  placeholder="المدينة…"
                />
              </div>

              {!customerId && customer.name.length > 2 && (
                <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={14} /> سيتم تسجيل "{customer.name}" كعميل جديد تلقائياً
                </div>
              )}
            </div>

            <div className="ei-calc-divider" />

            {/* Totals */}
            <div className="ei-calc-row">
              <span className="lbl">الإجمالي الفرعي</span>
              <span className="val">{totalBefore.toFixed(2)} ج.م</span>
            </div>

            <div className="ei-calc-row" style={{ alignItems: "flex-start" }}>
              <span className="lbl" style={{ paddingTop: 8 }}>خصم</span>
              <div className="ei-discount-row">
                <input
                  type="number"
                  value={discount.value}
                  onChange={(e) => setDiscount((d) => ({ ...d, value: e.target.value }))}
                  className="ei-discount-input"
                  style={{ width: 70 }}
                />
                <select
                  value={discount.type}
                  onChange={(e) => setDiscount((d) => ({ ...d, type: e.target.value }))}
                  className="ei-discount-select"
                >
                  <option value="fixed">ج.م</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>

            {discAmt > 0 && (
              <div className="ei-calc-row">
                <span className="lbl">قيمة الخصم</span>
                <span style={{ color: "var(--red)", fontWeight: 600 }}>− {discAmt.toFixed(2)} ج.م</span>
              </div>
            )}

            <div className="ei-calc-divider" />

            <div className="ei-calc-row ei-calc-total">
              <span className="lbl">الصافي النهائي</span>
              <span className="val">{finalTotal.toFixed(2)} ج.م</span>
            </div>

            {/* Payment methods */}
            <div className="ei-payment-label">طريقة الدفع</div>
            <div className="ei-payment-methods">
              {[
                { id: "cash", label: "كاش", icon: <Banknote size={18} />, cls: "green" },
                { id: "visa", label: "فيزا", icon: <CreditCard size={18} /> },
                { id: "installment", label: "تقسيط", icon: <Repeat size={18} /> },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`ei-pay-btn ${paymentMethod === m.id ? `active ${m.cls || ""}` : ""}`}
                  onClick={() => {
                    setPaymentMethod(m.id);
                    if (m.id !== "installment") setPaidAmount(finalTotal);
                  }}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === "installment" && (
              <div className="ei-installment-box">
                <div className="ei-installment-label">المبلغ المدفوع مقدماً</div>
                <input
                  type="number"
                  value={paidAmount}
                  className="ei-installment-input"
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
                <div className="ei-remaining-row">
                  <span className="lbl">المتبقي على العميل</span>
                  <span className="val">{remaining.toFixed(2)} ج.م</span>
                </div>
              </div>
            )}
          </div>

          <div className="ei-summary-footer">
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexDirection: "column" }}>
              <button className="ei-btn ei-btn-save" onClick={() => setShowConfirm(true)} disabled={saving} style={{ width: "100%" }}>
                <Save size={17} />
                {saving ? "جاري الحفظ…" : "حفظ التعديلات"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  className="ei-btn ei-btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    setPrintMode("save_only");
                    setShowConfirm(true);
                  }}
                  disabled={saving}
                >
                  <Save size={15} /> حفظ بدون طباعة
                </button>
                <button className="ei-btn ei-btn-ghost" style={{ flex: 1 }} onClick={() => { setActiveInvoiceId(null); setInvoiceInput(""); }}>
                  <X size={14} /> إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="ei-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="ei-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ei-modal-header">
              <div className="ei-modal-icon red"><AlertTriangle size={20} /></div>
              <div>
                <div className="ei-modal-title">حذف الصنف</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>هذا الإجراء سيزيل الصنف من الفاتورة</div>
              </div>
            </div>
            <div className="ei-modal-body">
              <div style={{ fontSize: 14, color: "var(--text2)" }}>
                هل تريد حذف <strong style={{ color: "var(--text)" }}>{deleteTarget.name}</strong> من الفاتورة؟
              </div>
            </div>
            <div className="ei-modal-footer">
              <button
                className="ei-btn ei-btn-danger"
                style={{ flex: 2, justifyContent: "center" }}
                onClick={() => { setCart(cart.filter((i) => i.cartKey !== deleteTarget.cartKey)); setDeleteTarget(null); }}
              >
                <Trash2 size={14} /> نعم، احذف
              </button>
              <button className="ei-btn ei-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setDeleteTarget(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save confirm modal */}
      {showConfirm && (
        <div className="ei-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="ei-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ei-modal-header">
              <div className="ei-modal-icon green"><CheckCircle2 size={20} /></div>
              <div>
                <div className="ei-modal-title">تأكيد حفظ التعديلات</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>مراجعة البيانات قبل الحفظ</div>
              </div>
            </div>
            <div className="ei-modal-body">
              {[
                { lbl: "عدد الأصناف", val: `${cart.length} صنف` },
                { lbl: "البائع", val: seller?.name || invoice?.seller_name || "—" },
                { lbl: "العميل", val: customer.name || "—" },
                { lbl: "الإجمالي قبل الخصم", val: `${totalBefore.toFixed(2)} ج.م` },
                ...(discAmt > 0 ? [{ lbl: "الخصم", val: `− ${discAmt.toFixed(2)} ج.م`, color: "var(--red)" }] : []),
                { lbl: "طريقة الدفع", val: { cash: "💵 كاش", visa: "💳 فيزا", installment: "📅 تقسيط" }[paymentMethod] },
                ...(paymentMethod === "installment" ? [
                  { lbl: "المدفوع", val: `${actualPaid.toFixed(2)} ج.م` },
                  { lbl: "المتبقي", val: `${remaining.toFixed(2)} ج.م`, color: "var(--amber)" },
                ] : []),
              ].map((row, i) => (
                <div key={i} className="ei-calc-row" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 2 }}>
                  <span className="lbl">{row.lbl}</span>
                  <span className="val" style={{ color: row.color }}>{row.val}</span>
                </div>
              ))}
              <div className="ei-calc-row ei-calc-total" style={{ marginTop: 4 }}>
                <span className="lbl">الصافي النهائي</span>
                <span className="val">{finalTotal.toFixed(2)} ج.م</span>
              </div>
              <div className="ei-warning-box">
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                سيتم تحديث المخزون تلقائياً بناءً على التغييرات في الكميات.
              </div>
            </div>
            <div className="ei-modal-footer">
              <button 
                className="ei-btn ei-btn-primary" 
                style={{ flex: 2, justifyContent: "center" }} 
                onClick={() => saveEdits(printMode !== "save_only")} 
                disabled={saving}
              >
                <Save size={15} /> {saving ? "جاري الحفظ…" : "تأكيد الحفظ"}
              </button>
              <button className="ei-btn ei-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setShowConfirm(false); setPrintMode(null); }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seller Selection Modal */}
      {showSellerModal && (
        <div className="ei-modal-overlay" onClick={() => setShowSellerModal(false)}>
          <div className="ei-modal" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="ei-modal-header">
              <div className="ei-modal-icon"><Users size={20} /></div>
              <div>
                <div className="ei-modal-title">تغيير البائع / الكاشير</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>اختر البائع لهذه الفاتورة</div>
              </div>
            </div>
            <div className="ei-modal-body">
              {employeesList.length === 0 ? (
                <p style={{ textAlign: "center", padding: "20px", color: "var(--text3)" }}>
                  لا يوجد موظفون نشطون
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <select
                    className="premium-select"
                    style={{ padding: "12px", fontSize: "14px", width: "100%" }}
                    onChange={(e) => {
                      const selected = employeesList.find(emp => emp.id === parseInt(e.target.value));
                      if (selected) selectSeller(selected);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- اختر البائع --</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - عمولة: {emp.commission_rate || 0}% {emp.total_sales > 0 ? `| إجمالي المبيعات: ${emp.total_sales.toFixed(2)} ج.م` : ''}
                      </option>
                    ))}
                  </select>
                  
                  <div style={{ 
                    background: "var(--surface2)", 
                    padding: "10px", 
                    borderRadius: "6px", 
                    fontSize: "11px",
                    color: "var(--text3)"
                  }}>
                    <span>💡 تغيير البائع سيؤثر على حساب العمولة</span>
                  </div>
                </div>
              )}
            </div>
            <div className="ei-modal-footer">
              <button className="ei-btn ei-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowSellerModal(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EditBill;