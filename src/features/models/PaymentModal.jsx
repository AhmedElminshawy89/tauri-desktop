import React, { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Printer,
  Repeat,
  Wallet,
  Calendar,
  Info,
  Trash2,
  Plus,
  Clock,
  HandCoins,
} from "lucide-react";

const PaymentModal = ({ finalTotal, onConfirm, onCancel }) => {
  const [method, setMethod] = useState("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [firstPayment, setFirstPayment] = useState("");

  // نظام الأقساط اليدوي
  const [manualInstallments, setManualInstallments] = useState([
    { id: Date.now(), due_date: "", amount_due: "" },
  ]);

  const firstPayNum = parseFloat(firstPayment || 0);
  const remainingTotal = Math.max(0, finalTotal - firstPayNum);

  // حساب إجمالي المبالغ التي تم توزيعها يدوياً
  const distributedAmount = manualInstallments.reduce(
    (sum, inst) => sum + parseFloat(inst.amount_due || 0),
    0
  );
  const diff = remainingTotal - distributedAmount;

  const addInstallmentRow = () => {
    setManualInstallments([
      ...manualInstallments,
      { id: Date.now(), due_date: "", amount_due: "" },
    ]);
  };

  const removeRow = (id) => {
    setManualInstallments(manualInstallments.filter((row) => row.id !== id));
  };

  const updateRow = (id, field, value) => {
    setManualInstallments(
      manualInstallments.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleConfirm = () => {
    const paymentResult = {
      method,
      total_after_discount: finalTotal,
      paid_amount: method === "installment" ? firstPayNum : finalTotal,
      remaining_amount: method === "installment" ? remainingTotal : 0,
      installments_count: manualInstallments.length,
      payment_entry: {
        amount: method === "installment" ? firstPayNum : finalTotal,
        type:
          method === "visa"
            ? "visa_payment"
            : method === "installment"
              ? "down_payment"
              : "full_payment",
        date: new Date().toISOString(),
        note:
          method === "installment"
            ? `مقدم تقسيط (${manualInstallments.length} قسط يدوي)`
            : `دفع ${method}`,
      },
      // إرسال المواعيد اليدوية
      installment_plan:
        method === "installment"
          ? manualInstallments.map((inst) => ({
              due_date: inst.due_date,
              amount_due: parseFloat(inst.amount_due),
              status: "pending",
            }))
          : [],
    };

    onConfirm(paymentResult);
    onCancel();
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content-premium form-modal"
        style={{ maxWidth: 550 }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HandCoins size={20} color="#3498db" />
            <h3 style={{ marginTop: "12px" }}>إنهاء المعاملة وتخصيص الدفع</h3>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          {/* خيارات الدفع الثلاثة */}
          <div
            className="payment-methods"
            style={{
              marginBottom: "20px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
            }}
          >
            <button
              className={`pay-method-btn ${method === "cash" ? "active" : ""}`}
              onClick={() => setMethod("cash")}
            >
              <Banknote size={20} /> <span>كاش</span>
            </button>
            <button
              className={`pay-method-btn ${method === "visa" ? "active" : ""}`}
              onClick={() => setMethod("visa")}
            >
              <CreditCard size={20} /> <span>فيزا</span>
            </button>
            <button
              className={`pay-method-btn ${method === "installment" ? "active" : ""}`}
              onClick={() => setMethod("installment")}
            >
              <Repeat size={20} /> <span>تقسيط</span>
            </button>
          </div>

          {method === "installment" && (
            <div className="animate-fade-in">
              <div
                className="input-group full-width"
                style={{ marginBottom: "15px" }}
              >
                <label>المبلغ المقدم الآن</label>
                <input
                  type="number"
                  value={firstPayment}
                  className="premium-input"
                  onChange={(e) => setFirstPayment(e.target.value)}
                  placeholder="0.00"
                />
                <div
                  style={{
                    fontSize: "12px",
                    color: "#3498db",
                    marginTop: "5px",
                  }}
                >
                  المتبقي لجدولته:{" "}
                  <strong>{remainingTotal.toLocaleString()} ج.م</strong>
                </div>
              </div>

              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  padding: "5px",
                }}
              >
                <label
                  style={{
                    fontSize: "13px",
                    marginBottom: "10px",
                    display: "block",
                    color: "#94a3b8",
                  }}
                >
                  جدول المواعيد اليدوي:
                </label>
                {manualInstallments.map((inst, index) => (
                  <div
                    key={inst.id}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "10px",
                      alignItems: "center",
                    }}
                    className="discount-inputs"
                  >
                    <span className={`rank-badge rank-${index + 1}`}>
                      {index + 1}
                    </span>
                    <input
                      type="date"
                      className="premium-input"
                      style={{ flex: 2 }}
                      value={inst.due_date}
                      onChange={(e) =>
                        updateRow(inst.id, "due_date", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className="premium-input"
                      style={{ flex: 1 }}
                      value={inst.amount_due}
                      onChange={(e) =>
                        updateRow(inst.id, "amount_due", e.target.value)
                      }
                      placeholder="المبلغ"
                    />
                    <button
                      onClick={() => removeRow(inst.id)}
                      style={{
                        color: "#ef4444",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addInstallmentRow}
                className="action-btn edit"
                style={{
                  width: "100%",
                  marginTop: "10px",
                  display: "flex",
                  justifyContent: "center",
                  gap: "5px",
                  fontSize: "12px",
                }}
              >
                <Plus size={14} /> إضافة قسط آخر
              </button>

              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  borderRadius: "8px",
                  background:
                    Math.abs(diff) < 1
                      ? "rgba(46, 204, 113, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  fontSize: "12px",
                  textAlign: "center",
                }}
              >
                {diff === 0
                  ? " المبالغ مطابقة للمتبقي"
                  : `فرق المبالغ: ${diff.toLocaleString()} ج.م`}
              </div>
            </div>
          )}

          {(method === "cash" || method === "visa") && (
            <div
              style={{
                textAlign: "center",
                padding: "30px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "15px",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ color: "#94a3b8" }}>
                {method === "visa"
                  ? "سيتم الخصم عبر ماكينة الفيزا"
                  : "المبلغ المطلوب نقداً"}
              </span>
              <h2
                style={{
                  color: method === "visa" ? "#3498db" : "#2ecc71",
                  fontSize: "2.4rem",
                  marginTop: "10px",
                }}
              >
                {finalTotal.toLocaleString()} ج.م
              </h2>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn-save flex-2"
            onClick={handleConfirm}
            disabled={
              method === "installment" &&
              (Math.abs(diff) > 1 ||
                manualInstallments.some((i) => !i.due_date || !i.amount_due))
            }
          >
            <Printer size={18} /> تأكيد العملية
          </button>
          <button className="btn-cancel flex-1" onClick={onCancel}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
