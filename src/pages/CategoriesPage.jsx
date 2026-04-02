import { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import {
  Plus,
  Trash2,
  Tag,
  LayoutGrid,
  AlertCircle,
  Loader2,
} from "lucide-react";

const CategoriesPage = ({ showToast }) => {
  const [categories, setCategories] = useState([]); // تبدأ فاضية تماماً
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);

  // دالة جلب البيانات - دي اللي بتخلي الفئات تظهر "أوتوماتيك" من الداتابيز بس
  const fetchCategories = async () => {
    try {
      const db = await getDb();
      // بنجيب البيانات من الجدول اللي في db.js
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
      await fetchCategories(); // تحديث القائمة فوراً
    } catch (err) {
      showToast("الفئة موجودة بالفعل أو هناك خطأ في الإدخال", "error");
    }
  };

  const handleDelete = async (id) => {
    // تأكيد قبل الحذف
    if (!window.confirm("هل أنت متأكد من حذف هذه الفئة؟")) return;

    try {
      const db = await getDb();
      // تنفيذ أمر الحذف
      await db.execute("DELETE FROM categories WHERE id = $1", [id]);
      showToast("تم حذف الفئة بنجاح", "success");

      // تحديث الواجهة فوراً عن طريق فلترة المصفوفة الحالية بدل عمل fetch جديد (أسرع)
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    } catch (err) {
      console.error(err);
      showToast("فشل الحذف: قد تكون الفئة مرتبطة بمنتجات موجودة", "error");
    }
  };

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">
            إدارة الفئات{" "}
            <span className="count-badge">{categories.length}</span>
          </h2>
          <p className="sub-title">التحكم في التصنيفات المخزنة فعلياً</p>
        </div>
      </div>

      <div className="category-management-grid">
        <div className="glass-card-premium add-category-card shadow-glow">
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

        <div className="glass-card-premium list-category-card shadow-glow">
          <div className="card-header-simple">
            <div className="header-dot dot-green"></div>
            <span>قائمة الفئات</span>
          </div>

          <div className="categories-list">
            {loading ? (
              <div className="loading-state">
                <Loader2 className="animate-spin" />
              </div>
            ) : categories.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={40} color="#475569" />
                <p>لا يوجد فئات مخزنة. أضف فئة لتبدأ.</p>
              </div>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="category-item-row animate-slide-up"
                >
                  <div className="cat-info">
                    <Tag size={16} className="text-primary" />
                    <span className="cat-name">{cat.name}</span>
                  </div>
                  <button
                    className="action-btn delete-mini-premium"
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;
