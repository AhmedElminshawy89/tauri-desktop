import React, { useState, useEffect, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Search, HandCoins, User, Clock, X, AlertTriangle, RefreshCw, DollarSign, CheckCircle2
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
      
      const pendingInvoices = await db.select(`
        SELECT i.*, 
               COALESCE(SUM(ip.amount_paid), 0) AS total_paid_installments
        FROM invoices i
        LEFT JOIN installment_payments ip ON ip.invoice_id = i.id
        WHERE i.payment_method = 'installment' 
          AND i.remaining_amount > 0.5
          AND i.status != 'deleted'
        GROUP BY i.id
        ORDER BY i.created_at DESC
      `);
      
      const invoicesWithPlans = [];
      for (const inv of pendingInvoices) {
        const plans = await db.select(
          `SELECT * FROM installment_plan WHERE invoice_id = ? ORDER BY due_date ASC`,
          [inv.id]
        );
        invoicesWithPlans.push({
          ...inv,
          plans: plans || [],
          current_remaining: Number(inv.remaining_amount),
          total_collected: Number(inv.paid_amount),
          down_payment: Number(inv.paid_amount) - (Number(inv.total_paid_installments) || 0)
        });
      }
      setInvoices(invoicesWithPlans);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في جلب البيانات", "error");
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

  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "warning");
      return;
    }
    if (amount > selectedInvoice.current_remaining) {
      showToast(`المبلغ أكبر من المتبقي (${fmt(selectedInvoice.current_remaining)})`, "warning");
      return;
    }

    setConfirming(true);
    let db;
    try {
      db = await getDb();
      await db.execute("BEGIN TRANSACTION");
      
      const safeInvoiceId = Number(selectedInvoice.id);
      const safeCustomerId = selectedInvoice.customer_id ? Number(selectedInvoice.customer_id) : null;
      const paymentDate = new Date().toISOString();

      await db.execute(
        `INSERT INTO installment_payments 
         (invoice_id, customer_id, amount_paid, payment_method, transaction_type, note, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [safeInvoiceId, safeCustomerId, amount, "cash", "installment", "تحصيل قسط", paymentDate]
      );

      const pendingPlans = await db.select(
        "SELECT * FROM installment_plan WHERE invoice_id = ? AND status = 'pending' ORDER BY due_date ASC",
        [safeInvoiceId]
      );
      
      let remainingAmount = amount;
      for (const plan of pendingPlans) {
        if (remainingAmount <= 0) break;
        const dueAmount = plan.amount_due;
        if (remainingAmount >= dueAmount) {
          await db.execute(
            "UPDATE installment_plan SET status = 'paid', payment_date = ? WHERE id = ?",
            [paymentDate, plan.id]
          );
          remainingAmount -= dueAmount;
        } else {
          await db.execute(
            "UPDATE installment_plan SET amount_due = amount_due - ? WHERE id = ?",
            [remainingAmount, plan.id]
          );
          remainingAmount = 0;
        }
      }

      await db.execute(
        `UPDATE invoices SET 
          paid_amount = paid_amount + ?, 
          remaining_amount = remaining_amount - ? 
         WHERE id = ?`,
        [amount, amount, safeInvoiceId]
      );

      await db.execute("COMMIT");
      if (showToast) showToast(`تم تحصيل ${fmt(amount)} بنجاح`, "success");
      setSelectedInvoice(null);
      await fetchPendingInvoices();
    } catch (err) {
      if (db) await db.execute("ROLLBACK");
      console.error("Payment Error:", err);
      if (showToast) showToast("فشل في تحديث البيانات: " + err.message, "error");
    } finally {
      setConfirming(false);
    }
  };

  const summary = useMemo(() => ({
    totalRemaining: invoices.reduce((s, i) => s + i.current_remaining, 0),
    count: invoices.length,
    overdue: invoices.filter(i => {
      const firstUnpaid = i.plans?.find(p => p.status !== 'paid');
      return firstUnpaid && new Date(firstUnpaid.due_date) < new Date();
    }).length
  }), [invoices]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(i => 
      (i.customer_name || "").toLowerCase().includes(q) || 
      (i.invoice_number || "").toLowerCase().includes(q)
    );
  }, [invoices, searchTerm]);

  return (
    <div className="page-container animate-fade-in" dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 20, padding: "25px" }}>
      
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <StatCard title="إجمالي المديونيات" value={fmt(summary.totalRemaining)} sub="مبالغ لم تُحصل بعد" icon={<DollarSign size={22} />} accent="#ef4444" />
        <StatCard title="عدد العملاء" value={`${summary.count} عميل`} sub="مديونيات نشطة" icon={<User size={22} />} accent="#60a5fa" />
        <StatCard title="فواتير متأخرة" value={`${summary.overdue} فاتورة`} sub="تجاوزت تاريخ الاستحقاق" icon={<AlertTriangle size={22} />} accent="#fbbf24" />
      </div>

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
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: 50, color: "#94a3b8" }}>جاري تحميل البيانات...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: 50, color: "#64748b" }}>لا توجد مديونيات قائمة</td>
              </tr>
            ) : (
              filtered.map((inv) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="modal-content" style={{ background: "#111827", border: "1px solid #2d364f", borderRadius: "20px", width: "100%", maxWidth: "900px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 25px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "white" }}>تحصيل من: {selectedInvoice.customer_name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>فاتورة #{selectedInvoice.invoice_number}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#94a3b8", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "25px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                <div style={{ background: "rgba(52,211,153,0.1)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <p style={{ fontSize: "11px", color: "#34d399", marginBottom: "5px" }}>الدفعة المقدمة</p>
                  <h4 style={{ margin: 0, fontSize: "16px", color: "#34d399" }}>{fmt(selectedInvoice.down_payment)}</h4>
                </div>
                <div style={{ background: "rgba(249,115,22,0.1)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <p style={{ fontSize: "11px", color: "#f97316", marginBottom: "5px" }}>المتبقي الحالي</p>
                  <h4 style={{ margin: 0, fontSize: "16px", color: "#f97316" }}>{fmt(selectedInvoice.current_remaining)}</h4>
                </div>
                <div style={{ background: "rgba(96,165,250,0.1)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(96,165,250,0.2)" }}>
                  <p style={{ fontSize: "11px", color: "#60a5fa", marginBottom: "5px" }}>إجمالي المحصل</p>
                  <h4 style={{ margin: 0, fontSize: "16px", color: "#60a5fa" }}>{fmt(selectedInvoice.total_collected)}</h4>
                </div>
              </div>

              {selectedInvoice.plans && selectedInvoice.plans.length > 0 && (
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "bold", color: "#f97316", marginBottom: "10px" }}>📅 جدول الأقساط</p>
                  <div style={{ overflowX: "auto" }}>
                    <table className="custom-table" style={{ fontSize: "13px", minWidth: "500px" }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>تاريخ الاستحقاق</th>
                          <th>المبلغ المطلوب</th>
                          <th>المبلغ المدفوع</th>
                          <th>الحالة</th>
                          <th>تاريخ الدفع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.plans.map((plan, idx) => {
                          const isPaid = plan.status === "paid";
                          return (
                            <tr key={plan.id}>
                              <td>{idx + 1}</td>
                              <td>{new Date(plan.due_date).toLocaleDateString("ar-EG")}</td>
                              <td>{fmt(plan.amount_due)}</td>
                              <td style={{ color: isPaid ? "#34d399" : "#94a3b8" }}>{isPaid ? fmt(plan.amount_due) : "—"}</td>
                              <td>
                                {isPaid ? (
                                  <Badge bg="#dcfce7" text="#166534" border="#bbf7d0" icon={<CheckCircle2 size={12} />} label="مدفوع" />
                                ) : (
                                  <Badge bg="#fef3c7" text="#92400e" border="#fde68a" icon={<AlertTriangle size={12} />} label="معلق" />
                                )}
                              </td>
                              <td style={{ fontSize: "12px", color: "#64748b" }}>
                                {plan.payment_date ? new Date(plan.payment_date).toLocaleDateString("ar-EG") : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

<div className="flex" style={{ borderTop: "1px solid rgba(255,255,255,0.1)",flexWrap: "wrap", gap: "20px", marginTop: "20px", paddingTop: "20px" }}>
              <div style={{ flex: "1" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold", color: "#94a3b8", display: "block", marginBottom: "8px" }}>المبلغ المراد تحصيله</label>
                <input
                  type="number"
                  className="premium-select"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="أدخل المبلغ"
                  style={{ fontSize: "24px", textAlign: "center", height: "60px", width: "100%" }}
                  autoFocus
                />
                <button
                  className="btn-secondary"
                  onClick={handlePayment}
                  disabled={confirming || !paymentAmount}
                  style={{ width: "100%", marginTop: "15px", background: "#22c55e", height: "50px", fontSize: "16px", fontWeight: "bold" }}
                >
                  {confirming ? "جاري الحفظ..." : "تأكيد التحصيل"}
                </button>
              </div>

              <div style={{ flex: "1" , borderRight: "1px solid rgba(255,255,255,0.1)",paddingRight: "20px"}}>
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#60a5fa", marginBottom: "10px" }}>📋 سجل التحصيلات السابقة</p>
                {selectedInvoice.history && selectedInvoice.history.length > 0 ? (
                  selectedInvoice.history.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px" }}>{h.note || "تحصيل"}</p>
                        <small style={{ color: "#64748b" }}>{new Date(h.payment_date).toLocaleDateString("ar-EG")}</small>
                      </div>
                      <span style={{ color: "#34d399", fontWeight: "bold" }}>+{fmt(h.amount_paid)}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: "center", color: "#475569", padding: "20px" }}>لا توجد مدفوعات سابقة</p>
                )}
              </div>
</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallmentCollection;