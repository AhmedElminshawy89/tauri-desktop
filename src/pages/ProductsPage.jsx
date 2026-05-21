import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Loader2,
  FolderPlus,
  Printer,
} from "lucide-react";

const ProductsPage = ({ showToast }) => {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("الكل");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showQuickCat, setShowQuickCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");

  // Print modal state
  const [printModal, setPrintModal] = useState(null);
  const [printVariantIdx, setPrintVariantIdx] = useState(0);
  const [printCopies, setPrintCopies] = useState(1);

  const [formData, setFormData] = useState({
    id: null,
    name: "",
    category: "",
    cost_price: "",
    sale_price: "",
    season: "شتاء 2026",
  });

  const [variants, setVariants] = useState([]);

  const fetchData = async () => {
    try {
      const db = await getDb();
      const cats = await db.select("SELECT * FROM categories ORDER BY name ASC");
      setCategories(cats);
      const result = await db.select(`
        SELECT p.*, 
        (SELECT SUM(stock) FROM product_variants WHERE product_id = p.id) as total_stock 
        FROM products p ORDER BY id DESC
      `);
      setProducts(result);
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

  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      const db = await getDb();
      await db.execute("INSERT INTO categories (name) VALUES ($1)", [quickCatName.trim()]);
      const updatedCats = await db.select("SELECT * FROM categories ORDER BY name ASC");
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
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === "الكل" || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, filterCategory, products]);

  const addVariantRow = () => {
    const autoBarcode = "V" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
    setVariants([...variants, { color: "", size: "", stock: "", variant_barcode: autoBarcode }]);
  };

  const removeVariantRow = (index) => setVariants(variants.filter((_, i) => i !== index));

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
      { color: "", size: "", stock: "", variant_barcode: "V" + Date.now().toString().slice(-6) },
    ]);
    setModalType("add");
  };

  const openEditModal = async (product) => {
    const db = await getDb();
    const productVariants = await db.select("SELECT * FROM product_variants WHERE product_id = $1", [product.id]);
    setFormData({ ...product });
    setVariants(productVariants);
    setModalType("edit");
    setViewProduct(null);
  };

  const openViewModal = async (product) => {
    const db = await getDb();
    const productVariants = await db.select("SELECT * FROM product_variants WHERE product_id = $1", [product.id]);
    setViewProduct({ ...product, variants: productVariants });
  };

  const closeModal = () => {
    setModalType(null);
    setViewProduct(null);
    setVariants([]);
    setShowQuickCat(false);
  };

  const handleOpenPrintModal = async (product) => {
    try {
      const db = await getDb();
      const productVariants = await db.select(
        "SELECT * FROM product_variants WHERE product_id = $1",
        [product.id]
      );
      if (!productVariants || productVariants.length === 0) {
        showToast("لا توجد مقاسات لهذا الموديل", "error");
        return;
      }
      setPrintModal({ product, variants: productVariants });
      setPrintVariantIdx(0);
      setPrintCopies(1);
    } catch (err) {
      showToast("خطأ في جلب بيانات المقاسات", "error");
    }
  };

  const handleGoToPrint = () => {
    const variant = printModal.variants[printVariantIdx];
    const payload = {
      product: {
        id: variant.id,
        name: printModal.product.name,
        size: variant.size,
        color: variant.color,
        barcode: variant.variant_barcode,
        sale_price: printModal.product.sale_price,
      },
      copies: printCopies,
    };
    localStorage.setItem("barcode_print_payload", JSON.stringify(payload));
    setPrintModal(null);
    navigate("/barcode");
  };

  const handleAction = async (e) => {
    e.preventDefault();
    if (!formData.category) return showToast("يرجى اختيار أو إضافة فئة أولاً", "error");
    const db = await getDb();
    try {
      if (modalType === "add") {
        const res = await db.execute(
          `INSERT INTO products (name, category, cost_price, sale_price, season) VALUES ($1, $2, $3, $4, $5)`,
          [formData.name, formData.category, parseFloat(formData.cost_price), parseFloat(formData.sale_price), formData.season]
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
          [formData.name, formData.category, parseFloat(formData.cost_price), parseFloat(formData.sale_price), formData.season, formData.id]
        );
        await db.execute("DELETE FROM product_variants WHERE product_id = $1", [formData.id]);
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
      await db.execute("DELETE FROM product_variants WHERE product_id = $1", [showDeleteConfirm.id]);
      await db.execute("DELETE FROM products WHERE id = $1", [showDeleteConfirm.id]);
      showToast("تم الحذف بنجاح", "success");
      fetchData();
    } catch (err) {
      showToast("فشل الحذف", "error");
    }
    setShowDeleteConfirm(null);
  };

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        .page-container {
          padding: 24px;
          background: transparent;
          min-height: 100vh;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .premium-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .premium-stat-card {
          position: relative;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 20px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-stat-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 12px 24px -10px rgba(0,0,0,0.6);
        }
        .stat-glow {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          top: -20px;
          right: -20px;
          filter: blur(40px);
          opacity: 0.15;
          transition: opacity 0.3s ease;
        }
        .premium-stat-card:hover .stat-glow { opacity: 0.3; }
        .card-blue .stat-glow { background: #3b82f6; }
        .card-emerald .stat-glow { background: #10b981; }
        .card-amber .stat-glow { background: #f59e0b; }
        .stat-content { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
        .icon-box {
          width: 48px; height: 48px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-emerald .icon-box { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .stat-details { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }

        .page-header-container {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px; padding: 20px 28px;
          background: rgba(30, 41, 59, 0.3); border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(8px);
        }
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .header-actions { display: flex; gap: 12px; align-items: center; }
        .search-box {
          position: relative; display: flex; align-items: center;
          background: #0b0f19; border: 1px solid #1e293b;
          border-radius: 12px; padding: 0 15px;
          transition: all 0.3s ease; width: 260px;
        }
        .search-box:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
        .search-box input {
          border: none; background: transparent; padding: 11px 5px;
          width: 100%; outline: none; font-size: 13.5px; color: #f1f5f9;
        }
        .btn-action-neon {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 20px; border-radius: 12px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: all 0.2s ease; border: none;
        }
        .btn-primary { background: #2563eb; color: #ffffff; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .btn-secondary { background: #1e293b; color: #94a3b8; }
        .btn-secondary:hover { background: #334155; color: white; }

        .filter-bar-modern {
          display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px;
          padding: 8px 16px; background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px); border-radius: 60px;
        }
        .modern-chip {
          padding: 6px 18px; border-radius: 40px;
          background: rgba(255,255,255,0.03); color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.08); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .modern-chip:hover { background: rgba(59,130,246,0.1); color: #60a5fa; border-color: #3b82f6; }
        .modern-chip.active { background: #3b82f6; color: white; border-color: #3b82f6; }

        .cyber-table-container {
          background: rgba(15, 23, 42, 0.3); border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: right; }
        .cyber-table th {
          background: rgba(15, 23, 42, 0.8); padding: 16px; font-size: 13px;
          font-weight: 600; color: #94a3b8; border-bottom: 1px solid #1e293b;
        }
        .cyber-table td { padding: 14px 16px; border-bottom: 1px solid rgba(30,41,59,0.5); }
        .cyber-row-main:hover { background: rgba(30, 41, 59, 0.3); }

        .model-info-premium { display: flex; flex-direction: column; gap: 4px; }
        .model-primary-name { font-weight: 600; color: #f8fafc; font-size: 15px; }
        .tag-season {
          background: rgba(96,165,250,0.15); color: #60a5fa; font-size: 11px;
          padding: 2px 8px; border-radius: 4px; display: inline-block; width: fit-content;
        }
        .tag-category-small {
          background: rgba(16,185,129,0.1); color: #34d399;
          padding: 2px 8px; border-radius: 4px; font-size: 12px;
        }
        .price-stack { display: flex; flex-direction: column; gap: 2px; }
        .sale-text { font-weight: 700; color: #34d399; }
        .cost-text { font-size: 11px; color: #64748b; }
        .stock-badge-modern {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 30px; font-size: 12px; font-weight: 600;
        }
        .stock-badge-modern.ok { background: rgba(16,185,129,0.1); color: #34d399; }
        .stock-badge-modern.critical { background: rgba(239,68,68,0.1); color: #f87171; }
        .stock-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .action-btn {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08);
          width: 32px; height: 32px; border-radius: 8px; display: inline-flex;
          align-items: center; justify-content: center; cursor: pointer;
          color: #94a3b8; transition: all 0.2s;
        }
        .action-btn.view:hover { color: #60a5fa; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .action-btn.edit:hover { color: #fbbf24; border-color: #fbbf24; background: rgba(251,191,36,0.1); }
        .action-btn.delete:hover { color: #f87171; border-color: #ef4444; background: rgba(239,68,68,0.1); }
        .action-btn.print:hover { color: #a78bfa; border-color: #7c3aed; background: rgba(124,58,237,0.1); }

        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.75); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .modal-content-premium {
          background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px; width: 100%; max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); overflow: hidden;
        }
        .product-width { max-width: 850px !important; }
        .view-modal { max-width: 700px !important; }
        .modal-header {
          padding: 18px 24px; background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; justify-content: space-between; align-items: center;
        }
        .premium-form { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .form-grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: 13px; color: #94a3b8; }
        .input-group input, .input-group select {
          background: #070a12; border: 1px solid #1e293b;
          border-radius: 10px; padding: 10px 12px; color: white; font-size: 14px;
        }
        .input-group input:focus, .input-group select:focus { border-color: #2563eb; outline: none; }
        .variants-editor-container {
          margin-top: 8px; background: rgba(0,0,0,0.2); border-radius: 16px; padding: 16px;
        }
        .variants-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .add-row-btn {
          background: rgba(59,130,246,0.15); border: 1px dashed rgba(96,165,250,0.5);
          color: #60a5fa; padding: 6px 15px; border-radius: 8px; font-size: 12px; cursor: pointer;
        }
        .variant-row-premium {
          display: grid; grid-template-columns: 1fr 1fr 0.8fr 1.5fr 40px;
          gap: 12px; margin-bottom: 12px; align-items: center;
        }
        .variant-row-premium input {
          background: #070a12; border: 1px solid #1e293b;
          border-radius: 8px; padding: 8px 10px; color: white; font-size: 13px;
        }
        .remove-row-btn {
          background: rgba(239,68,68,0.1); color: #f87171;
          border: 1px solid rgba(239,68,68,0.2); width: 32px; height: 32px;
          border-radius: 8px; display: flex; align-items: center;
          justify-content: center; cursor: pointer;
        }
        .modal-footer {
          display: flex; gap: 12px; padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .btn-save {
          flex: 1; padding: 12px; border-radius: 10px; background: #2563eb;
          color: white; font-weight: 600; border: none; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-cancel {
          padding: 12px 20px; border-radius: 10px; background: #1e293b;
          color: #94a3b8; font-weight: 600; border: none; cursor: pointer;
        }
        .w-full { width: 100%; }

        /* Print modal specific */
        .print-variant-option {
          display: flex; flex-direction: column; gap: 4px;
          padding: 12px; border-radius: 10px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02); transition: all 0.2s;
          margin-bottom: 8px;
        }
        .print-variant-option:hover { border-color: #7c3aed; background: rgba(124,58,237,0.08); }
        .print-variant-option.selected { border-color: #7c3aed; background: rgba(124,58,237,0.15); }

        /* View modal */
        .view-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .view-title-box { display: flex; gap: 12px; align-items: center; }
        .view-icon-bg { background: rgba(96,165,250,0.1); padding: 10px; border-radius: 12px; }
        .close-view-btn { background: none; border: none; color: #64748b; cursor: pointer; font-size: 20px; }
        .view-stats-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px; padding: 20px 24px; background: rgba(0,0,0,0.1);
        }
        .stat-card-mini { background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; text-align: center; }
        .stat-card-mini .label { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px; }
        .stat-card-mini .value { font-weight: bold; font-size: 16px; }
        .text-success { color: #34d399; }
        .variants-preview-section { padding: 0 24px 20px; }
        .variants-grid-view {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px; max-height: 300px; overflow-y: auto;
        }
        .variant-card-modern {
          background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 10px;
        }
        .card-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .v-color { color: white; font-size: 14px; }
        .v-size { color: #60a5fa; font-weight: bold; }
        .card-bottom { margin-top: 6px; }
        .v-stock-box { display: flex; gap: 4px; align-items: baseline; }
        .v-stock { font-size: 18px; font-weight: bold; color: white; }
        .v-unit { font-size: 11px; color: #64748b; }
        .v-barcode { font-size: 11px; color: #a78bfa; font-family: monospace; margin-top: 4px; display: block; }

        /* Copies stepper */
        .copies-stepper { display: flex; align-items: center; gap: 12px; }
        .stepper-btn {
          width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04); color: #94a3b8; font-size: 20px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .stepper-btn:hover { border-color: #7c3aed; color: #a78bfa; background: rgba(124,58,237,0.1); }
        .copies-input {
          width: 70px; text-align: center; background: #070a12;
          border: 1px solid #1e293b; border-radius: 10px; padding: 8px;
          color: white; font-size: 18px; font-weight: bold;
        }

        /* Animations */
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-scale-up { animation: scaleUp 0.2s ease-out; }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .text-center { text-align: center; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">
            المخزن المركزي{" "}
            <span
              className="count-badge"
              style={{ background: "#3b82f6", padding: "2px 8px", borderRadius: "20px", fontSize: "14px", marginRight: "8px" }}
            >
              {filteredProducts.length}
            </span>
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
          <button className="btn-action-neon btn-primary" onClick={openAddModal}>
            <Plus size={18} /> إضافة موديل
          </button>
        </div>
      </div>

      {/* Filter Bar */}
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

      {/* Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
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
                <td colSpan="5" className="text-center" style={{ padding: "40px", color: "#94a3b8" }}>
                  <Loader2 className="spin" style={{ display: "inline-block", marginLeft: "8px" }} />
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center" style={{ padding: "40px", color: "#64748b" }}>
                  لا توجد نتائج تطابق بحثك
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => (
                <tr key={prod.id} className="cyber-row-main">
                  <td>
                    <div className="model-info-premium">
                      <span className="model-primary-name">{prod.name}</span>
                      <span className="tag-season">{prod.season}</span>
                    </div>
                  </td>
                  <td><span className="tag-category-small">{prod.category}</span></td>
                  <td>
                    <div className="price-stack">
                      <span className="sale-text">{prod.sale_price} ج.م</span>
                      <span className="cost-text">تكلفة: {prod.cost_price}</span>
                    </div>
                  </td>
                  <td>
                    <div className={`stock-badge-modern ${(prod.total_stock || 0) <= 5 ? "critical" : "ok"}`}>
                      <div className="stock-dot"></div>
                      <span>{prod.total_stock || 0} قطعة</span>
                    </div>
                  </td>
                  <td style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <button className="action-btn view" title="عرض" onClick={() => openViewModal(prod)}>
                      <Eye size={16} />
                    </button>
                    <button className="action-btn edit" title="تعديل" onClick={() => openEditModal(prod)}>
                      <Edit3 size={16} />
                    </button>
                    <button className="action-btn print" title="طباعة باركود" onClick={() => handleOpenPrintModal(prod)}>
                      <Printer size={16} />
                    </button>
                    <button className="action-btn delete" title="حذف" onClick={() => setShowDeleteConfirm(prod)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══ Add/Edit Modal ══ */}
      {modalType && (
        <div className="modal-overlay" onClick={(e) => e.target.className === "modal-overlay" && closeModal()}>
          <div className="modal-content-premium product-width animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Layers size={20} style={{ color: "#60a5fa" }} />
                  <h3 style={{ margin: 0 }}>{modalType === "add" ? "إضافة موديل جديد" : "تعديل الموديل"}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickCat(!showQuickCat)}
                  className="btn-action-neon btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  <FolderPlus size={14} /> فئة جديدة
                </button>
              </div>
            </div>
            <form onSubmit={handleAction} className="premium-form">
              <div className="form-grid-layout">
                <div className="input-group">
                  <label>اسم الموديل</label>
                  <input
                    type="text" required
                    placeholder="مثلاً: طقم خروج أولادي شتوي"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>الفئة</label>
                  {showQuickCat ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text" placeholder="اسم الفئة..."
                        value={quickCatName}
                        onChange={(e) => setQuickCatName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-action-neon btn-primary"
                        style={{ padding: "6px 12px" }}
                        onClick={handleQuickAddCategory}
                      >
                        إضافة
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="input-group">
                  <label>الموسم</label>
                  <select
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                  >
                    <option value="شتاء 2026">شتاء 2026</option>
                    <option value="صيف 2026">صيف 2026</option>
                    <option value="خريف 2026">خريف 2026</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>سعر التكلفة</label>
                  <input
                    type="number" required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>سعر البيع</label>
                  <input
                    type="number" required
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  />
                </div>
              </div>

              <div className="variants-editor-container">
                <div className="variants-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Palette size={16} /> <span>الألوان والمقاسات</span>
                  </div>
                  <button type="button" className="add-row-btn" onClick={addVariantRow}>
                    + إضافة مقاس/لون
                  </button>
                </div>
                <div className="variants-body">
                  {variants.map((v, index) => (
                    <div key={index} className="variant-row-premium">
                      <input placeholder="اللون" value={v.color} onChange={(e) => updateVariant(index, "color", e.target.value)} required />
                      <input placeholder="المقاس" value={v.size} onChange={(e) => updateVariant(index, "size", e.target.value)} required />
                      <input type="number" placeholder="الكمية" value={v.stock} onChange={(e) => updateVariant(index, "stock", e.target.value)} required />
                      <input value={v.variant_barcode} onChange={(e) => updateVariant(index, "variant_barcode", e.target.value)} required placeholder="باركود" />
                      <button type="button" className="remove-row-btn" onClick={() => removeVariantRow(index)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-save w-full">حفظ الموديل</button>
                <button type="button" className="btn-cancel" onClick={closeModal}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ View Modal ══ */}
      {viewProduct && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content-premium view-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="view-header">
              <div className="view-title-box">
                <div className="view-icon-bg"><Package size={22} color="#60a5fa" /></div>
                <div>
                  <h3 style={{ margin: 0 }}>{viewProduct.name}</h3>
                  <span className="tag-season" style={{ marginTop: "4px" }}>{viewProduct.season}</span>
                </div>
              </div>
              <button className="close-view-btn" onClick={closeModal}>✕</button>
            </div>
            <div className="view-stats-grid">
              <div className="stat-card-mini">
                <span className="label">سعر البيع</span>
                <span className="value text-success">{viewProduct.sale_price} ج.م</span>
              </div>
              <div className="stat-card-mini">
                <span className="label">الفئة</span>
                <span className="value">{viewProduct.category}</span>
              </div>
              <div className="stat-card-mini">
                <span className="label">إجمالي القطع</span>
                <span className="value">{viewProduct.total_stock || 0}</span>
              </div>
            </div>
            <div className="variants-preview-section">
              <h4 style={{ marginBottom: "12px", color: "#60a5fa", fontSize: "13px" }}>توزيع المخزون</h4>
              <div className="variants-grid-view">
                {viewProduct.variants?.map((v, idx) => (
                  <div key={idx} className="variant-card-modern">
                    <div className="card-top">
                      <span className="v-color">{v.color}</span>
                      <span className="v-size">{v.size}</span>
                    </div>
                    <div className="card-bottom">
                      <div className="v-stock-box">
                        <span className="v-stock">{v.stock}</span>
                        <span className="v-unit">قطعة</span>
                      </div>
                      <code className="v-barcode">{v.variant_barcode}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-save" onClick={() => openEditModal(viewProduct)}>تعديل البيانات</button>
              <button className="btn-cancel" onClick={closeModal}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Print Modal ══ */}
      {printModal && (
        <div className="modal-overlay" onClick={() => setPrintModal(null)}>
          <div
            className="modal-content-premium animate-scale-up"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Printer size={20} style={{ color: "#a78bfa" }} />
                <div>
                  <h3 style={{ margin: 0 }}>طباعة باركود</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{printModal.product.name}</p>
                </div>
              </div>
            </div>

            <div className="premium-form">
              {/* Variant selector */}
              <div className="input-group">
                <label>اختر المقاس / اللون</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {printModal.variants.map((v, i) => (
                    <div
                      key={i}
                      className={`print-variant-option ${printVariantIdx === i ? "selected" : ""}`}
                      onClick={() => setPrintVariantIdx(i)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "600", color: "#f1f5f9" }}>
                          {v.color} — {v.size}
                        </span>
                        {printVariantIdx === i && (
                          <span style={{ color: "#a78bfa", fontSize: "12px" }}>✓ محدد</span>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                        {v.variant_barcode}
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        المخزون: {v.stock} قطعة
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copies stepper */}
              <div className="input-group">
                <label>عدد النسخ</label>
                <div className="copies-stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                  >
                    −
                  </button>
                  <input
                    type="number" min="1" max="100"
                    className="copies-input"
                    value={printCopies}
                    onChange={(e) => setPrintCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setPrintCopies(Math.min(100, printCopies + 1))}
                  >
                    +
                  </button>
                  <span style={{ color: "#64748b", fontSize: "13px" }}>نسخة</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-save" style={{ background: "#7c3aed" }} onClick={handleGoToPrint}>
                <Printer size={16} /> انتقال للطباعة
              </button>
              <button className="btn-cancel" onClick={() => setPrintModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete Confirmation ══ */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div
            className="modal-content-premium"
            style={{ maxWidth: "420px", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 0 0" }}>
              <XCircle size={50} color="#f87171" />
            </div>
            <h3 style={{ marginTop: "12px" }}>حذف الموديل نهائياً؟</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>
              سيتم مسح <strong>{showDeleteConfirm.name}</strong> وكل مقاساته.
            </p>
            <div className="modal-footer" style={{ justifyContent: "center" }}>
              <button className="btn-save" style={{ background: "#ef4444" }} onClick={confirmDelete}>
                نعم، احذف
              </button>
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;


