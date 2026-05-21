import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Tag,
  Percent,
  Package,
  Layers,
  ShoppingCart,
  Gift,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const OfferTypeLabels = {
  product: "خصم على منتج",
  category: "خصم على فئة",
  cart: "خصم على السلة",
  buy_x_get_y: "اشتري X واحصل على Y مجاناً",
  quantity_discount: "خصم بالكمية",
};

const OfferForm = ({ offer, onSave, onCancel, showToast, categories, products }) => {
  const [form, setForm] = useState({
    name: "",
    type: "product",
    target_id: "",
    discount_type: "percentage",
    discount_value: "",
    min_quantity: 1,
    free_quantity: 0,
    start_date: "",
    end_date: "",
    is_active: 1,
    ...offer,
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showToast("يرجى إدخال اسم العرض", "error");
      return;
    }
    if (form.type !== "cart" && !form.target_id) {
      showToast("يرجى اختيار المنتج أو الفئة", "error");
      return;
    }
    if (!form.discount_value || form.discount_value <= 0) {
      showToast("يرجى إدخال قيمة خصم صحيحة", "error");
      return;
    }
    onSave(form);
  };

  const isTargetRequired = form.type !== "cart";
  const isBuyXGetY = form.type === "buy_x_get_y";
  const isQuantityDiscount = form.type === "quantity_discount";

  return (
    <div className="premium-form" style={{ padding: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label>اسم العرض</label>
          <input
            type="text"
            className="premium-select"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="مثال: خصم الصيف"
          />
        </div>
        <div>
          <label>نوع العرض</label>
          <select
            className="premium-select"
            value={form.type}
            onChange={(e) => handleChange("type", e.target.value)}
          >
            {Object.entries(OfferTypeLabels).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        {isTargetRequired && (
          <div>
            <label>{form.type === "product" ? "المنتج" : "الفئة"}</label>
            <select
              className="premium-select"
              value={form.target_id}
              onChange={(e) => handleChange("target_id", e.target.value)}
            >
              <option value="">-- اختر --</option>
              {form.type === "product" &&
                products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              {form.type === "category" &&
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div>
          <label>نوع الخصم</label>
          <select
            className="premium-select"
            value={form.discount_type}
            onChange={(e) => handleChange("discount_type", e.target.value)}
          >
            <option value="percentage">نسبة مئوية (%)</option>
            <option value="fixed">قيمة ثابتة (ج.م)</option>
          </select>
        </div>
        <div>
          <label>قيمة الخصم</label>
          <input
            type="number"
            className="premium-select"
            value={form.discount_value}
            onChange={(e) => handleChange("discount_value", e.target.value)}
            placeholder={form.discount_type === "percentage" ? "مثال: 10" : "مثال: 50"}
          />
        </div>
        {(isBuyXGetY || isQuantityDiscount) && (
          <div>
            <label>الكمية المطلوبة (X)</label>
            <input
              type="number"
              className="premium-select"
              value={form.min_quantity}
              onChange={(e) => handleChange("min_quantity", parseInt(e.target.value) || 1)}
              min="1"
            />
          </div>
        )}
        {isBuyXGetY && (
          <div>
            <label>الكمية المجانية (Y)</label>
            <input
              type="number"
              className="premium-select"
              value={form.free_quantity}
              onChange={(e) => handleChange("free_quantity", parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
        )}
        <div>
          <label>تاريخ البداية</label>
          <input
            type="date"
            className="premium-select"
            value={form.start_date?.split("T")[0] || ""}
            onChange={(e) => handleChange("start_date", e.target.value)}
          />
        </div>
        <div>
          <label>تاريخ النهاية</label>
          <input
            type="date"
            className="premium-select"
            value={form.end_date?.split("T")[0] || ""}
            onChange={(e) => handleChange("end_date", e.target.value)}
          />
        </div>
        <div>
          <label>الحالة</label>
          <select
            className="premium-select"
            value={form.is_active}
            onChange={(e) => handleChange("is_active", parseInt(e.target.value))}
          >
            <option value="1">نشط</option>
            <option value="0">غير نشط</option>
          </select>
        </div>
      </div>
      <div className="modal-footer" style={{ marginTop: "24px" }}>
        <button className="btn-save" onClick={handleSubmit}>
          حفظ
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
};

const Offers = ({ showToast }) => {
  const [offers, setOffers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const rows = await db.select("SELECT * FROM offers ORDER BY id DESC");
      setOffers(rows || []);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في جلب العروض", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndProducts = async () => {
    try {
      const db = await getDb();
      const cats = await db.select("SELECT id, name FROM categories ORDER BY name");
      setCategories(cats || []);
      const prods = await db.select("SELECT id, name FROM products ORDER BY name");
      setProducts(prods || []);
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchCategoriesAndProducts();
  }, []);

  const handleSaveOffer = async (offerData) => {
    try {
      const db = await getDb();
      if (editingOffer) {
        await db.execute(
          `UPDATE offers SET
            name = ?, type = ?, target_id = ?, discount_type = ?, discount_value = ?,
            min_quantity = ?, free_quantity = ?, start_date = ?, end_date = ?, is_active = ?
           WHERE id = ?`,
          [
            offerData.name,
            offerData.type,
            offerData.target_id || null,
            offerData.discount_type,
            offerData.discount_value,
            offerData.min_quantity,
            offerData.free_quantity,
            offerData.start_date || null,
            offerData.end_date || null,
            offerData.is_active,
            editingOffer.id,
          ]
        );
        showToast("تم تحديث العرض بنجاح", "success");
      } else {
        await db.execute(
          `INSERT INTO offers (
            name, type, target_id, discount_type, discount_value,
            min_quantity, free_quantity, start_date, end_date, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            offerData.name,
            offerData.type,
            offerData.target_id || null,
            offerData.discount_type,
            offerData.discount_value,
            offerData.min_quantity,
            offerData.free_quantity,
            offerData.start_date || null,
            offerData.end_date || null,
            offerData.is_active,
          ]
        );
        showToast("تم إضافة العرض بنجاح", "success");
      }
      setModalOpen(false);
      setEditingOffer(null);
      await fetchOffers();
    } catch (err) {
      console.error(err);
      showToast("خطأ في حفظ العرض", "error");
    }
  };

  const handleDelete = async (offer) => {
    if (!window.confirm(`هل أنت متأكد من حذف العرض "${offer.name}"؟`)) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM offers WHERE id = ?", [offer.id]);
      showToast("تم حذف العرض", "success");
      fetchOffers();
    } catch (err) {
      showToast("خطأ في الحذف", "error");
    }
  };

  const filtered = offers.filter((o) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag size={28} style={{ color: "#f97316" }} />
            <h2 className="main-title">العروض والخصومات</h2>
          </div>
          <p className="sub-title">إدارة العروض الترويجية والخصومات على المنتجات والفئات والسلة</p>
        </div>
        <div className="header-actions-group">
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="بحث بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-select"
              style={{ width: 280, paddingRight: 36 }}
            />
            <Search size={15} style={{ position: "absolute", right: 12, top: 13, color: "#94a3b8" }} />
          </div>
          <button className="btn-save" onClick={fetchOffers}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            <span>تحديث</span>
          </button>
          <button className="btn-save" onClick={() => { setEditingOffer(null); setModalOpen(true); }}>
            <Plus size={18} /> إضافة عرض
          </button>
        </div>
      </div>

      <div className="table-wrapper-premium">
        <table className="custom-table">
          <thead>
            <tr>
              <th>#</th>
              <th>اسم العرض</th>
              <th>النوع</th>
              <th>الهدف</th>
              <th>الخصم</th>
              <th>الفترة</th>
              <th>الحالة</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center" style={{ padding: 50 }}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="8" className="text-center" style={{ padding: 50 }}>لا توجد عروض</td></tr>
            ) : (
              filtered.map((offer, idx) => {
                let targetText = "";
                if (offer.type === "product") {
                  const prod = products.find((p) => p.id === offer.target_id);
                  targetText = prod ? prod.name : "منتج محذوف";
                } else if (offer.type === "category") {
                  const cat = categories.find((c) => c.id === offer.target_id);
                  targetText = cat ? cat.name : "فئة محذوفة";
                } else if (offer.type === "cart") {
                  targetText = "السلة بأكملها";
                } else if (offer.type === "buy_x_get_y") {
                  targetText = `اشترِ ${offer.min_quantity} واحصل على ${offer.free_quantity} مجاناً`;
                } else if (offer.type === "quantity_discount") {
                  targetText = `عند شراء ${offer.min_quantity} قطعة`;
                }
                const discountDisplay =
                  offer.discount_type === "percentage"
                    ? `${offer.discount_value}%`
                    : fmt(offer.discount_value);
                const dateRange =
                  offer.start_date || offer.end_date
                    ? `${offer.start_date?.slice(0, 10) || ""} → ${offer.end_date?.slice(0, 10) || ""}`
                    : "دائم";
                return (
                  <tr key={offer.id} className="table-row">
                    <td>{idx + 1}</td>
                    <td>{offer.name}</td>
                    <td>{OfferTypeLabels[offer.type]}</td>
                    <td>{targetText}</td>
                    <td>{discountDisplay}</td>
                    <td>{dateRange}</td>
                    <td>
                      {offer.is_active ? (
                        <span style={{ color: "#22c55e" }}>نشط</span>
                      ) : (
                        <span style={{ color: "#ef4444" }}>غير نشط</span>
                      )}
                    </td>
                    <td className="actions-cell-premium" style={{ gap: "8px" }}>
                      <button
                        className="action-btn edit"
                        onClick={() => { setEditingOffer(offer); setModalOpen(true); }}
                        title="تعديل"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDelete(offer)}
                        title="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingOffer(null); }}>
          <div className="modal-content-premium" style={{ maxWidth: "700px", width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingOffer ? "تعديل عرض" : "إضافة عرض جديد"}</h3>
            </div>
            <OfferForm
              offer={editingOffer}
              onSave={handleSaveOffer}
              onCancel={() => { setModalOpen(false); setEditingOffer(null); }}
              showToast={showToast}
              categories={categories}
              products={products}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Offers;