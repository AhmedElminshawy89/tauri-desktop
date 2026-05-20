import { Clock, StarIcon, Trash2 } from "lucide-react";

const PendingPanel = ({ pendingList, onResume, onCancel, onClose }) => (
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
        ) : (
          pendingList.map((inv) => (
            <div key={inv.id} className="pending-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "12px", border: "1px solid #eee", borderRadius: "8px" }}>
              <div className="pending-info" style={{ flex: 2 }}>
                <span className="pending-num" style={{ fontWeight: "bold", marginLeft: "10px" }}>#{inv.invoice_number}</span>
                <span className="pending-customer" style={{ marginLeft: "10px" }}>{inv.customer_name}</span>
                <span className="pending-date" style={{ fontSize: "12px", color: "#666" }}>{new Date(inv.created_at || Date.now()).toLocaleString("ar-EG")}</span>
              </div>
              <div className="pending-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className="pending-total" style={{ fontWeight: "bold", marginLeft: "10px" }}>{Number(inv.total_after_discount).toFixed(2)} ج.م</span>
                <button
                  className="btn-resume"
                  onClick={(e) => { e.stopPropagation(); onResume(inv); }}
                  style={{ padding: "4px 12px", background: "#4caf50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  <StarIcon size={14} /> استئناف
                </button>
                <button
                  className="btn-cancel"
                  onClick={(e) => { e.stopPropagation(); onCancel(inv); }}
                  style={{ padding: "4px 12px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Trash2 size={14} /> إلغاء
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="modal-footer">
        <button className="btn-cancel" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  </div>
);

export default PendingPanel;