import { useEffect, useState, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Plus,
  Trash2,
  Edit3,
  Package,
  Layers,
  Palette,
  XCircle,
  Eye,
  ChevronRight,
  Loader2,
  FolderPlus, // أيقونة لإضافة فئة سريعة
} from "lucide-react";

const ProductsPage = ({ showToast }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // الفئات الفعلية من الداتابيز
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("الكل");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // حالة إضافة فئة سريعة
  const [showQuickCat, setShowQuickCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");

  const [formData, setFormData] = useState({
    id: null,
    name: "",
    category: "", // ستبدأ فارغة ليتم اختيارها من الداتابيز
    cost_price: "",
    sale_price: "",
    season: "شتاء 2026",
  });

  const [variants, setVariants] = useState([]);

  // جلب المنتجات والفئات معاً
  const fetchData = async () => {
    try {
      const db = await getDb();

      // جلب الفئات أولاً
      const cats = await db.select(
        "SELECT * FROM categories ORDER BY name ASC"
      );
      setCategories(cats);

      // جلب المنتجات
      const result = await db.select(`
        SELECT p.*, 
        (SELECT SUM(stock) FROM product_variants WHERE product_id = p.id) as total_stock 
        FROM products p ORDER BY id DESC
      `);
      setProducts(result);

      // تعيين أول فئة كافتراضية في الفورم إذا كانت القائمة غير فارغة
      if (cats.length > 0 && !formData.category) {
        setFormData((prev) => ({ ...prev, category: cats[0].name }));
      }
    } catch (err) {
      showToast("خطأ في جلب البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // إضافة فئة سريعة من داخل المودال
  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      const db = await getDb();
      await db.execute("INSERT INTO categories (name) VALUES ($1)", [
        quickCatName.trim(),
      ]);

      // تحديث قائمة الفئات واختيار الجديدة فوراً
      const updatedCats = await db.select(
        "SELECT * FROM categories ORDER BY name ASC"
      );
      setCategories(updatedCats);
      setFormData((prev) => ({ ...prev, category: quickCatName.trim() }));

      setQuickCatName("");
      setShowQuickCat(false);
      showToast("تمت إضافة الفئة الجديدة", "success");
    } catch (err) {
      showToast("الفئة موجودة بالفعل", "error");
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        filterCategory === "الكل" || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, filterCategory, products]);

  const addVariantRow = () => {
    const autoBarcode =
      "V" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
    setVariants([
      ...variants,
      { color: "", size: "", stock: "", variant_barcode: autoBarcode },
    ]);
  };

  const removeVariantRow = (index) =>
    setVariants(variants.filter((_, i) => i !== index));

  const updateVariant = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const openAddModal = () => {
    setFormData({
      id: null,
      name: "",
      category: categories.length > 0 ? categories[0].name : "",
      cost_price: "",
      sale_price: "",
      season: "شتاء 2026",
    });
    setVariants([
      {
        color: "",
        size: "",
        stock: "",
        variant_barcode: "V" + Date.now().toString().slice(-6),
      },
    ]);
    setModalType("add");
  };

  const openEditModal = async (product) => {
    const db = await getDb();
    const productVariants = await db.select(
      "SELECT * FROM product_variants WHERE product_id = $1",
      [product.id]
    );
    setFormData({ ...product });
    setVariants(productVariants);
    setModalType("edit");
    setViewProduct(null);
  };

  const openViewModal = async (product) => {
    const db = await getDb();
    const productVariants = await db.select(
      "SELECT * FROM product_variants WHERE product_id = $1",
      [product.id]
    );
    setViewProduct({ ...product, variants: productVariants });
  };

  const closeModal = () => {
    setModalType(null);
    setViewProduct(null);
    setVariants([]);
    setShowQuickCat(false);
  };

  const handleAction = async (e) => {
    e.preventDefault();
    if (!formData.category)
      return showToast("يرجى اختيار أو إضافة فئة أولاً", "error");

    const db = await getDb();
    try {
      if (modalType === "add") {
        const res = await db.execute(
          `INSERT INTO products (name, category, cost_price, sale_price, season) VALUES ($1, $2, $3, $4, $5)`,
          [
            formData.name,
            formData.category,
            parseFloat(formData.cost_price),
            parseFloat(formData.sale_price),
            formData.season,
          ]
        );
        const productId = res.lastInsertId;
        for (const v of variants) {
          await db.execute(
            `INSERT INTO product_variants (product_id, color, size, stock, variant_barcode) VALUES ($1, $2, $3, $4, $5)`,
            [productId, v.color, v.size, parseInt(v.stock), v.variant_barcode]
          );
        }
        showToast("تم إضافة الموديل بنجاح", "success");
      } else if (modalType === "edit") {
        await db.execute(
          `UPDATE products SET name=$1, category=$2, cost_price=$3, sale_price=$4, season=$5 WHERE id=$6`,
          [
            formData.name,
            formData.category,
            parseFloat(formData.cost_price),
            parseFloat(formData.sale_price),
            formData.season,
            formData.id,
          ]
        );
        await db.execute("DELETE FROM product_variants WHERE product_id = $1", [
          formData.id,
        ]);
        for (const v of variants) {
          await db.execute(
            `INSERT INTO product_variants (product_id, color, size, stock, variant_barcode) VALUES ($1, $2, $3, $4, $5)`,
            [formData.id, v.color, v.size, parseInt(v.stock), v.variant_barcode]
          );
        }
        showToast("تم التحديث بنجاح", "success");
      }
      closeModal();
      fetchData();
    } catch (err) {
      showToast("خطأ في البيانات أو تكرار باركود", "error");
    }
  };

  const confirmDelete = async () => {
    const db = await getDb();
    try {
      await db.execute("DELETE FROM product_variants WHERE product_id = $1", [
        showDeleteConfirm.id,
      ]);
      await db.execute("DELETE FROM products WHERE id = $1", [
        showDeleteConfirm.id,
      ]);
      showToast("تم الحذف بنجاح", "success");
      fetchData();
    } catch (err) {
      showToast("فشل الحذف", "error");
    }
    setShowDeleteConfirm(null);
  };

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">
            المخزن المركزي{" "}
            <span className="count-badge">{filteredProducts.length}</span>
          </h2>
          <p className="sub-title">إدارة الموديلات وتوزيع المقاسات</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="بحث باسم الموديل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-save shadow-glow" onClick={openAddModal}>
            <Plus size={20} /> <span>إضافة موديل</span>
          </button>
        </div>
      </div>

      <div className="filter-bar-modern">
        <button
          className={`modern-chip ${filterCategory === "الكل" ? "active" : ""}`}
          onClick={() => setFilterCategory("الكل")}
        >
          الكل
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`modern-chip ${filterCategory === cat.name ? "active" : ""}`}
            onClick={() => setFilterCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="table-wrapper-premium shadow-glow">
        <table className="custom-table">
          <thead>
            <tr>
              <th>الموديل</th>
              <th>الفئة</th>
              <th>السعر (بيع/تكلفة)</th>
              <th>المخزون الكلي</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center p-10">
                  <Loader2 className="animate-spin inline-block ml-2" /> جاري
                  تحميل البيانات...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center p-10 text-muted">
                  لا توجد نتائج تطابق بحثك
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => (
                <tr key={prod.id} className="table-row">
                  <td>
                    <div className="model-info-premium">
                      <span className="model-primary-name">{prod.name}</span>
                      <span className="tag-season">{prod.season}</span>
                    </div>
                  </td>
                  <td>
                    <span className="tag-category-small">{prod.category}</span>
                  </td>
                  <td>
                    <div className="price-stack">
                      <span className="sale-text">{prod.sale_price} ج.م</span>
                      <span className="cost-text">
                        تكلفة: {prod.cost_price}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div
                      className={`stock-badge-modern ${prod.total_stock <= 5 ? "critical" : "ok"}`}
                    >
                      <div className="stock-dot"></div>
                      <span>{prod.total_stock || 0} قطعة</span>
                    </div>
                  </td>
                  <td className="actions-cell-premium">
                    <button
                      className="action-btn view"
                      onClick={() => openViewModal(prod)}
                      title="عرض بالتفصيل"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="action-btn edit"
                      onClick={() => openEditModal(prod)}
                      title="تعديل"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => setShowDeleteConfirm(prod)}
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalType && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target.className === "modal-overlay" && closeModal()
          }
        >
          <div className="modal-content-premium form-modal product-width animate-scale-up">
            <div className="modal-header">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Layers size={22} className="text-primary" />
                  <h3 style={{marginTop:'11px'}}>
                    {modalType === "add"
                      ? "إضافة موديل جديد للمخزن"
                      : "تعديل بيانات الموديل"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickCat(!showQuickCat)}
                  className="btn-save"
                  style={{ maxWidth: "20%" }}
                >
                  <FolderPlus size={12} /> فئة جديدة؟
                </button>
              </div>
            </div>

            <form onSubmit={handleAction} className="premium-form">
              <div className="form-grid-layout">
                <div className="input-group">
                  <label>اسم الموديل</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: طقم خروج أولادي شتوي"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                {/* اختيار الفئة مع إضافة سريعة */}
                <div className="input-group">
                  <label style={{ marginBottom: "10px" }}>الفئة</label>

                  {showQuickCat ? (
                    <div className="quick-add-box animate-slide-up">
                      <input
                        type="text"
                        placeholder="اسم الفئة..."
                        value={quickCatName}
                        onChange={(e) => setQuickCatName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddCategory}
                        className="btn-save-mini"
                      >
                        إضافة
                      </button>
                    </div>
                  ) : (
                    <select
                      className="premium-select"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      required
                    >
                      {categories.length === 0 && (
                        <option value="">لا يوجد فئات مضافة</option>
                      )}
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="input-group">
                  <label>الموسم</label>
                  <select
                    className="premium-select"
                    value={formData.season}
                    onChange={(e) =>
                      setFormData({ ...formData, season: e.target.value })
                    }
                  >
                    <option value="شتاء 2026">شتاء 2026</option>
                    <option value="صيف 2026">صيف 2026</option>
                    <option value="خريف 2026">خريف 2026</option>
                  </select>
                </div>

                <div className="input-group highlight-cost">
                  <label>سعر التكلفة</label>
                  <input
                    type="number"
                    required
                    value={formData.cost_price}
                    onChange={(e) =>
                      setFormData({ ...formData, cost_price: e.target.value })
                    }
                  />
                </div>
                <div className="input-group highlight-sale">
                  <label>سعر البيع</label>
                  <input
                    type="number"
                    required
                    value={formData.sale_price}
                    onChange={(e) =>
                      setFormData({ ...formData, sale_price: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="variants-editor-container">
                <div className="variants-header">
                  <div className="flex items-center gap-2">
                    <Palette size={18} />{" "}
                    <span>الألوان والمقاسات والباركود</span>
                  </div>
                  <button
                    type="button"
                    className="add-row-btn"
                    onClick={addVariantRow}
                  >
                    + إضافة مقاس/لون
                  </button>
                </div>
                <div className="variants-body custom-scrollbar">
                  {variants.map((v, index) => (
                    <div
                      key={index}
                      className="variant-row-premium animate-slide-up"
                    >
                      <input
                        placeholder="اللون"
                        value={v.color}
                        onChange={(e) =>
                          updateVariant(index, "color", e.target.value)
                        }
                        required
                      />
                      <input
                        placeholder="المقاس"
                        value={v.size}
                        onChange={(e) =>
                          updateVariant(index, "size", e.target.value)
                        }
                        required
                      />
                      <input
                        type="number"
                        placeholder="الكمية"
                        value={v.stock}
                        onChange={(e) =>
                          updateVariant(index, "stock", e.target.value)
                        }
                        required
                      />
                      <input
                        value={v.variant_barcode}
                        onChange={(e) =>
                          updateVariant(
                            index,
                            "variant_barcode",
                            e.target.value
                          )
                        }
                        required
                        className="barcode-input-style"
                      />
                      <button
                        type="button"
                        className="remove-row-btn"
                        onClick={() => removeVariantRow(index)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-save w-full">
                  حفظ الموديل بالكامل
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
{viewProduct && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content-premium view-modal" onClick={e => e.stopPropagation()}>
            <div className="view-header">
              <div className="view-title-box">
                <div className="view-icon-bg"><Package size={24} color="#60a5fa" /></div>
                <div>
                  <h3>{viewProduct.name}</h3>
                  <span className="tag-season-large">{viewProduct.season}</span>
                </div>
              </div>
              <button className="close-view-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="view-stats-grid">
              <div className="stat-card-mini"><span className="label">السعر (قطاعي)</span><span className="value text-success">{viewProduct.sale_price} ج.م</span></div>
              <div className="stat-card-mini"><span className="label">الفئة</span><span className="value">{viewProduct.category}</span></div>
              <div className="stat-card-mini"><span className="label">إجمالي القطع</span><span className="value text-primary">{viewProduct.total_stock || 0}</span></div>
            </div>

            <div className="variants-preview-section">
              <h4 className="section-subtitle">توزيع المخزون والباركود</h4>
              <div className="variants-grid-view">
                {viewProduct.variants?.map((v, idx) => (
                  <div key={idx} className="variant-card-modern">
                    <div className="card-top"><span className="v-color">{v.color}</span><span className="v-size">{v.size}</span></div>
                    <div className="card-bottom">
                      <div className="v-stock-box"><span className="v-stock">{v.stock}</span><span className="v-unit">قطعة</span></div>
                      <code className="v-barcode">{v.variant_barcode}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 25 }}>
              <button className="btn-save" onClick={() => openEditModal(viewProduct)}>تعديل البيانات</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content-premium form-modal" style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ padding: "20px 0" }}><XCircle size={50} color="#ef4444" /></div>
            <h3 style={{ color: "white" }}>حذف الموديل نهائياً؟</h3>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>سيتم مسح <strong>{showDeleteConfirm.name}</strong> وكل مقاساته.</p>
            <div className="modal-footer" style={{ justifyContent: "center", marginTop: 20 }}>
              <button className="btn-save" style={{ background: "#ef4444" }} onClick={confirmDelete}>نعم، احذف</button>
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
