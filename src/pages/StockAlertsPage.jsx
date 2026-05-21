import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  RefreshCw,
  Search,
  Edit3,
  Truck,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " قطعة";

const StockAlertsPage = ({ showToast }) => {
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minStock, setMinStock] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const productsRes = await db.select(`
        SELECT p.*, 
               COALESCE(SUM(pv.stock), 0) as total_stock,
               pv.id as variant_id, pv.color, pv.size, pv.stock as variant_stock,
               pv.variant_barcode
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        GROUP BY p.id
        ORDER BY total_stock ASC
      `);

      const variantsRes = await db.select(`
        SELECT pv.*, p.name as product_name
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.stock <= ?
        ORDER BY pv.stock ASC
      `, [minStock]);

      setProducts(productsRes);
      setVariants(variantsRes);
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل بيانات المخزون", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [minStock]);

  const lowStockProducts = products.filter(p => p.total_stock <= minStock);
  const outOfStock = products.filter(p => p.total_stock === 0);
  const filteredProducts = lowStockProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditProduct = (productId) => {
    window.location.href = `/products?edit=${productId}`;
  };

  const handleCreatePurchase = () => {
    window.location.href = "/purchases";
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return { label: "نفد بالكامل", color: "text-red-400", bg: "status-out", icon: <XCircle size={14} /> };
    if (stock <= minStock) return { label: "مخزون حرج", color: "text-amber-400", bg: "status-critical", icon: <AlertTriangle size={14} /> };
    return { label: "مخزون جيد", color: "text-green-400", bg: "status-good", icon: <CheckCircle2 size={14} /> };
  };

  const toggleExpand = (productId) => {
    setExpandedProduct(expandedProduct === productId ? null : productId);
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
        .premium-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .premium-stat-card {
          position: relative;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 18px 20px;
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
        .card-critical .stat-glow { background: #f97316; }
        .card-out .stat-glow { background: #ef4444; }
        .card-total .stat-glow { background: #3b82f6; }
        .stat-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          z-index: 1;
        }
        .stat-left { flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
        .stat-value { font-size: 22px; font-weight: 700; color: #f8fafc; }
        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-critical .stat-icon { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .card-out .stat-icon { color: #f87171; background: rgba(239,68,68,0.1); }
        .card-total .stat-icon { color: #60a5fa; background: rgba(59,130,246,0.1); }
        
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
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .hero-icon {
          background: linear-gradient(135deg, #f97316, #ea580c);
          padding: 12px;
          border-radius: 16px;
          box-shadow: 0 0 20px rgba(249, 115, 22, 0.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 16px;
        }
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .search-neon-wrapper { position: relative; }
        .search-neon-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 11px 42px 11px 16px;
          width: 280px;
          color: #f1f5f9;
          font-size: 13.5px;
          transition: all 0.25s ease;
        }
        .search-neon-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
          outline: none;
        }
        .btn-action-neon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .btn-primary { background: #2563eb; color: #ffffff; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .btn-secondary { background: #1e293b; color: #94a3b8; }
        .btn-secondary:hover { background: #334155; color: white; }
        .btn-success {
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          color: #34d399;
        }
        .btn-success:hover {
          background: rgba(16,185,129,0.2);
          border-color: #10b981;
          color: white;
          box-shadow: 0 0 12px rgba(16,185,129,0.2);
        }
        .threshold-control {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0b0f19;
          padding: 6px 16px;
          border-radius: 40px;
        }
        .threshold-control span { font-size: 13px; color: #94a3b8; }
        .threshold-control input {
          background: transparent;
          border: none;
          color: white;
          width: 60px;
          text-align: center;
          outline: none;
          font-weight: 600;
        }
        
        .products-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .product-card {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.2s;
        }
        .product-card:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(30,41,59,0.5);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          cursor: pointer;
        }
        .product-info { flex: 2; }
        .product-name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .product-name { font-size: 16px; font-weight: 700; color: #f1f5f9; }
        .product-barcode {
          font-size: 11px;
          font-family: monospace;
          background: rgba(0,0,0,0.3);
          padding: 2px 8px;
          border-radius: 6px;
          color: #64748b;
        }
        .product-category { font-size: 12px; color: #64748b; margin-top: 4px; }
        .product-stats {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .stock-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 30px;
        }
        .status-out { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }
        .status-critical { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); color: #fbbf24; }
        .status-good { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #34d399; }
        .stock-amount { text-align: center; min-width: 80px; }
        .stock-value { font-size: 20px; font-weight: 800; color: white; }
        .stock-unit { font-size: 11px; color: #64748b; margin-right: 4px; }
        .expand-btn-icon {
          color: #64748b;
          transition: transform 0.2s;
          display: flex;
          align-items: center;
        }
        .expand-btn-icon.rotated { transform: rotate(180deg); color: #60a5fa; }
        
        .card-details {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 20px 24px;
          background: rgba(0,0,0,0.2);
        }
        .details-inner-title {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 14px;
          letter-spacing: 0.5px;
        }
        .variants-table-wrapper {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          overflow: hidden;
          margin-bottom: 20px;
        }
        .variants-table-header {
          display: grid;
          grid-template-columns: 1.5fr 1.5fr 2fr 3fr;
          gap: 12px;
          padding: 10px 16px;
          background: rgba(15,23,42,0.6);
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .variant-row {
          display: grid;
          grid-template-columns: 1.5fr 1.5fr 2fr 3fr;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          font-size: 13px;
        }
        .variant-row:last-child { border-bottom: none; }
        .v-dim { color: #cbd5e1; }
        .barcode { font-size: 11px; color: #60a5fa; font-family: monospace; }
        .no-variants-alert {
          background: rgba(0,0,0,0.2);
          padding: 12px;
          border-radius: 10px;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 20px;
        }
        .card-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .btn-edit, .btn-order {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .btn-edit { color: #60a5fa; }
        .btn-edit:hover { background: rgba(59,130,246,0.1); border-color: #3b82f6; }
        .btn-order { color: #34d399; }
        .btn-order:hover { background: rgba(16,185,129,0.1); border-color: #10b981; }
        
        .empty-state {
          text-align: center;
          padding: 60px;
          background: rgba(0,0,0,0.2);
          border-radius: 20px;
          border: 1px dashed rgba(255,255,255,0.1);
        }
        .empty-icon-wrap {
          display: inline-flex;
          padding: 14px;
          background: rgba(16,185,129,0.1);
          color: #10b981;
          border-radius: 50%;
          margin-bottom: 16px;
        }
        .empty-state h3 { font-size: 16px; margin: 0 0 8px; color: white; }
        .empty-state p { font-size: 13px; color: #64748b; margin: 0; }
        
        .loading-container {
          text-align: center;
          padding: 80px;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .font-numeric { font-variant-numeric: tabular-nums; }
      `}</style>

      {/* Header with Hero */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="hero-icon"><AlertTriangle size={28} /></div>
            <div>
              <h2 className="main-title">مراقبة نواقص المخزون</h2>
              <p className="sub-title">متابعة فورية للمستويات الحرجة، النواقص، وإدارة طلبات التوريد العاجلة</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="البحث السريع باسم المنتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
              style={{ width: 260 }}
            />
            <Search size={15} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <div className="threshold-control">
            <span>حد التنبيه الأدنى:</span>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            تحديث
          </button>
          <button className="btn-action-neon btn-success" onClick={handleCreatePurchase}>
            <Truck size={16} />
            طلب مشتريات
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-critical">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">منتج حرج</div>
              <div className="stat-value">{lowStockProducts.length}</div>
            </div>
            <div className="stat-icon"><AlertTriangle size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-out">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">نافد تماماً</div>
              <div className="stat-value">{outOfStock.length}</div>
            </div>
            <div className="stat-icon"><XCircle size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-total">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المواد</div>
              <div className="stat-value">{products.length}</div>
            </div>
            <div className="stat-icon"><Package size={20} /></div>
          </div>
        </div>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="loading-container">
          <Loader2 size={36} className="spin" style={{ color: "#60a5fa" }} />
          <p>جاري مسح مستويات المخزون الحالية...</p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap"><CheckCircle2 size={40} /></div>
              <h3>المخزن في حالة مثالية</h3>
              <p>مستويات جميع المنتجات الحالية تخطت حد الأمان الأدنى بنجاح.</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const stock = product.total_stock;
              const status = getStockStatus(stock);
              const isExpanded = expandedProduct === product.id;
              const productVariants = variants.filter(v => v.product_id === product.id);
              return (
                <div key={product.id} className={`product-card ${isExpanded ? 'card-expanded' : ''}`}>
                  <div className="card-header" onClick={() => toggleExpand(product.id)}>
                    <div className="product-info">
                      <div className="product-name-row">
                        <span className="product-name">{product.name}</span>
                        {product.barcode && <span className="product-barcode">{product.barcode}</span>}
                      </div>
                      <div className="product-category">{product.category || "عام / غير مصنف"}</div>
                    </div>
                    <div className="product-stats">
                      <div className={`stock-status-badge ${status.bg}`}>
                        {status.icon}
                        <span>{status.label}</span>
                      </div>
                      <div className="stock-amount">
                        <span className="stock-value font-numeric">{stock}</span>
                        <span className="stock-unit">قطعة</span>
                      </div>
                      <div className={`expand-btn-icon ${isExpanded ? 'rotated' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="card-details">
                      <div className="details-inner-title">تفكيك المتغيرات وأنظمة الألوان والمقاسات</div>
                      {productVariants.length > 0 ? (
                        <div className="variants-table-wrapper">
                          <div className="variants-table-header">
                            <span>اللون</span>
                            <span>المقاس</span>
                            <span>الرصيد المتبقي</span>
                            <span>رمز الباركود</span>
                          </div>
                          <div className="variants-table-body">
                            {productVariants.map((v) => (
                              <div key={v.id} className="variant-row">
                                <span className="v-dim">{v.color || "—"}</span>
                                <span className="v-dim">{v.size || "—"}</span>
                                <span className={`font-numeric font-semibold ${v.stock === 0 ? "text-red-400" : v.stock <= minStock ? "text-amber-400" : "text-green-400"}`}>
                                  {v.stock} قطعة
                                </span>
                                <span className="barcode">{v.variant_barcode || "—"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="no-variants-alert">لا توجد متغيرات مسجلة لهذا المنتج، يتم التعامل مع القطعة كعنصر فريد ومستقل.</div>
                      )}
                      <div className="card-actions">
                        <button className="btn-edit" onClick={(e) => { e.stopPropagation(); handleEditProduct(product.id); }}>
                          <Edit3 size={14} />
                          <span>تعديل المنتج</span>
                        </button>
                        <button className="btn-order" onClick={(e) => { e.stopPropagation(); handleCreatePurchase(); }}>
                          <ShoppingCart size={14} />
                          <span>طلب توريد</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default StockAlertsPage;