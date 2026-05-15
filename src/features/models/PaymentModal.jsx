import React, { useState, useEffect } from "react";
import {
  Banknote,
  CreditCard,
  Printer,
  Repeat,
  HandCoins,
  Trash2,
  Plus,
  AlertTriangle,
} from "lucide-react";

const PaymentModal = ({ finalTotal, onConfirm, onCancel, existingPaymentData = null }) => {
  const [method, setMethod] = useState("cash");
  const [cashGiven, setCashGiven] = useState(existingPaymentData?.cash_given?.toString() || "");
  const [firstPayment, setFirstPayment] = useState(existingPaymentData?.paid_amount?.toString() || "");
  
  const [installments, setInstallments] = useState(() => {
    if (existingPaymentData?.installment_plan?.length > 0) {
      return existingPaymentData.installment_plan.map((inst, idx) => ({
        id: Date.now() + idx,
        due_date: inst.due_date,
        amount_due: inst.amount_due?.toString() || "",
      }));
    }
    return [{ id: Date.now(), due_date: "", amount_due: "" }];
  });

  const firstPayNum = parseFloat(firstPayment || 0);
  const totalRemaining = Math.max(0, finalTotal - firstPayNum);
  
  const distributedAmount = installments.reduce(
    (sum, inst) => sum + parseFloat(inst.amount_due || 0),
    0
  );
  const diff = totalRemaining - distributedAmount;
  const isInstallmentValid = installments.every(inst => inst.due_date && parseFloat(inst.amount_due) > 0) && Math.abs(diff) < 0.01 && firstPayNum > 0;

  const addInstallmentRow = () => {
    setInstallments([
      ...installments,
      { id: Date.now(), due_date: "", amount_due: "" },
    ]);
  };

  const removeRow = (id) => {
    if (installments.length === 1) return;
    setInstallments(installments.filter((row) => row.id !== id));
  };

  const updateRow = (id, field, value) => {
    setInstallments(
      installments.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const calculateChange = () => {
    const given = parseFloat(cashGiven || 0);
    return given >= finalTotal ? given - finalTotal : 0;
  };

  const handleConfirm = () => {
    const paymentResult = {
      method: method,
      paid_amount: method === "installment" ? firstPayNum : finalTotal,
      remaining_amount: method === "installment" ? totalRemaining : 0,
      installments_count: method === "installment" ? installments.length : 0,
      cash_given: method === "cash" ? parseFloat(cashGiven || 0) : null,
      change_amount: method === "cash" ? calculateChange() : 0,
      total_amount: finalTotal,
      installment_plan: method === "installment" 
        ? installments.map(inst => ({
            due_date: inst.due_date,
            amount_due: parseFloat(inst.amount_due),
            status: "pending",
          }))
        : [],
    };

    console.log("📦 PaymentModal sending:", paymentResult);
    onConfirm(paymentResult);
  };

  const isConfirmDisabled = () => {
    if (method === "installment") {
      return !isInstallmentValid;
    }
    if (method === "cash") {
      const given = parseFloat(cashGiven || 0);
      return given < finalTotal;
    }
    return false;
  };

  return (
    <div className="ei-modal-overlay" onClick={onCancel}>
      <div className="ei-modal" style={{ maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
        <div className="ei-modal-header">
          <div className="ei-modal-icon green"><HandCoins size={20} /></div>
          <div>
            <div className="ei-modal-title">إنهاء المعاملة</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              الإجمالي: <strong style={{ color: "var(--green)" }}>{finalTotal.toLocaleString()} ج.م</strong>
            </div>
          </div>
        </div>

        <div className="ei-modal-body">
          <div className="ei-payment-label">طريقة الدفع</div>
          <div className="ei-payment-methods" style={{ marginBottom: 20 }}>
            <button
              className={`ei-pay-btn ${method === "cash" ? "active green" : ""}`}
              onClick={() => setMethod("cash")}
            >
              <Banknote size={18} /> كاش
            </button>
            <button
              className={`ei-pay-btn ${method === "visa" ? "active" : ""}`}
              onClick={() => setMethod("visa")}
            >
              <CreditCard size={18} /> فيزا
            </button>
            <button
              className={`ei-pay-btn ${method === "installment" ? "active" : ""}`}
              onClick={() => setMethod("installment")}
            >
              <Repeat size={18} /> تقسيط
            </button>
          </div>

          {/* كاش */}
          {method === "cash" && (
            <div className="ei-installment-box" style={{ background: "rgba(16, 185, 129, 0.06)" }}>
              <div className="ei-installment-label">المبلغ المستلم من العميل</div>
              <input
                type="number"
                value={cashGiven}
                className="ei-installment-input"
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder="أدخل المبلغ"
                autoFocus
              />
              {parseFloat(cashGiven || 0) >= finalTotal && (
                <div className="ei-remaining-row" style={{ marginTop: 8 }}>
                  <span className="lbl">المبلغ المتبقي للعميل</span>
                  <span className="val" style={{ color: "var(--green)" }}>
                    {(parseFloat(cashGiven || 0) - finalTotal).toFixed(2)} ج.م
                  </span>
                </div>
              )}
            </div>
          )}

          {/* فيزا */}
          {method === "visa" && (
            <div className="ei-installment-box" style={{ textAlign: "center", padding: 30 }}>
              <CreditCard size={48} style={{ color: "var(--accent)", marginBottom: 12 }} />
              <div style={{ fontSize: 20, fontWeight: "bold" }}>{finalTotal.toLocaleString()} ج.م</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>سيتم الخصم عبر ماكينة الفيزا</div>
            </div>
          )}

          {/* تقسيط */}
          {method === "installment" && (
            <>
              <div className="ei-installment-box" style={{ marginBottom: 15 }}>
                <div className="ei-installment-label">المبلغ المقدم (الدفعة الأولى)</div>
                <input
                  type="number"
                  value={firstPayment}
                  className="ei-installment-input"
                  onChange={(e) => setFirstPayment(e.target.value)}
                  placeholder="0.00"
                />
                <div className="ei-remaining-row" style={{ marginTop: 8 }}>
                  <span className="lbl">المتبقي للتقسيط</span>
                  <span className="val" style={{ color: "var(--amber)" }}>{totalRemaining.toLocaleString()} ج.م</span>
                </div>
              </div>

              <div className="ei-payment-label">جدول الأقساط</div>
              {installments.map((inst, index) => (
                <div key={inst.id} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                  <span style={{ minWidth: 28, height: 28, background: "var(--surface2)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{index + 1}</span>
                  <input type="date" className="ei-field-input" style={{ flex: 2 }} value={inst.due_date} onChange={(e) => updateRow(inst.id, "due_date", e.target.value)} />
                  <input type="number" className="ei-field-input" style={{ flex: 1 }} value={inst.amount_due} onChange={(e) => updateRow(inst.id, "amount_due", e.target.value)} placeholder="المبلغ" />
                  <button onClick={() => removeRow(inst.id)} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 6, width: 32, height: 32, cursor: "pointer", color: "#ef4444" }} disabled={installments.length === 1}><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={addInstallmentRow} className="ei-btn ei-btn-secondary" style={{ width: "100%", justifyContent: "center", gap: 6, marginBottom: 12 }}><Plus size={14} /> إضافة قسط</button>

              {Math.abs(diff) >= 0.01 && (
                <div className="ei-warning-box" style={{ marginTop: 8 }}>
                  <AlertTriangle size={14} />
                  المتبقي: {totalRemaining.toLocaleString()} ج.م | تم توزيع: {distributedAmount.toLocaleString()} ج.م | الباقي: {diff.toLocaleString()} ج.م
                </div>
              )}
            </>
          )}
        </div>

        <div className="ei-modal-footer">
          <button className="ei-btn ei-btn-primary" style={{ flex: 2, justifyContent: "center" }} onClick={handleConfirm} disabled={isConfirmDisabled()}>
            <Printer size={16} /> تأكيد
          </button>
          <button className="ei-btn ei-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;