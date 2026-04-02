import { Clock } from "lucide-react";

const PendingPanel = ({ pendingList, onResume, onClose }) => (
  <div className="modal-overlay" onClick={(e) => e.target.className === "modal-overlay" && onClose()}>
    <div className="modal-content-premium form-modal" style={{ minWidth: 520 }}>
      <div className="modal-header">
        <h3>الفواتير المعلقة <span className="count-badge">{pendingList.length}</span></h3>
      </div>
      <div style={{ padding: "16px", maxHeight: 440, overflowY: "auto" }}>
        {pendingList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#aaa" }}>
            <Clock size={40} strokeWidth={1} style={{ display: "block", margin: "0 auto 12px" }} />
            <p>لا توجد فواتير معلقة</p>
          </div>
        ) : pendingList.map((inv) => (
          <div key={inv.id} className="pending-card" onClick={() => onResume(inv)}>
            <div className="pending-info">
              <span className="pending-num">#{inv.invoice_number}</span>
              <span className="pending-customer">{inv.customer_name}</span>
              <span className="pending-date">{new Date(inv.created_at || Date.now()).toLocaleString("ar-EG")}</span>
            </div>
            <div className="pending-right">
              <span className="pending-total">{Number(inv.total_after_discount).toFixed(2)} ج.م</span>
              <span className="pending-resume-btn">▶ استئناف</span>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-footer">
        <button className="btn-cancel" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  </div>
);

export default PendingPanel;