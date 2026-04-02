import { useEffect, useState, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Edit, Search, Trash2, UserPlus, FileText, Phone, MapPin,
  Wallet, ArrowUpRight, X, History, CheckCircle2, Clock,
  CreditCard, Banknote, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ج.م";

const fmtDate = (d) => new Date(d).toLocaleDateString("ar-EG");

// ── شريط التقدم ──────────────────────────────────────
const ProgressBar = ({ paid, total, color = "#22c55e" }) => {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "11px", color: "#64748b" }}>نسبة السداد</span>
        <span style={{ fontSize: "11px", color: "#64748b" }}>{pct}%</span>
      </div>
      <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
};

const InstallmentInvoiceCard = ({ inv }) => {
  const [open, setOpen] = useState(false);
  const totalCollected = inv.down_payment + inv.total_paid_after;
  const pct = inv.total_after_discount > 0
    ? Math.min(100, Math.round((totalCollected / inv.total_after_discount) * 100))
    : 0;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "14px",
      overflow: "hidden",
      marginBottom: "10px"
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "14px 18px",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
          alignItems: "center",
          gap: "12px"
        }}
      >
        <div>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "3px" }}>رقم الفاتورة</div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#60a5fa" }}>#{inv.invoice_number}</div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{fmtDate(inv.created_at)}</div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "3px" }}>إجمالي الفاتورة</div>
          <div style={{ fontSize: "14px", fontWeight: "600" }}>{fmt(inv.total_after_discount)}</div>
          <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "2px" }}>
            مقدم: {fmt(inv.down_payment)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "3px" }}>محصّل بعد المقدم</div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#22c55e" }}>{fmt(inv.total_paid_after)}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            {inv.payments_count} دفعة
          </div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "3px" }}>المتبقي</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: inv.current_remaining > 0 ? "#f97316" : "#22c55e" }}>
            {inv.current_remaining > 0.5 ? fmt(inv.current_remaining) : "مسدّد بالكامل"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <span style={{
            fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
            background: inv.current_remaining > 0.5 ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)",
            color: inv.current_remaining > 0.5 ? "#f97316" : "#22c55e"
          }}>
            {inv.current_remaining > 0.5 ? "جارية" : "مكتملة"}
          </span>
          {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
        </div>
      </div>

      {/* شريط التقدم */}
      <div style={{ padding: "0 18px 12px" }}>
        <ProgressBar paid={totalCollected} total={inv.total_after_discount} color={inv.current_remaining > 0.5 ? "#f97316" : "#22c55e"} />
      </div>

      {/* ── التفاصيل (قابلة للطي) ── */}
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 18px" }}>

          {/* صف المقدم */}
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            سجل الدفعات
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", background: "rgba(34,197,94,0.07)",
            borderRadius: "10px", marginBottom: "6px",
            borderRight: "3px solid #22c55e"
          }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600" }}>دفعة أولى — مقدم</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{fmtDate(inv.created_at)} · عند البيع</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#22c55e" }}>+{fmt(inv.down_payment)}</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>نقداً</div>
            </div>
          </div>

          {/* دفعات ما بعد المقدم */}
          {inv.payments && inv.payments.length > 0 ? (
            inv.payments.map((p, i) => (
              <div key={p.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", background: "rgba(255,255,255,0.02)",
                borderRadius: "10px", marginBottom: "6px",
                borderRight: "3px solid rgba(96,165,250,0.4)"
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600" }}>
                    دفعة {i + 1} — {p.note || "تحصيل قسط"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    {fmtDate(p.payment_date)} · {p.payment_method === "cash" ? "نقداً" : p.payment_method}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#60a5fa" }}>+{fmt(p.amount_paid)}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "#475569", fontSize: "13px", padding: "12px 0" }}>
              لا توجد دفعات لاحقة مسجلة بعد المقدم
            </div>
          )}

          {/* ملخص */}
          <div style={{
            marginTop: "12px", padding: "12px 14px",
            background: "rgba(255,255,255,0.04)", borderRadius: "10px",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px"
          }}>
            {[
              { label: "إجمالي المحصّل", value: fmt(totalCollected), color: "#22c55e" },
              { label: "المتبقي", value: inv.current_remaining > 0.5 ? fmt(inv.current_remaining) : "صفر", color: inv.current_remaining > 0.5 ? "#f97316" : "#22c55e" },
              { label: "نسبة السداد", value: `${pct}%`, color: "white" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{s.label}</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════════════
const CustomersPage = ({ showToast }) => {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalType, setModalType]   = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formData, setFormData]     = useState({ id: null, name: "", phone: "", address: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | installment | cash | debt

  // ── جلب العملاء ──────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      const result = await db.select(`
        SELECT
          c.*,
          COUNT(DISTINCT i.id)                                          AS invoice_count,
          COUNT(DISTINCT CASE WHEN i.payment_method = 'installment' THEN i.id END) AS installment_invoices,
          COALESCE(SUM(CASE WHEN i.payment_method != 'installment' THEN i.total_after_discount END), 0) AS cash_total,
          COALESCE(SUM(CASE WHEN i.status != 'deleted' THEN i.remaining_amount END), 0) AS total_debt
        FROM customers c
        LEFT JOIN invoices i
          ON (i.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND i.customer_phone = c.phone))
          AND i.status != 'deleted'
        GROUP BY c.id
        ORDER BY total_debt DESC, c.id DESC
      `);

      setCustomers(result);
    } catch (err) {
      console.error(err);
      showToast("خطأ في تحميل بيانات العملاء", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  // ── فتح تفاصيل عميل ──────────────────────────────
  const openDetail = async (cus) => {
    setSelectedCustomer(cus);
    setModalType("detail");
    setDetailData(null);
    setDetailLoading(true);

    try {
      const db = await getDb();

      // كل فواتير العميل
      const invoices = await db.select(`
        SELECT id, invoice_number, total_after_discount, paid_amount,
               remaining_amount, payment_method, created_at, status
        FROM invoices
        WHERE (customer_id = $1 OR (customer_phone = $2 AND $2 != ''))
          AND status != 'deleted'
        ORDER BY created_at DESC
      `, [cus.id, cus.phone || ""]);

      // لكل فاتورة تقسيط — جيب دفعاتها والمحصّل الكلي
      const enriched = await Promise.all(invoices.map(async (inv) => {
        if (inv.payment_method !== "installment") {
          return { ...inv, payments: [], down_payment: inv.paid_amount, total_paid_after: 0, payments_count: 0, current_remaining: Number(inv.remaining_amount) };
        }

        const payments = await db.select(`
          SELECT id, amount_paid, payment_date, payment_method, note
          FROM installment_payments
          WHERE invoice_id = $1
          ORDER BY payment_date ASC
        `, [inv.id]);

        const total_paid_after = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
        const current_remaining = Number(inv.total_after_discount) - (Number(inv.paid_amount) + total_paid_after);

        return {
          ...inv,
          payments,
          down_payment: Number(inv.paid_amount),
          total_paid_after,
          payments_count: payments.length,
          current_remaining: Math.max(0, current_remaining),
        };
      }));

      const installmentInvs = enriched.filter(i => i.payment_method === "installment");
      const cashInvs        = enriched.filter(i => i.payment_method !== "installment");

      const totalInstallmentDebt    = installmentInvs.reduce((s, i) => s + i.current_remaining, 0);
      const totalInstallmentCollected = installmentInvs.reduce((s, i) => s + i.down_payment + i.total_paid_after, 0);
      const totalInstallmentValue   = installmentInvs.reduce((s, i) => s + Number(i.total_after_discount), 0);
      const cashTotal               = cashInvs.reduce((s, i) => s + Number(i.total_after_discount), 0);

      setDetailData({
        invoices: enriched,
        installmentInvs,
        cashInvs,
        totalInstallmentDebt,
        totalInstallmentCollected,
        totalInstallmentValue,
        cashTotal,
        hasInstallments: installmentInvs.length > 0,
      });
    } catch (err) {
      console.error(err);
      showToast("فشل جلب تفاصيل العميل", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  // ── CRUD ──────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const db = await getDb();
      if (modalType === "add") {
        await db.execute(
          "INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3)",
          [formData.name, formData.phone, formData.address]
        );
        showToast("تمت إضافة العميل", "success");
      } else if (modalType === "edit") {
        await db.execute(
          "UPDATE customers SET name=$1, phone=$2, address=$3 WHERE id=$4",
          [formData.name, formData.phone, formData.address, formData.id]
        );
        showToast("تم تحديث البيانات", "success");
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      showToast("فشل التنفيذ — ربما رقم الهاتف مكرر", "error");
    }
  };

  const handleDelete = async () => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM customers WHERE id=$1", [formData.id]);
      showToast("تم حذف العميل", "success");
      closeModal();
      fetchCustomers();
    } catch {
      showToast("لا يمكن حذف عميل لديه فواتير مرتبطة", "error");
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedCustomer(null);
    setDetailData(null);
    setFormData({ id: null, name: "", phone: "", address: "" });
  };

  // ── فلترة ────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );
    if (filterType === "installment") list = list.filter(c => c.installment_invoices > 0);
    if (filterType === "cash")        list = list.filter(c => c.installment_invoices === 0 && c.invoice_count > 0);
    if (filterType === "debt")        list = list.filter(c => c.total_debt > 0.5);
    return list;
  }, [customers, searchTerm, filterType]);

  const stats = useMemo(() => ({
    totalDebt:        customers.reduce((s, c) => s + Number(c.total_debt || 0), 0),
    count:            customers.length,
    installmentCount: customers.filter(c => c.installment_invoices > 0).length,
    cashOnlyCount:    customers.filter(c => c.installment_invoices === 0 && c.invoice_count > 0).length,
  }), [customers]);

  // ── Render ────────────────────────────────────────
  return (
    <div   className="page-container animate-fade-in" dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 20 }}>


      {/* Header */}
      <div className="page-header-container">
        <div className="page-header-container">
          <h2 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>دليل العملاء والمديونيات</h2>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "5px" }}>إدارة ملفات العملاء ومتابعة التحصيلات</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input type="text" placeholder="بحث بالاسم أو الهاتف..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ background: "#161b2c", border: "1px solid #2d364f", borderRadius: "12px", color: "white", padding: "10px 36px 10px 14px", width: "280px", fontSize: "13px", outline: "none" }}
            />
          </div>
          <button onClick={() => { setFormData({ id: null, name: "", phone: "", address: "" }); setModalType("add"); }}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1e3a5f", border: "1px solid #2d5f9e", color: "#60a5fa", borderRadius: "12px", padding: "10px 18px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
          >
            <UserPlus size={16} /> إضافة عميل
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "إجمالي المديونيات", value: fmt(stats.totalDebt), color: "#ef4444", icon: <Wallet size={16} /> },
          { label: "إجمالي العملاء",    value: stats.count + " عميل",  color: "white",    icon: <UserPlus size={16} /> },
          { label: "عملاء تقسيط",       value: stats.installmentCount + " عميل", color: "#f97316", icon: <CreditCard size={16} /> },
          { label: "عملاء كاش فقط",     value: stats.cashOnlyCount + " عميل",   color: "#22c55e", icon: <Banknote size={16} /> },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(22,27,44,0.7)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "12px", marginBottom: "8px" }}>
              {s.icon} {s.label}
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {[
          { key: "all",         label: "الكل" },
          { key: "installment", label: "تقسيط" },
          { key: "cash",        label: "كاش فقط" },
          { key: "debt",        label: "عليهم ديون" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key)}
            style={{
              padding: "7px 18px", borderRadius: "10px", border: "1px solid",
              borderColor: filterType === f.key ? "#2d5f9e" : "rgba(255,255,255,0.08)",
              background: filterType === f.key ? "#1e3a5f" : "transparent",
              color: filterType === f.key ? "#60a5fa" : "#64748b",
              cursor: "pointer", fontSize: "13px", fontWeight: "600"
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#475569", padding: "60px 0" }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#475569", padding: "60px 0", fontSize: "14px" }}>لا يوجد عملاء مطابقون</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "14px" }}>
          {filtered.map(cus => {
            const isInstallment = cus.installment_invoices > 0;
            const hasDebt       = Number(cus.total_debt) > 0.5;
            return (
              <div key={cus.id} style={{
                background: "rgba(22,27,44,0.7)",
                border: `1px solid ${hasDebt ? "rgba(249,115,22,0.25)" : isInstallment ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: "18px", padding: "18px 20px",
                cursor: "pointer", transition: "all 0.2s"
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = hasDebt ? "rgba(249,115,22,0.25)" : isInstallment ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.06)"}
                onClick={() => openDetail(cus)}
              >
                {/* Card Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
                      background: isInstallment ? "#1e3a5f" : "#1a2a1a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px", fontWeight: "700",
                      color: isInstallment ? "#60a5fa" : "#22c55e"
                    }}>
                      {cus.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "700" }}>{cus.name}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Phone size={11} /> {cus.phone || "بدون هاتف"}
                      </div>
                    </div>
                  </div>

                  {/* نوع العميل Badge */}
                  <span style={{
                    fontSize: "11px", padding: "4px 10px", borderRadius: "20px", fontWeight: "700",
                    background: isInstallment ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.12)",
                    color: isInstallment ? "#f97316" : "#22c55e"
                  }}>
                    {isInstallment ? `تقسيط (${cus.installment_invoices})` : "كاش"}
                  </span>
                </div>

                {/* Info Rows */}
                {cus.address && (
                  <div style={{ fontSize: "12px", color: "#475569", marginBottom: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <MapPin size={11} /> {cus.address}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>عدد الفواتير</div>
                    <div style={{ fontSize: "16px", fontWeight: "700" }}>{cus.invoice_count}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>
                      {isInstallment ? "المتبقي من الأقساط" : "إجمالي المشتريات"}
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: hasDebt ? "#f97316" : "#22c55e" }}>
                      {isInstallment ? (hasDebt ? fmt(cus.total_debt) : "مسدّد") : fmt(cus.cash_total)}
                    </div>
                  </div>
                </div>

                {/* رسالة توضيحية */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "12px", color: "#64748b",
                  borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px"
                }}>
                  <FileText size={12} />
                  {isInstallment
                    ? `عميل تقسيط — ${cus.installment_invoices} فاتورة بالأقساط`
                    : cus.invoice_count > 0
                      ? "عميل كاش — جميع مشترياته نقداً"
                      : "عميل جديد — لا توجد فواتير بعد"
                  }
                  <ArrowUpRight size={12} style={{ marginRight: "auto" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Modal: تفاصيل العميل الكاملة
      ══════════════════════════════════════════════ */}
      {modalType === "detail" && selectedCustomer && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0f1424", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px", width: "920px", maxWidth: "100%",
            maxHeight: "90vh", display: "flex", flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700", color: "#60a5fa" }}>
                  {selectedCustomer.name[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>{selectedCustomer.name}</h3>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "3px", display: "flex", gap: "12px" }}>
                    <span><Phone size={12} style={{ marginLeft: "4px" }} />{selectedCustomer.phone || "بدون هاتف"}</span>
                    {selectedCustomer.address && <span><MapPin size={12} style={{ marginLeft: "4px" }} />{selectedCustomer.address}</span>}
                  </div>
                </div>
              </div>
              <button onClick={closeModal} style={{ background: "rgba(255,255,255,0.07)", border: "none", color: "#94a3b8", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: "auto", padding: "24px 28px" }}>
              {detailLoading ? (
                <div style={{ textAlign: "center", color: "#475569", padding: "60px 0" }}>جاري جلب التفاصيل...</div>
              ) : detailData && (
                <>
                  {/* ── ملخص سريع ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "28px" }}>
                    {[
                      { label: "نوع العميل",       value: detailData.hasInstallments ? "تقسيط" : "كاش فقط", color: detailData.hasInstallments ? "#f97316" : "#22c55e" },
                      { label: "فواتير التقسيط",   value: detailData.installmentInvs.length + " فاتورة",    color: "#60a5fa" },
                      { label: "إجمالي الديون",    value: detailData.totalInstallmentDebt > 0.5 ? fmt(detailData.totalInstallmentDebt) : "لا يوجد", color: detailData.totalInstallmentDebt > 0.5 ? "#f97316" : "#22c55e" },
                      { label: "إجمالي المحصّل",  value: fmt(detailData.totalInstallmentCollected + detailData.cashTotal), color: "#22c55e" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "14px", padding: "14px 16px" }}>
                        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>{s.label}</div>
                        <div style={{ fontSize: "17px", fontWeight: "700", color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── فواتير التقسيط ── */}
                  {detailData.hasInstallments ? (
                    <>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#f97316", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <CreditCard size={15} /> فواتير التقسيط ({detailData.installmentInvs.length}) — اضغط لعرض تفاصيل كل فاتورة
                      </div>
                      {detailData.installmentInvs.map(inv => (
                        <InstallmentInvoiceCard key={inv.id} inv={inv} />
                      ))}
                    </>
                  ) : (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: "14px", padding: "18px 20px", marginBottom: "20px"
                    }}>
                      <Banknote size={28} color="#22c55e" />
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "700", color: "#22c55e" }}>عميل كاش — لا توجد معاملات تقسيط</div>
                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                          جميع مشتريات هذا العميل ({detailData.cashInvs.length} فاتورة) تمت نقداً بدون أقساط
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── فواتير الكاش ── */}
                  {detailData.cashInvs.length > 0 && (
                    <>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#22c55e", margin: "20px 0 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Banknote size={15} /> فواتير الكاش ({detailData.cashInvs.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {detailData.cashInvs.map((inv, i) => (
                          <div key={i} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "12px", padding: "12px 16px"
                          }}>
                            <div>
                              <span style={{ color: "#22c55e", fontWeight: "700", fontSize: "14px" }}>#{inv.invoice_number}</span>
                              <span style={{ color: "#475569", fontSize: "12px", marginRight: "10px" }}>{fmtDate(inv.created_at)}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                              <span style={{ fontSize: "14px", fontWeight: "600" }}>{fmt(inv.total_after_discount)}</span>
                              <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>مدفوع</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {detailData.invoices.length === 0 && (
                    <div style={{ textAlign: "center", color: "#475569", padding: "40px 0", fontSize: "14px" }}>
                      لا توجد فواتير مسجلة لهذا العميل
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "10px" }}>
              <button onClick={() => { closeModal(); setTimeout(() => { setFormData(selectedCustomer); setModalType("edit"); }, 100); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", borderRadius: "10px", cursor: "pointer", fontSize: "13px" }}>
                <Edit size={14} /> تعديل البيانات
              </button>
              <button onClick={() => { setFormData(selectedCustomer); closeModal(); setTimeout(() => setModalType("delete"), 100); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "10px", cursor: "pointer", fontSize: "13px" }}>
                <Trash2 size={14} /> حذف العميل
              </button>
              <button onClick={closeModal} style={{ marginRight: "auto", padding: "10px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: "10px", cursor: "pointer", fontSize: "13px" }}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إضافة / تعديل */}
      {(modalType === "add" || modalType === "edit") && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f1424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "28px", width: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>{modalType === "add" ? "إضافة عميل جديد" : "تعديل بيانات العميل"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              {[
                { label: "الاسم الكامل", field: "name", type: "text", ph: "أحمد محمد علي", req: true },
                { label: "رقم الهاتف",   field: "phone", type: "text", ph: "01xxxxxxxxx" },
                { label: "العنوان",       field: "address", type: "text", ph: "المدينة، الشارع..." },
              ].map(f => (
                <div key={f.field} style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>{f.label}</label>
                  <input type={f.type} required={f.req} value={formData[f.field] || ""} placeholder={f.ph}
                    onChange={e => setFormData(p => ({ ...p, [f.field]: e.target.value }))}
                    style={{ width: "100%", background: "#080a10", border: "1px solid #2d364f", color: "white", borderRadius: "10px", padding: "11px 14px", fontSize: "14px", outline: "none" }}
                  />
                </div>
              ))}
              <button type="submit" style={{ width: "100%", padding: "13px", background: "#1e3a5f", border: "1px solid #2d5f9e", color: "#60a5fa", borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", marginTop: "8px" }}>
                {modalType === "add" ? "حفظ العميل" : "تحديث البيانات"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: حذف */}
      {modalType === "delete" && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f1424", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "20px", padding: "32px 28px", width: "380px", textAlign: "center" }}>
            <Trash2 size={40} style={{ color: "#f87171", marginBottom: "14px" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>حذف العميل "{formData.name}"؟</h3>
            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.6", marginBottom: "24px" }}>
              سيتم حذف بيانات العميل نهائياً. لا يمكن حذف عميل مرتبط بفواتير.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleDelete} style={{ flex: 1, padding: "12px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: "700" }}>
                تأكيد الحذف
              </button>
              <button onClick={closeModal} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: "12px", cursor: "pointer", fontSize: "14px" }}>
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;