import React, { useState } from "react";
import {
  Banknote,
  CreditCard,
  Printer,
  Repeat,
  HandCoins,
} from "lucide-react";

const PaymentModal = ({ finalTotal, onConfirm, onCancel, existingPaymentData = null }) => {
  const [method, setMethod] = useState("cash");
  const [cashGiven, setCashGiven] = useState(existingPaymentData?.cash_given?.toString() || "");
  const [firstPayment, setFirstPayment] = useState(existingPaymentData?.paid_amount?.toString() || "");
  
  const firstPayNum = parseFloat(firstPayment || 0);
  const totalRemaining = Math.max(0, finalTotal - firstPayNum);

  const handleConfirm = () => {
    const paymentResult = {
      method: method,
      paid_amount: method === "installment" ? firstPayNum : finalTotal,
      remaining_amount: method === "installment" ? totalRemaining : 0,
      installments_count: 0, // لا توجد أقساط محددة مسبقاً
      cash_given: method === "cash" ? parseFloat(cashGiven || 0) : null,
      change_amount: method === "cash" ? Math.max(0, parseFloat(cashGiven || 0) - finalTotal) : 0,
      total_amount: finalTotal,
      installment_plan: [], // لا توجد خطة أقساط
    };
    onConfirm(paymentResult);
  };

  const isConfirmDisabled = () => {
    if (method === "installment") return firstPayNum <= 0;
    if (method === "cash") return parseFloat(cashGiven || 0) < finalTotal;
    return false;
  };

  return (
    <div className="ei-modal-overlay" onClick={onCancel}>
      <div className="ei-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
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
            <button className={`ei-pay-btn ${method === "cash" ? "active green" : ""}`} onClick={() => setMethod("cash")}>
              <Banknote size={18} /> كاش
            </button>
            <button className={`ei-pay-btn ${method === "visa" ? "active" : ""}`} onClick={() => setMethod("visa")}>
              <CreditCard size={18} /> فيزا
            </button>
            <button className={`ei-pay-btn ${method === "installment" ? "active" : ""}`} onClick={() => setMethod("installment")}>
              <Repeat size={18} /> تقسيط
            </button>
          </div>

          {method === "cash" && (
            <div className="ei-installment-box">
              <div className="ei-installment-label">المبلغ المستلم من العميل</div>
              <input type="number" value={cashGiven} className="ei-installment-input" onChange={(e) => setCashGiven(e.target.value)} placeholder="أدخل المبلغ" autoFocus />
              {parseFloat(cashGiven || 0) >= finalTotal && (
                <div className="ei-remaining-row" style={{ marginTop: 8 }}>
                  <span className="lbl">المبلغ المتبقي للعميل</span>
                  <span className="val" style={{ color: "var(--green)" }}>{(parseFloat(cashGiven || 0) - finalTotal).toFixed(2)} ج.م</span>
                </div>
              )}
            </div>
          )}

          {method === "visa" && (
            <div className="ei-installment-box" style={{ textAlign: "center", padding: 30 }}>
              <CreditCard size={48} style={{ color: "var(--accent)", marginBottom: 12 }} />
              <div style={{ fontSize: 20, fontWeight: "bold" }}>{finalTotal.toLocaleString()} ج.م</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>سيتم الخصم عبر ماكينة الفيزا</div>
            </div>
          )}

          {method === "installment" && (
            <div className="ei-installment-box">
              <div className="ei-installment-label">المبلغ المقدم (الدفعة الأولى)</div>
              <input type="number" value={firstPayment} className="ei-installment-input" onChange={(e) => setFirstPayment(e.target.value)} placeholder="0.00" autoFocus />
              <div className="ei-remaining-row" style={{ marginTop: 8 }}>
                <span className="lbl">المتبقي للتقسيط</span>
                <span className="val" style={{ color: "var(--amber)" }}>{totalRemaining.toLocaleString()} ج.م</span>
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>يمكن للعميل سداد الباقي لاحقاً بأي مبلغ في أي وقت</p>
            </div>
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