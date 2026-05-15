import { useState, useEffect, useRef, useCallback } from "react";
import { getDb } from "../lib/db";
import {
  Banknote,
  CreditCard,
  Repeat,
  Printer,
  PauseCircle,
  Clock,
  ShoppingCart,
  User,
  LogOut,
  Search,
  Save,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Phone,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import PendingPanel from "../features/models/PendingPanel";
import DeleteConfirm from "../features/models/DeleteConfirm";
import PaymentModal from "../features/models/PaymentModal";

const getNextInvoiceNumber = async (db) => {
  try {
    const rows = await db.select(
      "SELECT invoice_number FROM invoices WHERE status IN ('completed', 'pending') ORDER BY id DESC LIMIT 1"
    );

    if (rows.length > 0 && rows[0].invoice_number) {
      const lastNum = parseInt(rows[0].invoice_number, 10);
      if (!isNaN(lastNum)) {
        const nextNum = lastNum + 1;
        return String(nextNum).padStart(4, "0");
      }
    }
    return "0001";
  } catch (error) {
    console.error("Error fetching next invoice number:", error);
    return "0001";
  }
};

const updateEmployeeSales = async (db, employeeId, saleAmount, commissionAmount) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];

    await db.execute(
      `UPDATE employees SET 
        total_sales = COALESCE(total_sales, 0) + $1,
        last_sale_date = $2
       WHERE id = $3`,
      [saleAmount, today, employeeId]
    );

    const existing = await db.select(
      "SELECT id FROM employee_sales_stats WHERE employee_id = $1 AND month = $2 AND year = $3",
      [employeeId, currentMonth, currentYear]
    );

    if (existing && existing.length > 0) {
      await db.execute(
        `UPDATE employee_sales_stats SET 
          total_sales = total_sales + $1,
          invoice_count = invoice_count + 1,
          total_commission = total_commission + $2
         WHERE employee_id = $3 AND month = $4 AND year = $5`,
        [saleAmount, commissionAmount, employeeId, currentMonth, currentYear]
      );
    } else {
      await db.execute(
        `INSERT INTO employee_sales_stats (employee_id, month, year, total_sales, invoice_count, total_commission)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [employeeId, currentMonth, currentYear, saleAmount, 1, commissionAmount]
      );
    }
  } catch (error) {
    console.error("Error updating employee sales:", error);
  }
};

const EditableCell = ({ value, onSave, type = "text", style = {}, minValue, showToast }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    let parsed = val;
    if (type === "number") {
      parsed = parseFloat(val);
      if (isNaN(parsed)) parsed = 0;
    }
    if (minValue !== undefined && parsed < minValue) {
      showToast(`القيمة لا يمكن أن تقل عن ${minValue}`, "error");
      setVal(value);
      return;
    }
    if (String(parsed) !== String(value)) {
      onSave(parsed);
    }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type={type}
        value={val}
        className="ei-inline-input"
        style={{ ...style, width: "70px", padding: "4px 8px" }}
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
  }

  return (
    <span className="ei-editable-cell" style={style} onClick={() => setEditing(true)} title="اضغط للتعديل">
      {type === "number" ? Number(value).toFixed(2) : value}
      <span className="ei-pencil">✎</span>
    </span>
  );
};

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

const CashierPage = ({ showToast }) => {
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [discount, setDiscount] = useState({ value: 0, type: "fixed" });
  const [customer, setCustomer] = useState({ name: "عميل نقدي", phone: "", address: "" });
  const [customerId, setCustomerId] = useState(null);
  const [invoiceNum, setInvoiceNum] = useState("");
  const [modalType, setModalType] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingList, setPendingList] = useState([]);
  const [resumedInvoiceId, setResumedInvoiceId] = useState(null);
  const [dailySummary, setDailySummary] = useState({ count: 0, total: 0 });
  const [highlightRow, setHighlightRow] = useState(null);
  const [currentSeller, setCurrentSeller] = useState(null);
  const [employeesList, setEmployeesList] = useState([]);
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [printMode, setPrintMode] = useState(null);

  const searchInputRef = useRef(null);
  const receiptRef = useRef(null);

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

  const loadDailySummary = useCallback(async () => {
    try {
      const db = await getDb();
      const today = new Date().toISOString().split("T")[0];
      const rows = await db.select(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(total_after_discount),0) as total
         FROM invoices WHERE status='completed' AND date(created_at) = date($1)`,
        [today]
      );
      if (rows && rows[0]) {
        setDailySummary({
          count: Number(rows[0].cnt) || 0,
          total: Number(rows[0].total) || 0,
        });
      }
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
      setPendingList(rows || []);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("pos_cart");
      if (savedCart) setCart(JSON.parse(savedCart));
      const savedCustomer = localStorage.getItem("pos_customer");
      if (savedCustomer) setCustomer(JSON.parse(savedCustomer));
      const savedDiscount = localStorage.getItem("pos_discount");
      if (savedDiscount) setDiscount(JSON.parse(savedDiscount));
      const savedResumed = localStorage.getItem("pos_resumed_id");
      if (savedResumed) setResumedInvoiceId(savedResumed);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const selectSeller = (seller) => {
    setCurrentSeller(seller);
    localStorage.setItem("pos_current_seller", JSON.stringify(seller));
    setShowSellerModal(false);
    showToast(`مرحباً ${seller.name}`, "success");
  };

  const logoutSeller = () => {
    setCurrentSeller(null);
    localStorage.removeItem("pos_current_seller");
    setShowSellerModal(true);
    showToast("تم تسجيل الخروج", "info");
  };

  useEffect(() => {
    const savedSeller = localStorage.getItem("pos_current_seller");
    if (savedSeller) {
      try {
        setCurrentSeller(JSON.parse(savedSeller));
        setShowSellerModal(false);
        loadDailySummary();
        loadPending();
      } catch (e) {
        setShowSellerModal(true);
      }
    } else {
      setShowSellerModal(true);
      loadEmployees();
    }
  }, [loadDailySummary, loadPending]);

  useEffect(() => {
    if (!currentSeller) return;
    
    const initInvoiceNumber = async () => {
      const savedInv = localStorage.getItem("pos_invoice_num");
      if (savedInv) {
        setInvoiceNum(savedInv);
      } else {
        const db = await getDb();
        const n = await getNextInvoiceNumber(db);
        setInvoiceNum(n);
        localStorage.setItem("pos_invoice_num", n);
      }
    };
    initInvoiceNumber();
  }, [currentSeller]);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem("pos_cart", JSON.stringify(cart));
    } else {
      localStorage.removeItem("pos_cart");
    }
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("pos_customer", JSON.stringify(customer));
    localStorage.setItem("pos_discount", JSON.stringify(discount));
  }, [customer, discount]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (cart.length > 0) setModalType("payment");
        else showToast("السلة فارغة", "warning");
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
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, loadPending, showToast]);

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
         LIMIT 15`,
        [`%${q}%`, q]
      );
      setSearchResults(rows || []);

      if (rows && rows.length === 1 && (rows[0].barcode === q || rows[0].variant_barcode === q)) {
        addToCart(rows[0]);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const addToCart = (product) => {
    if (!product) return;
    
    const stock = product.stock || 0;
    if (stock <= 0) {
      showToast("المنتج نفد من المخزن", "error");
      return;
    }

    const cartKey = product.variant_id ?? product.id;
    const existingItem = cart.find((i) => i.cartKey === cartKey);

    if (existingItem) {
      if (existingItem.quantity + 1 > stock) {
        showToast(`المتاح: ${stock} فقط`, "warning");
        return;
      }
      setCart(cart.map((i) =>
        i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([
        ...cart,
        {
          cartKey,
          id: product.id,
          variant_id: product.variant_id ?? null,
          name: product.name,
          sale_price: product.sale_price || 0,
          cost_price: product.cost_price || 0,
          quantity: 1,
          stock: stock,
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

  const updateQuantity = (cartKey, delta) => {
    setCart(
      cart.map((item) => {
        if (item.cartKey !== cartKey) return item;
        const newQty = item.quantity + delta;
        if (delta > 0 && newQty > item.stock) {
          showToast(`المتاح: ${item.stock}`, "warning");
          return item;
        }
        if (newQty <= 0) return null;
        return { ...item, quantity: newQty };
      }).filter(Boolean)
    );
  };

  const editField = (cartKey, field, value) => {
    setCart(
      cart.map((item) => {
        if (item.cartKey !== cartKey) return item;
        if (field === "sale_price" && value < (item.cost_price || 0)) {
          showToast(`السعر لا يمكن أن يقل عن التكلفة (${item.cost_price} ج.م)`, "error");
          return item;
        }
        return { ...item, [field]: value };
      })
    );
  };

  const removeFromCart = (cartKey) => {
    setCart(cart.filter((i) => i.cartKey !== cartKey));
    setDeleteTarget(null);
  };

  const handleCustomerSearch = async (name) => {
    setCustomer({ ...customer, name });
    setCustomerId(null);
    if (name.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
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
      setCustomerSuggestions(rows || []);
    } catch (e) {
      console.warn(e);
    }
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
    showToast("تم اختيار وضع تسجيل عميل جديد", "info");
  };

  const saveNewCustomer = async () => {
    if (!customer.name || customer.name.trim() === "" || customer.name === "عميل نقدي") {
      showToast("يرجى إدخال اسم عميل صالح", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const db = await getDb();
      const existing = await db.select(
        "SELECT id FROM customers WHERE name = $1 OR phone = $2",
        [customer.name.trim(), customer.phone || ""]
      );

      if (existing && existing.length > 0) {
        showToast("هذا العميل مسجل بالفعل", "info");
        setModalType(null);
        return;
      }

      await db.execute(
        "INSERT INTO customers (name, phone, address, points) VALUES ($1, $2, $3, $4)",
        [customer.name.trim(), customer.phone || "", customer.address || "", 0]
      );

      showToast("تم حفظ العميل بنجاح", "success");
      setModalType(null);
    } catch (err) {
      if (err.toString().includes("UNIQUE")) {
        showToast("هذا الاسم أو الهاتف موجود مسبقاً", "error");
      } else {
        showToast("حدث خطأ أثناء الحفظ", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const totalBefore = cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);
  const discountAmount = discount.type === "percent"
    ? totalBefore * (parseFloat(discount.value || 0) / 100)
    : parseFloat(discount.value || 0);
  const finalTotal = Math.max(0, totalBefore - discountAmount);
  const commissionAmount = currentSeller ? (finalTotal * (currentSeller.commission_rate || 0) / 100) : 0;

  const printReceipt = () => {
    const generateReceiptHTML = () => {
      return `
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>فاتورة #${invoiceNum}</title>
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
            
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span>رقم: #${invoiceNum}</span>
              <span>${new Date().toLocaleDateString("ar-EG")}</span>
            </div>
            <div style="font-size: 11px;">العميل: ${customer.name}</div>
            <div style="font-size: 10px;">البائع: ${currentSeller?.name || ''}</div>
            
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
            ${discountAmount > 0 ? `
              <div style="display: flex; justify-content: space-between;">
                <span>الخصم:</span>
                <span>- ${discountAmount.toFixed(2)} ج.م</span>
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

// في CashierPage.jsx، أضف هذه الدالة لحفظ الأقساط
const saveInstallmentPlan = async (db, invoiceId, installmentPlan, paidAmount, finalTotal) => {
  try {
    // حذف أي خطة أقساط قديمة
    await db.execute("DELETE FROM installment_plan WHERE invoice_id = $1", [invoiceId]);
    
    if (installmentPlan && installmentPlan.length > 0) {
      for (const plan of installmentPlan) {
        await db.execute(
          `INSERT INTO installment_plan (invoice_id, due_date, amount_due, status) 
           VALUES ($1, $2, $3, $4)`,
          [invoiceId, plan.due_date, plan.amount_due, plan.status || "pending"]
        );
      }
      console.log(`✅ Saved ${installmentPlan.length} installment plans for invoice ${invoiceId}`);
    }
    
    // تسجيل الدفعة الأولى (المقدم) في سجل الدفعات
    if (paidAmount > 0) {
      await db.execute(
        `INSERT INTO installment_payments (invoice_id, amount_paid, payment_method, payment_date, notes) 
         VALUES ($1, $2, $3, $4, $5)`,
        [invoiceId, paidAmount, "cash", new Date().toISOString(), "دفعة مقدمة (تقسيط)"]
      );
    }
  } catch (error) {
    console.error("Error saving installment plan:", error);
  }
};

// تعديل دالة saveInvoice
const saveInvoice = async (paymentData = null, shouldPrint = true) => {
  if (cart.length === 0) {
    showToast("السلة فارغة", "error");
    return false;
  }

  if (!currentSeller) {
    showToast("الرجاء اختيار البائع أولاً", "warning");
    setShowSellerModal(true);
    return false;
  }

  setIsLoading(true);
  try {
    const db = await getDb();
    
    if (resumedInvoiceId) {
      await db.execute("DELETE FROM invoice_items WHERE invoice_id = $1", [resumedInvoiceId]);
      await db.execute("DELETE FROM invoices WHERE id = $1", [resumedInvoiceId]);
    }

    const invoiceNumber = await getNextInvoiceNumber(db);
    
    const method = paymentData?.method || "cash";
    const paidAmt = paymentData?.paid_amount ?? finalTotal;
    const remainingAmount = paymentData?.remaining_amount ?? (method === "installment" ? finalTotal - paidAmt : 0);
    const installmentsCount = paymentData?.installments_count ?? 0;
    const installmentPlan = paymentData?.installment_plan || [];
    
    let finalCustomerId = customerId;
    if (!finalCustomerId && customer.name.trim() && customer.name !== "عميل نقدي") {
      try {
        const existing = await db.select(
          "SELECT id FROM customers WHERE name = $1 LIMIT 1",
          [customer.name.trim()]
        );
        if (existing.length) {
          finalCustomerId = existing[0].id;
        } else {
          await db.execute(
            "INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3)",
            [customer.name.trim(), customer.phone || "", customer.address || ""]
          );
          const [res] = await db.select("SELECT last_insert_rowid() AS id");
          finalCustomerId = res?.id;
        }
      } catch {
        // customers table may not exist
      }
    }

    const result = await db.execute(
      `INSERT INTO invoices (
        invoice_number, customer_name, customer_phone, customer_address, customer_id,
        total_before_discount, discount_value, discount_type, total_after_discount, 
        status, payment_method, paid_amount, remaining_amount, installments_count,
        seller_id, seller_name, commission_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        invoiceNumber,
        customer.name,
        customer.phone || "",
        customer.address || "",
        finalCustomerId,
        totalBefore,
        discount.value || 0,
        discount.type,
        finalTotal,
        "completed",
        method,
        paidAmt,
        remainingAmount,
        installmentsCount,
        currentSeller.id,
        currentSeller.name,
        commissionAmount
      ]
    );

    const invoiceId = result.lastInsertId;

    // حفظ الأصناف
    for (const item of cart) {
      await db.execute(
        `INSERT INTO invoice_items (invoice_id, product_id, variant_id, product_name, quantity, unit_price, total_price, cost_price_at_sale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [invoiceId, item.id, item.variant_id, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price, item.cost_price || 0]
      );

      const table = item.variant_id ? "product_variants" : "products";
      await db.execute(`UPDATE ${table} SET stock = stock - $1 WHERE id = $2`, [item.quantity, item.variant_id || item.id]);
    }

    // حفظ خطة الأقساط إذا كانت الطريقة تقسيط
    if (method === "installment" && installmentPlan.length > 0) {
      await saveInstallmentPlan(db, invoiceId, installmentPlan, paidAmt, finalTotal);
    }

    await updateEmployeeSales(db, currentSeller.id, finalTotal, commissionAmount);

    showToast("تم حفظ الفاتورة بنجاح", "success");

    if (shouldPrint) {
      try {
        printReceipt();
      } catch (error) {
        console.error("Error printing:", error);
        showToast("تم حفظ الفاتورة ولكن حدث خطأ في الطباعة", "warning");
      }
    }
    
    localStorage.setItem('invoices_updated', Date.now().toString());
    
    await resetPage();
    await loadDailySummary();
    await loadPending();
    return true;

  } catch (err) {
    console.error(err);
    showToast("خطأ في الحفظ: " + err.message, "error");
    return false;
  } finally {
    setIsLoading(false);
    setPrintMode(null);
    setModalType(null);
  }
};

  const savePendingInvoice = async () => {
    if (cart.length === 0) {
      showToast("السلة فارغة", "error");
      return false;
    }

    if (!currentSeller) {
      showToast("الرجاء اختيار البائع أولاً", "warning");
      setShowSellerModal(true);
      return false;
    }

    setIsLoading(true);
    try {
      const db = await getDb();
      
      if (resumedInvoiceId) {
        await db.execute("DELETE FROM invoice_items WHERE invoice_id = $1", [resumedInvoiceId]);
        await db.execute("DELETE FROM invoices WHERE id = $1", [resumedInvoiceId]);
      }

      const invoiceNumber = await getNextInvoiceNumber(db);
      
      let finalCustomerId = customerId;
      if (!finalCustomerId && customer.name.trim() && customer.name !== "عميل نقدي") {
        try {
          const existing = await db.select(
            "SELECT id FROM customers WHERE name = $1 LIMIT 1",
            [customer.name.trim()]
          );
          if (existing.length) {
            finalCustomerId = existing[0].id;
          }
        } catch {
          // customers table may not exist
        }
      }

      await db.execute(
        `INSERT INTO invoices (
          invoice_number, customer_name, customer_phone, customer_address, customer_id,
          total_before_discount, discount_value, discount_type, total_after_discount, 
          status, payment_method, paid_amount, remaining_amount, installments_count,
          seller_id, seller_name, commission_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          invoiceNumber,
          customer.name,
          customer.phone || "",
          customer.address || "",
          finalCustomerId,
          totalBefore,
          discount.value || 0,
          discount.type,
          finalTotal,
          "pending",
          "cash",
          finalTotal,
          0,
          1,
          currentSeller.id,
          currentSeller.name,
          commissionAmount
        ]
      );

      showToast("تم تعليق الفاتورة بنجاح", "success");
      
      resetCartAndCustomer();
      const nextNumber = await getNextInvoiceNumber(db);
      setInvoiceNum(nextNumber);
      localStorage.setItem("pos_invoice_num", nextNumber);
      setModalType(null);

      await loadDailySummary();
      await loadPending();
      return true;

    } catch (err) {
      console.error(err);
      showToast("خطأ في الحفظ: " + err.message, "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetCartAndCustomer = () => {
    setCart([]);
    setCustomer({ name: "عميل نقدي", phone: "", address: "" });
    setCustomerId(null);
    setDiscount({ value: 0, type: "fixed" });
    setResumedInvoiceId(null);
    
    localStorage.removeItem("pos_cart");
    localStorage.removeItem("pos_customer");
    localStorage.removeItem("pos_discount");
    localStorage.removeItem("pos_resumed_id");
  };

  const resetPage = async () => {
    resetCartAndCustomer();
    
    const db = await getDb();
    const newNumber = await getNextInvoiceNumber(db);
    setInvoiceNum(newNumber);
    localStorage.setItem("pos_invoice_num", newNumber);
  };

  const resumeInvoice = async (inv) => {
    try {
      const db = await getDb();
      const items = await db.select(
        `SELECT ii.*, pv.stock AS variant_stock, pv.color, pv.size, p.cost_price
         FROM invoice_items ii
         LEFT JOIN product_variants pv ON pv.id = ii.variant_id
         LEFT JOIN products p ON p.id = ii.product_id
         WHERE ii.invoice_id = $1`,
        [inv.id]
      );

      if (items && items.length > 0) {
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
        })));
      }

      setCustomer({
        name: inv.customer_name,
        phone: inv.customer_phone || "",
        address: inv.customer_address || "",
      });
      setCustomerId(inv.customer_id ?? null);
      setDiscount({ value: inv.discount_value ?? 0, type: inv.discount_type || "fixed" });

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
      await db.execute("DELETE FROM invoice_items WHERE invoice_id = $1", [inv.id]);
      await db.execute("DELETE FROM invoices WHERE id = $1", [inv.id]);
      showToast("تم إلغاء الفاتورة المعلقة", "success");
      await loadPending();
    } catch (err) {
      showToast("خطأ في الإلغاء", "error");
    }
  };

  const stockColor = (stock, qty) => {
    const remaining = stock - qty;
    if (remaining <= 0) return "#ef4444";
    if (remaining <= 3) return "#f59e0b";
    return "#10b981";
  };

  if (showSellerModal) {
    return (
      <div className="ei-root" dir="rtl">
        <div className="ei-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="ei-modal" style={{ maxWidth: "500px" }}>
            <div className="ei-modal-header">
              <div className="ei-modal-icon"><Users size={20} /></div>
              <div>
                <div className="ei-modal-title">اختر البائع / الكاشير</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>اختر البائع لبدء جلسة البيع</div>
              </div>
            </div>
            <div className="ei-modal-body">
              {employeesList.length === 0 ? (
                <p style={{ textAlign: "center", padding: "20px", color: "var(--text3)" }}>
                  لا يوجد موظفون نشطون. الرجاء إضافة موظفين أولاً.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  <select
                    className="premium-select"
                    style={{ padding: "14px", fontSize: "16px", width: "100%" }}
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
                    padding: "12px", 
                    borderRadius: "8px", 
                    fontSize: "12px",
                    color: "var(--text2)"
                  }}>
                    <span>💡 اختر البائع من القائمة المنسدلة</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSeller) {
    return (
      <div className="ei-root" dir="rtl">
        <div className="ei-loading">
          <RotateCcw size={32} className="ei-spinner" />
          <p>جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei-root ei-animate" dir="rtl">
      {/* Top Bar */}
      <div className="ei-topbar">
        <div className="ei-topbar-badge">
          <div>
            <span className="lbl">فواتير اليوم</span>
            <span className="val">{dailySummary.count}</span>
          </div>
        </div>
        <div className="ei-topbar-sep" />
        <div className="ei-topbar-badge">
          <div>
            <span className="lbl">إجمالي اليوم</span>
            <span className="val" style={{ color: "var(--green)" }}>{dailySummary.total.toFixed(2)} ج.م</span>
          </div>
        </div>
        <div className="ei-topbar-sep" />

        <div className="ei-topbar-badge">
          <div>
            <span className="lbl">البائع</span>
            <span className="val" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={14} /> {currentSeller.name}
              <span style={{ fontSize: "11px", color: "var(--text3)" }}>(عمولة: {currentSeller.commission_rate || 0}%)</span>
              {currentSeller.total_sales > 0 && (
                <span style={{ fontSize: "11px", color: "var(--green)", marginRight: "4px" }}>
                  📊 {currentSeller.total_sales.toFixed(0)} ج.م
                </span>
              )}
              <button onClick={logoutSeller} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginRight: "4px" }} title="تسجيل خروج">
                <LogOut size={12} />
              </button>
            </span>
          </div>
        </div>

        <div className="ei-topbar-spacer" />
        <div className="ei-shortcut">
          <kbd>/ بحث</kbd>
          <kbd>F2 دفع</kbd>
          <kbd>F3 معلقة</kbd>
        </div>
      </div>

      {/* Page Header */}
      <div className="ei-page-header">
        <div>
          <h2 className="ei-page-title">
            كاشير المبيعات
            <span className="ei-count-badge" style={{ marginRight: 10 }}>{cart.length} أصناف</span>
          </h2>
          <p className="ei-page-sub">
            فاتورة رقم: <strong style={{ color: "var(--text)" }}>#{invoiceNum}</strong>
            {resumedInvoiceId && <span className="ei-edit-badge" style={{ marginRight: 8 }}>(مستأنفة)</span>}
          </p>
        </div>
        <div className="ei-header-actions">
          <div className="ei-search-wrap">
            <div className="ei-search-box">
              <Search size={16} style={{ color: "var(--text3)" }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="/ بحث بالاسم أو الباركود..."
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
                      <div className="pname">{p.name}</div>
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

          <button className="ei-btn ei-btn-secondary" onClick={() => { loadPending(); setModalType("pending"); }}>
            <Clock size={16} />
            <span>المعلقة</span>
            {pendingList.length > 0 && <span className="badge-red" style={{ marginRight: 4 }}>{pendingList.length}</span>}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="ei-layout">
        {/* Cart Table */}
        <div className="ei-table-card">
          <table className="ei-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th style={{ textAlign: "left" }}>السعر</th>
                <th style={{ textAlign: "center" }}>الكمية</th>
                <th style={{ textAlign: "center" }}>المخزون</th>
                <th style={{ textAlign: "left" }}>الإجمالي</th>
                <th style={{ textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.cartKey} className={highlightRow === item.cartKey ? "ei-row-highlight" : ""}>
                  <td>
                    <div className="ei-product-name">
                      {item.name}
                      {(item.size || item.color) && (
                        <div className="ei-product-variant">{item.size} {item.color}</div>
                      )}
                    </div>
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
                      <button className="ei-qty-btn" onClick={() => updateQuantity(item.cartKey, 1)}>+</button>
                      <span className="ei-qty-val">{item.quantity}</span>
                      <button className="ei-qty-btn" onClick={() => updateQuantity(item.cartKey, -1)}>−</button>
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

        {/* Summary Card */}
        <div className="ei-summary">
          <div className="ei-summary-header">
            <div className="ei-summary-header-icon"><ShoppingCart size={16} /></div>
            فاتورة #{invoiceNum}
          </div>
          
          <div className="ei-summary-body">
            {/* Customer Section */}
            <div className="ei-customer-section">
              <div className="ei-customer-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} /> بيانات العميل
                </div>
                {(customer.name !== "عميل نقدي" || customer.phone) && (
                  <button 
                    onClick={() => {
                      setCustomer({ name: "عميل نقدي", phone: "", address: "" });
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

              {!customerId && customer.name.length > 2 && customer.name !== "عميل نقدي" && (
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
                  onChange={(e) => setDiscount({ ...discount, value: e.target.value })}
                  className="ei-discount-input"
                  style={{ width: 70 }}
                />
                <select
                  value={discount.type}
                  onChange={(e) => setDiscount({ ...discount, type: e.target.value })}
                  className="ei-discount-select"
                >
                  <option value="fixed">ج.م</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            
            {discountAmount > 0 && (
              <div className="ei-calc-row">
                <span className="lbl">قيمة الخصم</span>
                <span style={{ color: "var(--red)", fontWeight: 600 }}>- {discountAmount.toFixed(2)} ج.م</span>
              </div>
            )}
            
            <div className="ei-calc-divider" />
            
            <div className="ei-calc-row ei-calc-total">
              <span className="lbl">الصافي النهائي</span>
              <span className="val">{finalTotal.toFixed(2)} ج.م</span>
            </div>

            {commissionAmount > 0 && (
              <div className="ei-calc-row" style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
                <span className="lbl" style={{ fontSize: "12px", color: "var(--accent)" }}>عمولة {currentSeller.name}:</span>
                <span className="val" style={{ fontSize: "12px", color: "var(--accent)" }}>{commissionAmount.toFixed(2)} ج.م</span>
              </div>
            )}
          </div>
          
          <div className="ei-summary-footer">
            <button 
              className="ei-btn ei-btn-save" 
              onClick={() => setModalType("payment")} 
              disabled={cart.length === 0 || isLoading}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Printer size={16} /> دفع وطباعة <kbd>F2</kbd>
            </button>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button 
                className="ei-btn ei-btn-secondary" 
                style={{ flex: 1, background: "var(--surface2)" }} 
                onClick={savePendingInvoice} 
                disabled={cart.length === 0}
              >
                <PauseCircle size={15} /> تعليق
              </button>
              <button 
                className="ei-btn ei-btn-ghost" 
                style={{ flex: 1 }} 
                onClick={() => setModalType("preview_invoice")} 
                disabled={cart.length === 0}
              >
                <Eye size={15} /> معاينة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Receipt for Printing */}
      <div style={{ display: "none" }}>
        <div ref={receiptRef} style={{ width: "280px", background: "#fff", padding: "15px", color: "#000", fontFamily: "monospace" }}>
          <div className="header"><h2>اسم المحل</h2><p>نظام كودينج كورنر</p></div>
          <div className="divider"></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>رقم: #{invoiceNum}</span>
            <span>{new Date().toLocaleDateString("ar-EG")}</span>
          </div>
          <div style={{ fontSize: "11px" }}>العميل: {customer.name}</div>
          <div style={{ fontSize: "10px" }}>البائع: {currentSeller?.name}</div>
          <div className="divider"></div>
          <table style={{ width: "100%", fontSize: "11px" }}>
            <thead><tr><th>الصنف</th><th>ق</th><th>الإجمالي</th></tr></thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i}><td>{item.name}</td><td style={{ textAlign: "center" }}>{item.quantity}</td><td style={{ textAlign: "left" }}>{(item.quantity * item.sale_price).toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="divider"></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>الإجمالي:</span><span>{totalBefore.toFixed(2)}</span></div>
          {discountAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>الخصم:</span><span>-{discountAmount.toFixed(2)}</span></div>}
          <div className="total" style={{ display: "flex", justifyContent: "space-between" }}><span>الصافي:</span><span>{finalTotal.toFixed(2)} ج.م</span></div>
          <div className="footer"><p>شكراً لزيارتكم</p></div>
        </div>
      </div>

      {/* Modals */}
      {modalType === "add_customer" && (
        <div className="ei-modal-overlay" onClick={() => setModalType(null)}>
          <div className="ei-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="ei-modal-header">
              <div className="ei-modal-icon"><User size={20} /></div>
              <div>
                <div className="ei-modal-title">بيانات العميل</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>تسجيل عميل جديد</div>
              </div>
            </div>
            <div className="ei-modal-body">
              <CustomerField
                icon={<User size={12} />}
                label="اسم العميل"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="أدخل اسم العميل"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <CustomerField
                  icon={<Phone size={12} />}
                  label="الهاتف"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                  type="tel"
                  placeholder="رقم الهاتف"
                />
                <CustomerField
                  icon={<MapPin size={12} />}
                  label="العنوان"
                  value={customer.address}
                  onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                  placeholder="العنوان"
                />
              </div>
            </div>
            <div className="ei-modal-footer">
              <button className="ei-btn ei-btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalType(null)}>
                تأكيد
              </button>
              <button className="ei-btn ei-btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={saveNewCustomer} disabled={isLoading}>
                <Save size={14} /> حفظ العميل
              </button>
              <button className="ei-btn ei-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalType(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === "pending" && (
        <PendingPanel
          pendingList={pendingList}
          onResume={resumeInvoice}
          onCancel={cancelPendingInvoice}
          onClose={() => setModalType(null)}
        />
      )}

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
                onClick={() => { removeFromCart(deleteTarget.cartKey); }}
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

      {modalType === "payment" && (
        <PaymentModal
          finalTotal={finalTotal}
          onConfirm={async (result) => {
            console.log("📦 Received from PaymentModal:", result);
            await saveInvoice(result, printMode !== "save_only");
          }}
          onCancel={() => {
            setModalType(null);
            setPrintMode(null);
          }}
        />
      )}

      {modalType === "preview_invoice" && cart.length > 0 && (
        <div className="ei-modal-overlay" onClick={() => setModalType(null)}>
          <div className="ei-modal" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="ei-modal-header" style={{ justifyContent: "space-between" }}>
              <div className="ei-modal-icon"><Eye size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="ei-modal-title">معاينة الفاتورة</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>فاتورة #{invoiceNum}</div>
              </div>
              <button className="ei-btn ei-btn-ghost" onClick={() => setModalType(null)} style={{ padding: "4px 8px" }}>✕</button>
            </div>
            <div className="ei-modal-body">
              <div style={{ background: "#fff", color: "#000", padding: "20px", borderRadius: "8px", fontFamily: "monospace", maxHeight: "500px", overflow: "auto" }}>
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0 }}>اسم المحل</h3>
                  <p style={{ fontSize: "11px" }}>Coding Cashier System</p>
                </div>
                <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span>رقم: #{invoiceNum}</span>
                  <span>{new Date().toLocaleDateString("ar-EG")}</span>
                </div>
                <div style={{ fontSize: "11px" }}>العميل: {customer.name}</div>
                <div style={{ fontSize: "10px" }}>البائع: {currentSeller?.name}</div>
                <div style={{ borderTop: "1px solid #000", margin: "8px 0" }}></div>
                <table style={{ width: "100%", fontSize: "11px" }}>
                  <thead><tr><th>الصنف</th><th>ق</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {cart.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: "center" }}>{item.quantity}</td>
                        <td>{item.sale_price.toFixed(2)}</td>
                        <td>{(item.quantity * item.sale_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>الإجمالي:</span><span>{totalBefore.toFixed(2)}</span></div>
                {discountAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>الخصم:</span><span>-{discountAmount.toFixed(2)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginTop: "8px", borderTop: "2px solid #000", paddingTop: "6px" }}>
                  <span>الصافي:</span><span>{finalTotal.toFixed(2)} ج.م</span>
                </div>
                <div style={{ textAlign: "center", marginTop: "12px", fontSize: "10px" }}>شكراً لزيارتكم</div>
              </div>
            </div>
            <div className="ei-modal-footer">
              <button className="ei-btn ei-btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalType("payment")}>
                متابعة للدفع
              </button>
              <button className="ei-btn ei-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalType(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierPage;