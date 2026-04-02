import React, { useState, useEffect, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Search, HandCoins, User, Clock, X, AlertTriangle, RefreshCw, DollarSign
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const Badge = ({ label, bg, text, border }) => (
  <span style={{
    padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
    background: bg, color: text, border: `1px solid ${border}`, whiteSpace: "nowrap"
  }}>
    {label}
  </span>
);

const StatCard = ({ title, value, sub, icon, accent }) => (
  <div style={{ background: "rgba(22,27,44,0.7)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "18px 22px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "10px" }}>
      <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${accent}15`, color: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <p style={{ color: "white", fontSize: "14px", fontWeight: "900", margin: 0 }}>{title}</p>
    </div>
    <h3 style={{ fontSize: "22px", fontWeight: "800", color: "white", margin: 0 }}>{value}</h3>
    <p style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px", margin: 0 }}>{sub}</p>
  </div>
);

const InstallmentCollection = ({ showToast }) => {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { fetchPendingInvoices(); }, []);

const fetchPendingInvoices = async () => {
  try {
    setLoading(true);
    const db = await getDb();
    
    // استعلام مباشر وسريع يجلب الفواتير التي لا يزال لها متبقي أكبر من صفر
    const pendingInvoices = await db.select(`
      SELECT * FROM invoices 
      WHERE payment_method = 'installment' 
      AND remaining_amount > 0.5 
      AND status != 'deleted'
      ORDER BY created_at DESC
    `);
    
    // تنسيق البيانات للعرض فقط دون إعادة حسابات معقدة
    const formatted = pendingInvoices.map(inv => ({
      ...inv,
      current_remaining: Number(inv.remaining_amount),
      total_collected: Number(inv.paid_amount), // paid_amount الآن يشمل المقدم + كل الأقساط
      down_payment: Number(inv.total_after_discount) - Number(inv.remaining_amount) - (Number(inv.paid_amount) - Number(inv.paid_amount)) // قيمة تقريبية للمقدم إذا لم تكن مخزنة منفصلة
    }));

    setInvoices(formatted);
  } catch (err) {
    console.error(err);
    if (showToast) showToast("خطأ في تحديث القائمة", "error");
  } finally {
    setLoading(false);
  }
};

  const openCollection = async (inv) => {
    try {
      const db = await getDb();
      const history = await db.select(
        "SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date DESC",
        [inv.id]
      );
      setSelectedInvoice({ ...inv, history });
      setPaymentAmount("");
    } catch (err) {
      if (showToast) showToast("تعذر جلب سجل المدفوعات", "error");
    }
  };

  // 1. حساب المبلغ المتبقي بعد العملية لحظياً
  const remainingAfter = useMemo(() => {
    if (!selectedInvoice) return 0;
    const currentPay = parseFloat(paymentAmount) || 0;
    const result = selectedInvoice.current_remaining - currentPay;
    return result < 0 ? 0 : result;
  }, [selectedInvoice, paymentAmount]);

 const handlePayment = async () => {
  const amount = parseFloat(paymentAmount);
  if (!amount || amount <= 0) return showToast("يرجى إدخال مبلغ صحيح", "warning");
  if (amount > selectedInvoice.current_remaining) return showToast(`المبلغ أكبر من المتبقي`, "warning");

  setConfirming(true);
  try {
    const db = await getDb();
    
    const safeCustomerId = selectedInvoice.customer_id ? Number(selectedInvoice.customer_id) : null;
    const safeInvoiceId = Number(selectedInvoice.id);

    // 1. تسجيل عملية التحصيل في جدول الأقساط
    await db.execute(
      `INSERT INTO installment_payments (invoice_id, customer_id, amount_paid, payment_method, transaction_type, note) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [safeInvoiceId, safeCustomerId, amount, "cash", "installment", "تحصيل قسط يدوي"]
    );

    // 2. التعديل الجوهري: تحديث جدول الفواتير ليعكس المبلغ الجديد (هذا ما تراه صفحة العملاء)
    await db.execute(
      `UPDATE invoices 
       SET remaining_amount = remaining_amount - ?, 
           paid_amount = paid_amount + ? 
       WHERE id = ?`,
      [amount, amount, safeInvoiceId]
    );

    if (showToast) showToast(`تم تحصيل ${fmt(amount)} وتحديث حساب العميل`, "success");
    
    setSelectedInvoice(null);
    await fetchPendingInvoices(); // تحديث القائمة في صفحة الأقساط
  } catch (err) {
    console.error("Payment Error:", err);
    if (showToast) showToast("فشل في تحديث البيانات", "error");
  } finally {
    setConfirming(false);
  }
};
  const summary = useMemo(() => ({
    totalRemaining: invoices.reduce((s, i) => s + i.current_remaining, 0),
    count: invoices.length,
    overdue: invoices.filter(i => i.next_due_date && new Date(i.next_due_date) < new Date()).length
  }), [invoices]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(i => (i.customer_name || "").toLowerCase().includes(q) || (i.invoice_number || "").toLowerCase().includes(q));
  }, [invoices, searchTerm]);

  return (
    <div className="page-container animate-fade-in" dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 20, padding: "25px" }}>
      
      {/* Page Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HandCoins size={26} style={{ color: "#60a5fa" }} />
            <h2 className="main-title">تحصيل المديونيات</h2>
          </div>
          <p className="sub-title">إدارة أقساط العملاء ومتابعة المبالغ المتبقية</p>
        </div>
        <div className="header-actions-group">
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="بحث بالاسم أو الفاتورة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-select"
              style={{ width: 280, paddingRight: 36 }}
            />
            <Search size={15} style={{ position: "absolute", right: 12, top: 13, color: "#94a3b8" }} />
          </div>
          <button className="btn-save" onClick={fetchPendingInvoices}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <StatCard title="إجمالي المديونيات" value={fmt(summary.totalRemaining)} sub="مبالغ لم تُحصل بعد" icon={<DollarSign size={22} />} accent="#ef4444" />
        <StatCard title="عدد العملاء" value={`${summary.count} عميل`} sub="مديونيات نشطة" icon={<User size={22} />} accent="#60a5fa" />
        <StatCard title="فواتير متأخرة" value={`${summary.overdue} فاتورة`} sub="تجاوزت تاريخ الاستحقاق" icon={<AlertTriangle size={22} />} accent="#fbbf24" />
      </div>

      {/* Main Table */}
      <div className="table-wrapper-premium">
        <table className="custom-table">
          <thead>
            <tr>
              <th>العميل</th>
              <th>رقم الفاتورة</th>
              <th>قيمة الفاتورة</th>
              <th>المسدد حتى الآن</th>
              <th>المتبقي</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 50, color: "#94a3b8" }}>جاري تحميل البيانات...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 50, color: "#64748b" }}>لا توجد مديونيات قائمة</td></tr>
            ) : filtered.map((inv) => (
              <tr key={inv.id} className="table-row">
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 35, height: 35, borderRadius: "50%", background: "rgba(96,165,250,0.1)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      {inv.customer_name?.[0] || "؟"}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, margin: 0 }}>{inv.customer_name}</p>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: 0 }}>{inv.customer_phone}</p>
                    </div>
                  </div>
                </td>
                <td><Badge label={`#${inv.invoice_number}`} bg="rgba(255,255,255,0.05)" text="#94a3b8" border="rgba(255,255,255,0.1)" /></td>
                <td>{fmt(inv.total_after_discount)}</td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "#34d399", fontWeight: "600", fontSize: "13px" }}>{fmt(inv.total_collected)}</span>
                    <div style={{ width: "100px", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                      <div style={{ width: `${(inv.total_collected / inv.total_after_discount) * 100}%`, height: "100%", background: "#34d399", borderRadius: 10 }} />
                    </div>
                  </div>
                </td>
                <td><span style={{ color: "#f97316", fontWeight: "800", fontSize: "15px" }}>{fmt(inv.current_remaining)}</span></td>
                <td style={{ textAlign: "center" }}>
                  <button className="btn-save" onClick={() => openCollection(inv)} style={{ padding: "6px 14px", fontSize: "12px" }}>تحصيل مبلغ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ Collection Modal ══ */}
      {selectedInvoice && (
        <div 
          className="animate-fade-in" 
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} 
          onClick={() => setSelectedInvoice(null)}
        >
          <div 
            className="modal-content" 
            style={{ background: "#111827", border: "1px solid #2d364f", borderRadius: "20px", width: "100%", maxWidth: "850px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }} 
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div style={{ padding: "20px 25px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "white" }}>تحصيل من: {selectedInvoice.customer_name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>رقم الفاتورة: #{selectedInvoice.invoice_number}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#94a3b8", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr" }}>
              
              {/* Left Side: Payment Form */}
              <div style={{ padding: "25px", borderLeft: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
                
                {/* الحسبة الحالية */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                  <div style={{ background: "rgba(249,115,22,0.1)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <p style={{ fontSize: "11px", color: "#f97316", marginBottom: "5px" }}>المتبقي الحالي</p>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#f97316" }}>{fmt(selectedInvoice.current_remaining)}</h4>
                  </div>
                  <div style={{ background: "rgba(34,197,94,0.1)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <p style={{ fontSize: "11px", color: "#34d399", marginBottom: "5px" }}>الباقي بعد الدفع</p>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#34d399" }}>{fmt(remainingAfter)}</h4>
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "8px" }}>المبلغ المستلم الآن</label>
                  <input
                    type="number"
                    className="premium-select"
                    style={{ width: "100%", fontSize: "24px", textAlign: "center", height: "65px", color: "#60a5fa", fontWeight: "bold" }}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                <button 
                  className="btn-save" 
                  style={{ width: "100%", height: "55px", background: "#22c55e", color: "white", fontSize: "16px", fontWeight: "bold" }} 
                  onClick={handlePayment} 
                  disabled={confirming || !paymentAmount}
                >
                  {confirming ? "جاري الحفظ..." : "تأكيد عملية التحصيل"}
                </button>

                <p style={{ textAlign: "center", fontSize: "11px", color: "#475569", marginTop: "15px" }}>
                  تأكد من استلام المبلغ نقداً قبل الضغط على تأكيد
                </p>
              </div>

              {/* Right Side: History */}
              <div style={{ padding: "25px", overflowY: "auto", maxHeight: "450px", background: "#0f172a" }}>
                <h4 style={{ fontSize: "13px", color: "#64748b", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock size={15} /> سجل المدفوعات السابقة
                </h4>
                
                {/* Down Payment */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "rgba(52,211,153,0.05)", borderRadius: "10px", marginBottom: "10px", borderRight: "4px solid #34d399" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "bold" }}>الدفعة المقدمة</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>عند إنشاء الفاتورة</p>
                  </div>
                  <span style={{ fontWeight: "700", color: "#34d399" }}>+{fmt(selectedInvoice.down_payment)}</span>
                </div>

                {/* History List */}
                {selectedInvoice.history?.length > 0 ? (
                  selectedInvoice.history.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", marginBottom: "8px" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px" }}>{h.note || "تحصيل يدوي"}</p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>{new Date(h.payment_date).toLocaleDateString("ar-EG")}</p>
                      </div>
                      <span style={{ fontWeight: "700", color: "#60a5fa" }}>+{fmt(h.amount_paid)}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "40px", color: "#334155" }}>
                    <p style={{ fontSize: "13px" }}>لا توجد تحصيلات سابقة مسجلة</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallmentCollection;