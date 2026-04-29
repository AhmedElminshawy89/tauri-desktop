import { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import { Plus, Trash2, UserPlus, X, Phone, User, Loader2 } from "lucide-react";

const SuppliersPage = ({ showToast }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "" });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const res = await db.select("SELECT * FROM suppliers ORDER BY id DESC");
      setSuppliers(res || []);
    } catch (err) {
      showToast("خطأ في تحميل الموردين", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const db = await getDb();
      await db.execute("INSERT INTO suppliers (name, phone) VALUES ($1, $2)", [newSupplier.name, newSupplier.phone]);
      showToast("تم إضافة المورد بنجاح", "success");
      setModalOpen(false);
      setNewSupplier({ name: "", phone: "" });
      fetchSuppliers();
    } catch (err) {
      showToast("خطأ أثناء الحفظ", "error");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("هل أنت متأكد من حذف هذا المورد؟")) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM suppliers WHERE id = $1", [id]);
        showToast("تم حذف المورد", "success");
        fetchSuppliers();
      } catch (err) {
        showToast("لا يمكن حذف المورد (قد يكون مرتبطاً بفواتير)", "error");
      }
    }
  };

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      {/* الهيدر بنفس ستايل صفحة المنتجات */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">الموردين <span className="count-badge">{suppliers.length}</span></h2>
          <p className="sub-title">إدارة الموردين المعتمدين لعمليات الشراء</p>
        </div>
        <button className="btn-save shadow-glow" onClick={() => setModalOpen(true)}>
          <UserPlus size={20} /> <span>مورد جديد</span>
        </button>
      </div>

      {/* الجدول بنفس ستايل custom-table */}
      <div className="table-wrapper-premium shadow-glow">
        <table className="custom-table">
          <thead>
            <tr>
              <th>اسم المورد</th>
              <th>رقم الهاتف</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" className="text-center p-10"><Loader2 className="animate-spin inline-block ml-2"/> جاري التحميل...</td></tr>
            ) : suppliers.length > 0 ? (
              suppliers.map((s) => (
                <tr key={s.id} className="table-row">
                  <td><span className="model-primary-name">{s.name}</span></td>
                  <td>{s.phone || <span className="text-muted">لا يوجد</span>}</td>
                  <td className="actions-cell-premium" style={{ justifyContent: "center" }}>
                    <button className="action-btn delete" onClick={() => handleDelete(s.id)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3" className="text-center p-10">لا يوجد موردين مسجلين حالياً</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* المودال بنفس ستايل modal-content-premium */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content-premium form-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>إضافة مورد جديد</h3>
              <button className="btn-cancel" onClick={() => setModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="premium-form">
              <div className="input-group">
                <label><User size={14} className="inline ml-1"/> اسم المورد</label>
                <input placeholder="مثال: شركة النور للملابس" className="premium-input" onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})} required />
              </div>
              <div className="input-group">
                <label><Phone size={14} className="inline ml-1"/> رقم الهاتف</label>
                <input placeholder="01xxxxxxxxx" className="premium-input" onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})} />
              </div>
              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button type="submit" className="btn-save w-full">حفظ المورد</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;