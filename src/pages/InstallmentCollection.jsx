import React, { useState, useEffect, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Search, HandCoins, User, Clock, X, AlertTriangle, RefreshCw, DollarSign, CheckCircle2
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const Badge = ({ label, bg, text, border, icon }) => (
  <span style={{
    padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
    background: bg, color: text, border: `1px solid ${border}`, whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: "4px"
  }}>
    {icon}{label}
  </span>
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
        .stat-glow {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          top: -20px;
          right: -20px;
          filter: blur(40px);
          opacity: 0.15;
          transition: opacity 0.3s ease;
        }
        .premium-stat-card:hover .stat-glow { opacity: 0.3; }
        .card-red .stat-glow { background: #ef4444; }
        .card-blue .stat-glow { background: #3b82f6; }
        .card-amber .stat-glow { background: #f59e0b; }
        .stat-content {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-red .icon-box { color: #f87171; background: rgba(239,68,68,0.1); }
        .card-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .stat-details { flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }
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
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .search-neon-wrapper { position: relative; }
        .search-neon-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 11px 42px 11px 16px;
          width: 280px;
          color: #f1f5f9;
          font-size: 13.5px;
          transition: all 0.25s ease;
        }
        .search-neon-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
          outline: none;
        }
        .btn-action-neon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .btn-primary { background: #2563eb; color: #ffffff; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .btn-secondary { background: #1e293b; color: #94a3b8; }
        .btn-secondary:hover { background: #334155; color: white; }
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
        .blur-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .cyber-modal {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .modal-cyber-header {
          padding: 18px 24px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-cyber-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: white; }
        .modal-close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .cyber-modal-body {
          overflow-y: auto;
          padding: 24px;
        }
        .cyber-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .installment-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .payment-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 12px;
          color: white;
          font-size: 24px;
          text-align: center;
          width: 100%;
        }
        .payment-input:focus {
          border-color: #3b82f6;
          outline: none;
        }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <HandCoins size={28} style={{ color: "#60a5fa" }} />
            <div>
              <h2 className="main-title">تحصيل المديونيات</h2>
              <p className="sub-title">إدارة أقساط العملاء ومتابعة المبالغ المتبقية</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="بحث بالاسم أو الفاتورة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
              style={{ width: 280 }}
            />
            <Search size={15} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchPendingInvoices}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-red">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><DollarSign size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي المديونيات</div>
              <div className="stat-value" style={{ color: "#f87171" }}>{fmt(summary.totalRemaining)}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><User size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">عدد العملاء</div>
              <div className="stat-value">{summary.count} عميل</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><AlertTriangle size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">فواتير متأخرة</div>
              <div className="stat-value" style={{ color: "#fbbf24" }}>{summary.overdue} فاتورة</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
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
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#94a3b8" }}>جاري تحميل البيانات...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>لا توجد مديونيات قائمة</td></tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="cyber-row-main">
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="installment-badge" style={{ width: 35, height: 35, borderRadius: "50%", background: "rgba(96,165,250,0.1)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", padding: 0 }}>
                        {inv.customer_name?.[0] || "؟"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{inv.customer_name}</div>
                        <div style={{ color: "#64748b", fontSize: "11px" }}>{inv.customer_phone}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="installment-badge">#{inv.invoice_number}</span></td>
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
                    <button className="btn-action-neon btn-primary" onClick={() => openCollection(inv)} style={{ padding: "6px 16px", fontSize: "12px" }}>
                      تحصيل مبلغ
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Collection Details */}
      {selectedInvoice && (
        <div className="blur-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <div>
                <h3>تحصيل من: {selectedInvoice.customer_name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>فاتورة #{selectedInvoice.invoice_number}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedInvoice(null)}><X size={20} /></button>
            </div>
            <div className="cyber-modal-body">
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
                <div className="premium-stat-card" style={{ padding: "12px", background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.2)" }}>
                  <div className="stat-label">الدفعة المقدمة</div>
                  <div className="stat-value" style={{ fontSize: "18px", color: "#34d399" }}>{fmt(selectedInvoice.down_payment)}</div>
                </div>
                <div className="premium-stat-card" style={{ padding: "12px", background: "rgba(249,115,22,0.05)", borderColor: "rgba(249,115,22,0.2)" }}>
                  <div className="stat-label">المتبقي الحالي</div>
                  <div className="stat-value" style={{ fontSize: "18px", color: "#f97316" }}>{fmt(selectedInvoice.current_remaining)}</div>
                </div>
                <div className="premium-stat-card" style={{ padding: "12px", background: "rgba(96,165,250,0.05)", borderColor: "rgba(96,165,250,0.2)" }}>
                  <div className="stat-label">إجمالي المحصل</div>
                  <div className="stat-value" style={{ fontSize: "18px", color: "#60a5fa" }}>{fmt(selectedInvoice.total_collected)}</div>
                </div>
              </div>

              {/* Installment Plan Table */}
              {selectedInvoice.plans && selectedInvoice.plans.length > 0 && (
                <>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#f97316", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={16} /> جدول الأقساط
                  </div>
                  <div className="cyber-table-container" style={{ marginBottom: "20px" }}>
                    <table className="cyber-table" style={{ fontSize: "13px" }}>
                      <thead>
                        <tr><th>#</th><th>تاريخ الاستحقاق</th><th>المبلغ المطلوب</th><th>المبلغ المدفوع</th><th>الحالة</th><th>تاريخ الدفع</th></tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.plans.map((plan, idx) => {
                          const isPaid = plan.status === "paid";
                          return (
                            <tr key={plan.id} className="cyber-row-main">
                              <td>{idx + 1}</td>
                              <td>{new Date(plan.due_date).toLocaleDateString("ar-EG")}</td>
                              <td>{fmt(plan.amount_due)}</td>
                              <td style={{ color: isPaid ? "#34d399" : "#94a3b8" }}>{isPaid ? fmt(plan.amount_due) : "—"}</td>
                              <td>
                                {isPaid ? (
                                  <Badge label="مدفوع" bg="#dcfce7" text="#166534" border="#bbf7d0" icon={<CheckCircle2 size={12} />} />
                                ) : (
                                  <Badge label="معلق" bg="#fef3c7" text="#92400e" border="#fde68a" icon={<AlertTriangle size={12} />} />
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
                </>
              )}

              {/* Payment Input & History */}
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <label className="stat-label" style={{ display: "block", marginBottom: "8px" }}>المبلغ المراد تحصيله</label>
                  <input
                    type="number"
                    className="payment-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="أدخل المبلغ"
                    autoFocus
                  />
                  <button
                    className="btn-action-neon btn-primary"
                    onClick={handlePayment}
                    disabled={confirming || !paymentAmount}
                    style={{ width: "100%", marginTop: "16px", background: "#22c55e" }}
                  >
                    {confirming ? "جاري الحفظ..." : "تأكيد التحصيل"}
                  </button>
                </div>
                <div style={{ flex: 1, borderRight: "1px solid rgba(255,255,255,0.1)", paddingRight: "24px" }}>
                  <div className="stat-label" style={{ marginBottom: "12px" }}>📋 سجل التحصيلات السابقة</div>
                  {selectedInvoice.history && selectedInvoice.history.length > 0 ? (
                    selectedInvoice.history.map(h => (
                      <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div>
                          <div style={{ fontSize: "13px" }}>{h.note || "تحصيل"}</div>
                          <small style={{ color: "#64748b" }}>{new Date(h.payment_date).toLocaleDateString("ar-EG")}</small>
                        </div>
                        <span style={{ color: "#34d399", fontWeight: "bold" }}>+{fmt(h.amount_paid)}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", color: "#475569", padding: "20px" }}>لا توجد مدفوعات سابقة</div>
                  )}
                </div>
              </div>
            </div>
            <div className="cyber-modal-footer">
              <button className="btn-action-neon btn-secondary" onClick={() => setSelectedInvoice(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallmentCollection;