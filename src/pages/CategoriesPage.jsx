import { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import {
  Plus,
  Trash2,
  Tag,
  LayoutGrid,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

const CategoriesPage = ({ showToast }) => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, name: "" });

  const fetchCategories = async () => {
    try {
      const db = await getDb();
      const result = await db.select(
        "SELECT * FROM categories ORDER BY id DESC"
      );
      setCategories(result);
    } catch (err) {
      console.error(err);
      showToast("خطأ في الاتصال بقاعدة البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      const db = await getDb();
      await db.execute("INSERT INTO categories (name) VALUES ($1)", [
        newCategory.trim(),
      ]);
      setNewCategory("");
      showToast("تمت إضافة الفئة بنجاح", "success");
      await fetchCategories();
    } catch (err) {
      showToast("الفئة موجودة بالفعل أو هناك خطأ في الإدخال", "error");
    }
  };

  const confirmDelete = (id, name) => {
    setDeleteModal({ show: true, id, name });
  };

  const handleDelete = async () => {
    const { id } = deleteModal;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM categories WHERE id = $1", [id]);
      showToast("تم حذف الفئة بنجاح", "success");
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      setDeleteModal({ show: false, id: null, name: "" });
    } catch (err) {
      console.error(err);
      showToast("فشل الحذف: قد تكون الفئة مرتبطة بمنتجات موجودة", "error");
      setDeleteModal({ show: false, id: null, name: "" });
    }
  };

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
        .main-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
        }
        .sub-title {
          color: #94a3b8;
          font-size: 0.9rem;
          margin: 4px 0 0;
        }
        .count-badge {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 14px;
          margin-right: 8px;
        }
        .category-management-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 24px;
          margin-top: 20px;
        }
        @media (max-width: 768px) {
          .category-management-grid { grid-template-columns: 1fr; }
        }
        .glass-card-premium {
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
          transition: all 0.3s ease;
        }
        .glass-card-premium:hover {
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .card-header-simple {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          font-weight: 700;
          color: #f1f5f9;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 12px;
        }
        .header-dot {
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          box-shadow: 0 0 8px #3b82f6;
        }
        .dot-green { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .premium-form { display: flex; flex-direction: column; gap: 16px; }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label {
          font-size: 13px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .input-group input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 12px;
          color: #f1f5f9;
          font-size: 14px;
          transition: all 0.2s;
        }
        .input-group input:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .btn-save {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-save:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .w-full { width: 100%; }
        .categories-list {
          max-height: 500px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .category-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255,255,255,0.03);
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.2s;
        }
        .category-item-row:hover {
          background: rgba(59,130,246,0.08);
          border-color: rgba(59,130,246,0.3);
          transform: translateX(-5px);
        }
        .cat-info {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #cbd5e1;
        }
        .cat-name { font-weight: 500; }
        .action-btn {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.2s;
        }
        .action-btn:hover { color: #f87171; border-color: #ef4444; background: rgba(239,68,68,0.1); }
        .loading-state {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up {
          animation: slideUp 0.25s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* مودال الحذف */
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
          max-width: 420px;
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
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; font-size: 20px; }
        .modal-close-btn:hover { color: white; }
        .cyber-form { padding: 24px; display: flex; flex-direction: column; gap: 18px; text-align: center; }
        .cyber-modal-actions { display: flex; gap: 12px; margin-top: 8px; }
        .cyber-btn-submit { flex: 1; padding: 12px; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-submit.danger-bg { background: #ef4444; }
        .cyber-btn-submit.danger-bg:hover { background: #dc2626; }
        .cyber-btn-dismiss { padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #94a3b8; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-dismiss:hover { background: #334155; color: white; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">
            إدارة الفئات <span className="count-badge">{categories.length}</span>
          </h2>
          <p className="sub-title">التحكم في التصنيفات المخزنة فعلياً</p>
        </div>
      </div>

      {/* Grid */}
      <div className="category-management-grid">
        {/* إضافة فئة جديدة */}
        <div className="glass-card-premium">
          <div className="card-header-simple">
            <div className="header-dot"></div>
            <span>إضافة فئة جديدة</span>
          </div>
          <form onSubmit={handleAddCategory} className="premium-form">
            <div className="input-group">
              <label>اسم الفئة</label>
              <input
                type="text"
                placeholder="اكتب اسم الفئة هنا..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-save w-full">
              <Plus size={18} /> حفظ الفئة
            </button>
          </form>
        </div>

        {/* قائمة الفئات */}
        <div className="glass-card-premium">
          <div className="card-header-simple">
            <div className="header-dot dot-green"></div>
            <span>قائمة الفئات</span>
          </div>

          <div className="categories-list">
            {loading ? (
              <div className="loading-state">
                <Loader2 className="animate-spin" size={32} />
                <p style={{ marginTop: "12px" }}>جاري التحميل...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <p>لا يوجد فئات مخزنة. أضف فئة لتبدأ.</p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="category-item-row animate-slide-up">
                  <div className="cat-info">
                    <Tag size={16} style={{ color: "#60a5fa" }} />
                    <span className="cat-name">{cat.name}</span>
                  </div>
                  <button
                    className="action-btn"
                    onClick={() => confirmDelete(cat.id, cat.name)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* مودال تأكيد الحذف */}
      {deleteModal.show && (
        <div className="blur-overlay" onClick={() => setDeleteModal({ show: false, id: null, name: "" })}>
          <div className="cyber-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>حذف الفئة</h3>
              <button className="modal-close-btn" onClick={() => setDeleteModal({ show: false, id: null, name: "" })}>✕</button>
            </div>
            <div className="cyber-form">
              <AlertCircle size={48} style={{ color: "#f87171", margin: "0 auto" }} />
              <p style={{ fontSize: "15px", marginTop: "8px" }}>
                هل أنت متأكد من حذف الفئة <strong>“{deleteModal.name}”</strong>؟
              </p>
              <p style={{ fontSize: "12px", color: "#64748b" }}>
                هذا الإجراء لا يمكن التراجع عنه. قد تتأثر المنتجات المرتبطة بهذه الفئة.
              </p>
              <div className="cyber-modal-actions">
                <button className="cyber-btn-submit danger-bg" onClick={handleDelete}>
                  تأكيد الحذف
                </button>
                <button className="cyber-btn-dismiss" onClick={() => setDeleteModal({ show: false, id: null, name: "" })}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;