import { XCircle } from "lucide-react";

const DeleteConfirm = ({ item, onConfirm, onCancel }) => (
  <div className="modal-overlay">
    <div className="modal-content-premium form-modal" style={{ maxWidth: 360, textAlign: "center" }}>
      <div style={{ padding: "24px 0 0" }}>
        <XCircle size={48} color="#e74c3c" strokeWidth={1.5} />
      </div>
      <h3 style={{ margin: "12px 0 6px", color: "#2c3e50" }}>حذف المنتج؟</h3>
      <p style={{ color: "#888", fontSize: 13 }}>هتحذف <strong>{item?.name}</strong> من السلة</p>
      <div className="modal-footer" style={{ justifyContent: "center", gap: 12 }}>
        <button className="btn-danger" onClick={onConfirm}>نعم، احذف</button>
        <button className="btn-cancel" onClick={onCancel}>إلغاء</button>
      </div>
    </div>
  </div>
);

export default DeleteConfirm;