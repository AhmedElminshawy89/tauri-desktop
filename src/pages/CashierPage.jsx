import { useState, useEffect, useRef, useCallback } from "react";
import { getDb } from "../lib/db";
import { Banknote,CreditCard,Repeat,Printer,PauseCircle,Clock, ShoppingCart,} from "lucide-react";
import PendingPanel from "../features/models/PendingPanel";
import DeleteConfirm from "../features/models/DeleteConfirm";
import PaymentModal from "../features/models/PaymentModal";

const getNextInvoiceNumber = async (db) => {
  try {
    const rows = await db.select(
      "SELECT id FROM invoices ORDER BY id DESC LIMIT 1"
    );
    
    const lastId = rows[0]?.id ? Number(rows[0].id) : 0;
    const nextId = lastId + 1;

    return String(nextId).padStart(4, "0");
  } catch (error) {
    console.error("Error fetching next invoice number:", error);
    return "0001";
  }
};

const EditableCell = ({
  value,
  onSave,
  type = "text",
  style = {},
  minValue,
  showToast,
}) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef();

  useEffect(() => {
    setVal(value);
  }, [value]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = type === "number" ? parseFloat(val) || 0 : val;
    if (minValue !== undefined && parsed < minValue) {
      showToast(`القيمة لا يمكن أن تقل عن ${minValue}`, "error");
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
          if (e.key === "Escape") {
            setVal(value);
            setEditing(false);
          }
        }}
      />
    );

  return (
    <span
      className="editable-cell"
      style={style}
      onClick={() => setEditing(true)}
      title="اضغط للتعديل"
    >
      {value}
      <span className="edit-pencil">✎</span>
    </span>
  );
};

const CashierPage = ({ showToast }) => {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pos_cart") || "[]");
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [discount, setDiscount] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("pos_discount") || '{"value":0,"type":"fixed"}'
      );
    } catch {
      return { value: 0, type: "fixed" };
    }
  });
  const [customer, setCustomer] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("pos_customer") ||
          '{"name":"عميل نقدي","phone":"","address":""}'
      );
    } catch {
      return { name: "عميل نقدي", phone: "", address: "" };
    }
  });
  const [invoiceNum, setInvoiceNum] = useState(
    () => localStorage.getItem("pos_invoice_num") || ""
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [modalType, setModalType] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingList, setPendingList] = useState([]);

const [resumedInvoiceId, setResumedInvoiceId] = useState(
  () => localStorage.getItem("pos_resumed_id") || null
);
  const [dailySummary, setDailySummary] = useState({ count: 0, total: 0 });
  const [highlightRow, setHighlightRow] = useState(null);
  const [printData, setPrintData] = useState(null);
  const searchInputRef = useRef(null);

  const loadDailySummary = useCallback(async () => {
    try {
      const db = await getDb();
      const today = new Date().toISOString().split("T")[0];
      const rows = await db.select(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(total_after_discount),0) as total
          FROM invoices WHERE status='completed' AND date(created_at)=date($1)`,
        [today]
      );
      if (rows[0])
        setDailySummary({
          count: Number(rows[0].cnt),
          total: Number(rows[0].total),
        });
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select(
        "SELECT * FROM invoices WHERE status='pending' ORDER BY id DESC LIMIT 30"
      );
      setPendingList(rows);
    } catch (e) {
      console.warn(e);
    }
  }, []);


  useEffect(() => {
  loadDailySummary();
  loadPending();
  
  (async () => {
    const savedInv = localStorage.getItem("pos_invoice_num");
    const savedResumedId = localStorage.getItem("pos_resumed_id");

    if (!savedInv) {
      const db = await getDb();
      const n = await getNextInvoiceNumber(db);
      setInvoiceNum(n);
      localStorage.setItem("pos_invoice_num", n);
    } else {
      setInvoiceNum(savedInv);
    }
    
    if (savedResumedId) {
      setResumedInvoiceId(savedResumedId);
    }
  })();
}, [loadDailySummary, loadPending]);

  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
    localStorage.setItem("pos_customer", JSON.stringify(customer));
    localStorage.setItem("pos_discount", JSON.stringify(discount));
  }, [cart, customer, discount]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        setModalType("payment");
      }
      if (e.key === "F3") {
        e.preventDefault();
        loadPending();
        setModalType("pending");
      }
      if (e.key === "Escape") setModalType(null);
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [loadPending]);


  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select(
        `SELECT 
            p.id, p.name, p.barcode, p.cost_price, p.sale_price, p.category,
            pv.id AS variant_id, pv.color, pv.size, pv.stock, pv.variant_barcode
          FROM products p
          LEFT JOIN product_variants pv ON pv.product_id = p.id
          WHERE (p.name LIKE $1 OR p.barcode = $2 OR pv.variant_barcode = $2)
            AND pv.stock > 0
          LIMIT 12`,
        [`%${q}%`, q]
      );
      setSearchResults(rows);

      if (
        rows.length === 1 &&
        (rows[0].barcode === q || rows[0].variant_barcode === q)
      ) {
        addToCart(rows[0]);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return showToast("المنتج نفذ من المخزن", "error");

    const cartKey = product.variant_id ?? product.id;

    const ex = cart.find((i) => i.cartKey === cartKey);
    if (ex) {
      if (ex.quantity + 1 > product.stock)
        return showToast(`المتاح: ${product.stock}`, "warning");
      setCart(
        cart.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setCart([
        ...cart,
        {
          cartKey,
          id: product.id,
          variant_id: product.variant_id ?? null,
          name: product.name,
          sale_price: product.sale_price,
          cost_price: product.cost_price,
          quantity: 1,
          stock: product.stock,
          size: product.size || "",
          color: product.color || "",
        },
      ]);
      setHighlightRow(cartKey);
      setTimeout(() => setHighlightRow(null), 900);
    }
    setSearchQuery("");
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQty = (cartKey, delta) => {
    setCart(
      cart.map((item) => {
        if (item.cartKey !== cartKey) return item;
        const nq = item.quantity + delta;
        if (delta > 0 && nq > item.stock) {
          showToast(`المتاح: ${item.stock}`, "warning");
          return item;
        }
        return nq > 0 ? { ...item, quantity: nq } : item;
      })
    );
  };

  const editField = (cartKey, field, raw) => {
    const value = field === "sale_price" ? parseFloat(raw) || 0 : raw;
    setCart(
      cart.map((i) => {
        if (i.cartKey !== cartKey) return i;
        if (field === "sale_price" && value < (i.cost_price || 0)) {
          showToast(
            `السعر لا يمكن أن يقل عن التكلفة (${i.cost_price} ج.م)`,
            "error"
          );
          return i;
        }
        return { ...i, [field]: value };
      })
    );
  };


  const handleCustomerSearch = async (name) => {
    setCustomer({ ...customer, name });
    if (name.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select(
        `SELECT DISTINCT customer_name, customer_phone, customer_address
          FROM invoices WHERE customer_name LIKE $1 LIMIT 6`,
        [`%${name}%`]
      );
      setCustomerSuggestions(rows);
    } catch (e) {
      console.warn(e);
    }
  };

  const selectCustomer = (c) => {
    setCustomer({
      name: c.customer_name,
      phone: c.customer_phone || "",
      address: c.customer_address || "عميل نقدي",
    });
    setCustomerSuggestions([]);
  };

const saveNewCustomerIfNeeded = async (dbInstance) => {
  // 1. التحقق من الاسم
  if (!customer.name || customer.name.trim() === "" || customer.name === "عميل نقدي") {
    showToast("يرجى إدخال اسم عميل صالح", "warning");
    return;
  }

  try {
    const db = dbInstance || (await getDb());
    
    // 2. التحقق من وجود العميل (تأكد أن المقارنة دقيقة)
    const existing = await db.select(
      "SELECT id FROM customers WHERE name = $1 OR (phone = $2 AND phone != '') LIMIT 1",
      [customer.name.trim(), customer.phone ? customer.phone.trim() : ""]
    );

    if (existing && existing.length > 0) {
      showToast("هذا العميل مسجل بالفعل", "info");
      return;
    }

    // 3. الحفظ الفعلي
    await db.execute(
      "INSERT INTO customers (name, phone, address, points) VALUES ($1, $2, $3, $4)",
      [
        customer.name.trim(), 
        customer.phone ? customer.phone.trim() : "", 
        customer.address || "",
        0 // إضافة القيمة الافتراضية للنقاط لتجنب أخطاء NULL
      ]
    );

    // 4. النجاح وتصفير المودال
    showToast("تم حفظ العميل بنجاح", "success");
    
    // تأكد من استدعاء الدوال بشكل صحيح لتجنب الكراش
    if (typeof setModalType === 'function') setModalType(null);
    if (typeof setCustomer === 'function') {
        setCustomer({ name: "عميل نقدي", phone: "", address: "", points: 0 });
    }
    
  } catch (err) {
    // إذا وصل هنا والبيانات حُفظت فعلاً، فهذا يعني أن الخطأ في الدوال التي تلي الحفظ (مثل setModalType)
    console.error("Error Detail:", err);
    
    // فحص ذكي: إذا كان الخطأ متعلق بـ Unique constraint فالعميل موجود
    if (err.toString().includes("UNIQUE")) {
        showToast("هذا الاسم أو الهاتف مسجل لعميل آخر", "error");
    } else {
        showToast("حدث خطأ بسيط بعد الحفظ", "warning");
    }
  }
};


  const totalBefore = cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const discAmt =
    discount.type === "percent"
      ? totalBefore * (parseFloat(discount.value || 0) / 100)
      : parseFloat(discount.value || 0);
  const finalTotal = Math.max(0, totalBefore - discAmt);
const DiscountLabel = discount.value && parseFloat(discount.value) > 0 
  ? `${discount.value} ${discount.type === "percent" ? "%" : "ج.م"}` 
  : "بدون خصم";

const saveInvoice = async (status = "completed", paymentData = null) => {
  if (cart.length === 0) return showToast("السلة فارغة", "error");
  
  try {
    const db = await getDb();
    const currentResumedId = resumedInvoiceId || localStorage.getItem("pos_resumed_id");
    
    // إذا كانت الفاتورة مستأنفة، نحذف القديم
    if (currentResumedId) {
      await db.execute("DELETE FROM invoice_items WHERE invoice_id=$1", [currentResumedId]);
      await db.execute("DELETE FROM invoices WHERE id=$1", [currentResumedId]);
    }

    const freshNum = await getNextInvoiceNumber(db);
    const useNum = currentResumedId ? invoiceNum : freshNum;

    // استخراج بيانات الدفع (أو قيم افتراضية للكاش)
    const method = paymentData?.method || "cash";
    const paidAmount = paymentData?.paid_amount ?? finalTotal;
    const remainingAmount = paymentData?.remaining_amount ?? 0;
    const installmentsCount = paymentData?.installments_count ?? 1;

    // 1. حفظ الفاتورة الرئيسية
    const res = await db.execute(
      `INSERT INTO invoices (
        invoice_number, customer_name, customer_phone, customer_address, 
        total_before_discount, discount_value, discount_type, total_after_discount, 
        status, payment_method, paid_amount, remaining_amount, installments_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        useNum, customer.name, customer.phone, customer.address || "", 
        totalBefore, discount.value, discount.type, finalTotal, 
        status, method, paidAmount, remainingAmount, installmentsCount
      ]
    );
    
    const lid = res.lastInsertId;

    // 2. حفظ تفاصيل الأصناف
    for (const item of cart) {
      await db.execute(
        `INSERT INTO invoice_items (invoice_id, product_id, variant_id, product_name, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [lid, item.id, item.variant_id, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price]
      );

      // خصم المخزون فقط لو الحالة مكتملة
      if (status === "completed") {
        const table = item.variant_id ? "product_variants" : "products";
        await db.execute(`UPDATE ${table} SET stock=stock-$1 WHERE id=$2`, [item.quantity, item.variant_id || item.id]);
      }
    }

    // 3. حفظ خطة الأقساط (إذا وجد متبقي وتقسيط)
    if (method === "installment" && paymentData?.installment_plan?.length > 0) {
      for (const plan of paymentData.installment_plan) {
        await db.execute(
          `INSERT INTO installment_plan (invoice_id, due_date, amount, status)
           VALUES ($1, $2, $3, 'pending')`,
          [lid, plan.due_date, plan.amount]
        );
      }
    }

    showToast(status === "completed" ? "تم حفظ الفاتورة بنجاح" : "تم تعليق الفاتورة", "success");
    
    // الطباعة
    if (status === "completed") {
        // يمكنك تمرير Lid هنا للـ Print Component لو محتاج تطبع بيانات القسط
        setTimeout(() => window.print(), 300);
    }

    await loadDailySummary();
    await loadPending();
    resetPage(db);
    setModalType(null);

  } catch (err) { 
    console.error(err);
    showToast("خطأ في الحفظ: " + err.message, "error"); 
  }
};


  const resumeInvoice = async (inv) => {
    try {
      const db = await getDb();
      const items = await db.select(
        `SELECT ii.*, 
                pv.stock AS variant_stock, pv.color, pv.size,
                p.cost_price, p.sale_price AS original_price
          FROM invoice_items ii
          LEFT JOIN product_variants pv ON pv.id = ii.variant_id
          LEFT JOIN products p ON p.id = ii.product_id
          WHERE ii.invoice_id = $1`,
        [inv.id]
      );

      setCart(
        items.map((i) => ({
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
        }))
      );

      setCustomer({
        name: inv.customer_name,
        phone: inv.customer_phone || "",
        address: inv.customer_address || "",
      });
      

      setInvoiceNum(inv.invoice_number);
localStorage.setItem("pos_resumed_id", inv.id);
    localStorage.setItem("pos_invoice_num", inv.invoice_number);
      setResumedInvoiceId(inv.id);

      showToast("تم تحميل الفاتورة المعلقة", "success");
      setModalType(null);
    } catch (err) {
      console.error(err);
      showToast("خطأ في الاستئناف", "error");
    }
  };


  const cancelPendingInvoice = async (inv) => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM invoice_items WHERE invoice_id=$1", [
        inv.id,
      ]);
      await db.execute("DELETE FROM invoices WHERE id=$1", [inv.id]);
      showToast("تم إلغاء الفاتورة المعلقة", "success");
      await loadPending();
    } catch (err) {
      showToast("خطأ في الإلغاء", "error");
    }
  };

  const resetPage = async (dbInstance) => {
    setCart([]);
    setCustomer({ name: "عميل نقدي", phone: "", address: "" });
    setDiscount({ value: 0, type: "fixed" });
    setResumedInvoiceId(null);
const keysToRemove = [
    "pos_cart", 
    "pos_customer", 
    "pos_discount", 
    "pos_resumed_id", 
    "pos_invoice_num"
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
    try {
      const db = dbInstance || (await getDb());
      const n = await getNextInvoiceNumber(db);
      setInvoiceNum(n);
      localStorage.setItem("pos_invoice_num", n);
    } catch {
      setInvoiceNum(String(Date.now()).slice(-5));
    }
    ["pos_cart", "pos_customer", "pos_discount"].forEach((k) =>
      localStorage.removeItem(k)
    );
  };

  const stockColor = (stock, qty) => {
    const r = stock - qty;
    return r <= 0 ? "#e74c3c" : r <= 3 ? "#e67e22" : "#2ecc71";
  };


  return (
    <div className="ei-root ei-animate" dir="rtl">
      <div className="ei-topbar">
        <div className="daily-item">
          <span className="daily-label">فواتير اليوم</span>
          <span className="daily-val">{dailySummary.count}</span>
        </div>
        <div className="daily-sep" />
        <div className="daily-item">
          <span className="daily-label">إجمالي اليوم</span>
          <span className="daily-val green">
            {Number(dailySummary.total).toFixed(2)} ج.م
          </span>
        </div>
        <div className="daily-sep" />
        <div className="ei-shortcut">
          <kbd>/ بحث</kbd>
          <kbd>↵ أضف</kbd>
          <kbd>F2 دفع</kbd>
          <kbd>F3 معلقة</kbd>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',flex:1,alignItems:'center'}}>
        {resumedInvoiceId && (
          <div
            className="badge-warning"
          >
             فاتورة معلقة محملة
          </div>
        )}
        
          {resumedInvoiceId && (
            <button
              className="btn-cancel"
              style={{ background: "#c0392b",maxWidth: "130px", fontSize: 16,fontWeight:900 ,padding:'6px 12px' }}
              onClick={() => {
                cancelPendingInvoice({ id: resumedInvoiceId });
                resetPage();
              }}
            >
              ✕ إلغاء الاستئناف
            </button>
          )}

        </div>
      </div>

      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">
            كاشير المبيعات{" "}
            <span className="count-badge">{cart.length} صنف</span>
          </h2>
          <p className="sub-title">
            فاتورة رقم: <strong>#{invoiceNum}</strong>
            {resumedInvoiceId && (
              <span className="badge-warning">
                (مستأنفة)
              </span>
            )}
          </p>
          
        </div>

        <div className="ei-header-actions" >
          <div className="ei-search-wrap">

          <div className="ei-search-box">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="/ بحث بالاسم أو الباركود..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                searchResults.length > 0 &&
                addToCart(searchResults[0])
              }
            />
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
          </div>

          <button
            className="btn-secondary"
            onClick={() => {
              loadPending();
              setModalType("pending");
            }}
          >
            <Clock size={16} />
            <span>المعلقة</span>
            {pendingList.length > 0 && (
              <span className="badge-red">{pendingList.length}</span>
            )}
          </button>

          <button
            className="btn-save"
            onClick={() => setModalType("add_customer")}
          >
            <span>
              {customer.name !== "عميل نقدي" ? customer.name : "بيانات العميل"}
            </span>
          </button>
        </div>
      </div>

      <div className="ei-layout">
        <div className="ei-table-card" style={{ flex: 2 }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>السعر</th>
                <th style={{ textAlign: "center" }}>الكمية</th>
                <th>المخزون</th>
                <th>الإجمالي</th>
                <th style={{ textAlign: "center" }}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr
                  key={item.cartKey}
                  className={`table-row ${highlightRow === item.cartKey ? "row-highlight" : ""}`}
                >
                  <td>
                    <div className="model-info-premium">
                      <span
                        style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}
                      >
                        {item.name}
                      </span>
                      {(item.size || item.color) && (
                        <span className="tag-season">
                          {item.size} - {item.color}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <EditableCell
                      value={item.sale_price}
                      type="number"
                      minValue={item.cost_price || 0}
                      onSave={(v) => editField(item.cartKey, "sale_price", v)}
                      style={{ color: "#fff", minWidth: 50 }}
                      showToast={showToast}
                    />
                    <small style={{ color: "#bbb" }}> ج.م</small>
                  </td>
                  <td>
                    <div className="qty-control-pos">
                      <button
                        className="qty-btn"
                        onClick={() => updateQty(item.cartKey, 1)}
                      >
                        +
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => updateQty(item.cartKey, -1)}
                      >
                        -
                      </button>
                    </div>
                  </td>
                  <td>
                    <span
                      className="stock-badge"
                      style={{
                        background: stockColor(item.stock, item.quantity),
                      }}
                    >
                      {item.stock - item.quantity} متبقي
                    </span>
                  </td>
                  <td>
                    <strong>
                      {(item.quantity * item.sale_price).toFixed(2)}
                    </strong>{" "}
                    ج.م
                  </td>
                  <td className="text-center">
                    <button
                      className="action-btn delete"
                      onClick={() => setDeleteTarget(item)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      padding: "36px 0",
                      textAlign: "center",
                      color: "#ccc",
                    }}
                  >
                    السلة فارغة — ابحث أو امسح باركود
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ei-summary">
          <div className="ei-summary-header">
                        <div className="ei-summary-header-icon"><ShoppingCart size={16} /></div>
                        فاتورة #{invoiceNum}
          {resumedInvoiceId && (
          <div
            className="badge-warning"
          >
             فاتورة معلقة 
          </div>
        )}
          </div>
          <div className="ei-summary-body">
            <div className="calc-item">
              <span>الإجمالي الفرعي</span>
              <span>{totalBefore.toFixed(2)} ج.م</span>
            </div>
            

              <div className="ei-calc-row" style={{ alignItems: "flex-start" }}>
                <span style={{ paddingTop: 8 ,fontSize:'18px'}}>خصم</span>
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
                  <span style={{ paddingTop: 8 ,fontSize:'18px'}}>قيمة الخصم</span>
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>− {discAmt.toFixed(2)} ج.م </span>
                </div>
              )}
            <hr className="divider-light" />
            <div className="calc-item total-highlight ">
              <span>الصافي النهائي</span>
              <span>{finalTotal.toFixed(2)} ج.م</span>
            </div>
            <div className="customer-preview " style={{marginBottom:20}}>
              <small>إسم العميل: {customer.name}</small>
              {customer.phone && (
                <>
                  <br />
                  <small>رقم الهاتف: {customer.phone}</small>
                </>
              )}
                            {customer.address && (
                <>
                  <br />
                  <small>العنوان: {customer.address}</small>
                </>
              )}
            </div>
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
          </div>
          <div className="ei-summary-footer">
            <button
              className="ei-btn ei-btn-save"
              onClick={() => setModalType("payment")}
            >
              <Printer size={16} style={{ marginLeft: 6 }} /> دفع وطباعة{" "}
              <kbd>F2</kbd>
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="btn-cancel ei-btn"
                style={{ flex: 1 }}
                onClick={() => saveInvoice("pending")}
              >
                <PauseCircle size={15} style={{ marginLeft: 4 }} /> تعليق
              </button>
              <button 
              className="ei-btn ei-btn-save" 
              onClick={() => setModalType("preview_invoice")}
            >
              <Printer size={18} />
              معاينة الفاتورة قبل الطباعة
            </button>
            </div>
            
          </div>
        </div>
      </div>

      {modalType === "add_customer" && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target.className === "modal-overlay" && setModalType(null)
          }
        >
          <div className="modal-content-premium form-modal">
            <div className="modal-header">
              <h3>بيانات العميل</h3>
            </div>
            <div className="premium-form">
              <div
                className="input-group full-width"
                style={{ position: "relative" }}
              >
                <label>اسم العميل</label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  autoComplete="off"
                />
                {customerSuggestions.length > 0 && (
                  <div
                    className="search-dropdown-pos"
                    style={{ top: "100%", width: "100%", zIndex: 999 }}
                  >
                    {customerSuggestions.map((c, i) => (
                      <div
                        key={i}
                        className="search-result-item"
                        onClick={() => selectCustomer(c)}
                      >
                        <span>{c.customer_name}</span>
                        <small>{c.customer_phone}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="input-group">
                <label>رقم الهاتف</label>
                <input
                  type="text"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>عنوان العميل</label>
                <input
                  type="text"
                  value={customer.address}
                  onChange={(e) =>
                    setCustomer({ ...customer, address: e.target.value })
                  }
                />
              </div>
              <div className="modal-footer">
                <button className="btn-save" onClick={() => setModalType(null)}>
                  تأكيد
                </button>
                <button className="btn-save" onClick={() => saveNewCustomerIfNeeded()}>
                 حفظ العميل الجديد
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => setModalType(null)}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalType === "pending" && (
        <PendingPanel
          pendingList={pendingList}
          onResume={resumeInvoice}
          onCancel={cancelPendingInvoice} // ← prop جديد للإلغاء من القائمة
          onClose={() => setModalType(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          item={deleteTarget}
          onConfirm={() => {
            setCart(cart.filter((i) => i.cartKey !== deleteTarget.cartKey));
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
{modalType === "payment" && (
  <PaymentModal
    finalTotal={finalTotal}
    onConfirm={(paymentResult) => saveInvoice("completed", paymentResult)}
    onCancel={() => setModalType(null)}
  />
)}


{/* مودال معاينة الفاتورة الاحترافي - Coding Cashier */}
{modalType === "preview_invoice" && (
  <div className="modal-overlay" style={{ 
    zIndex: 2000, 
    backgroundColor: 'rgba(10, 15, 30, 0.9)', 
    backdropFilter: 'blur(8px)' 
  }}>
    <div className="modal-content-premium" style={{ 
      maxWidth: '400px', 
      padding: '0', 
      background: 'var(--surface)', 
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border2)',
      boxShadow: 'var(--shadow)',
      overflow: 'hidden',
      animation: 'fadeIn 0.3s ease'
    }}>
      
      {/* رأس المودال بتنسيق النظام */}
      <div style={{ 
        padding: '18px', 
        textAlign: 'center', 
        borderBottom: '1px solid var(--border)', 
        background: 'var(--surface2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}>
        <Printer size={18} color="var(--accent)" />
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px', fontWeight: '600' }}>
          معاينة فاتورة: Coding Cashier
        </h3>
      </div>

      {/* منطقة عرض الفاتورة المحاكية للواقع */}
      <div className="scrollable-content" style={{ 
        padding: '25px', 
        display: 'flex', 
        justifyContent: 'center', 
        background: 'var(--bg)',
        maxHeight: '65vh',
        overflowY: 'auto'
      }}>
        {/* جسم الفاتورة - ورق حراري أبيض تقليدي للوضوح عند الطباعة */}
        <div id="thermal-receipt" style={{
          width: '100%',
          maxWidth: '300px',
          background: '#fff',
          padding: '20px',
          color: '#000',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          lineHeight: '1.4'
        }}>
          {/* هيدر الفاتورة */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: '0', fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>اسم المحل</h2>
            <p style={{ margin: '2px 0', fontSize: '10px', color: '#333' }}>الفرع الرئيسي - كفر الشيخ</p>
            <p style={{ margin: '0', fontSize: '10px', fontWeight: 'bold' }}>Coding Cashier System</p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
          

          {/* بيانات العميل والتوقيت */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>رقم: #{invoiceNum}</span>
            <span>{new Date().toLocaleDateString('ar-EG')}</span>
          </div>
          <div style={{ marginTop: '4px', fontWeight: 'bold' }}>العميل: {customer.name}</div>
          {customer.phone && <div style={{ fontSize: '10px' }}>هاتف: {customer.phone}</div>}


          <div style={{ borderBottom: '1px solid #000', margin: '8px 0' }}></div>

          {/* جدول المنتجات */}
          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000' }}>
                <th style={{ padding: '4px 0' }}>الصنف</th>
                <th style={{ textAlign: 'center' }}>ق</th>
                <th style={{ textAlign: 'left' }}>إجمالي</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '0.5px solid #eee' }}>
                  <td style={{ padding: '6px 0' }}>
                    {item.name} {item.size ? `[${item.size}]` : ''}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'left' }}>{(item.quantity * item.sale_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>

          {/* ملخص الحساب */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>الإجمالي:</span>
            <span>{totalBefore.toFixed(2)}</span>
          </div>
          
          {discAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>الخصم:</span>
              <span>-{discAmt.toFixed(2)}</span>
            </div>
          )}
                    {paymentMethod && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>حالة الدفع:</span>
            <span> {
      paymentMethod === "cash" ? "نقداً" : 
      paymentMethod === "installment" ? "أقساط / آجل" : 
      "فيزا"
    }</span>
          </div>

)}

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontWeight: '900', 
            fontSize: '15px', 
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '2px solid #000'
          }}>
            <span>الصافي:</span>
            <span>{finalTotal.toFixed(2)} ج.م</span>
          </div>

          {/* التذييل */}
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '9px', color: '#444' }}>
            <p style={{ margin: '2px 0' }}>شكراً لزيارتكم</p>
            <p style={{ margin: '0', fontWeight: 'bold' }}>Coding Cashier v2.0</p>
          </div>
        </div>
      </div>

      {/* أزرار التحكم بستايل النظام */}
      <div className="modal-footer" style={{ 
        padding: '15px 20px', 
        background: 'var(--surface2)', 
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '10px'
      }}>
        <button 
          className="btn-save" 
          style={{ 
            flex: 2, 
            background: 'var(--accent)', 
            boxShadow: '0 4px 12px var(--accent-glow)',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            fontWeight: '600'
          }} 
          onClick={() => setModalType("payment")}
        >
          متابعة للدفع
        </button>
        
        <button 
          className="btn-cancel" 
          style={{ 
            flex: 1, 
            background: 'transparent', 
            color: 'var(--text2)',
            border: '1px solid var(--border2)',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px'
          }} 
          onClick={() => setModalType(null)}
        >
          تراجع
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default CashierPage;
