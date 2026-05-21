import React, { useState, useEffect, Fragment } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  TrendingUp,
  Package,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  Layers,
  FileText,
  User,
  Clock,
  ShoppingCart,
  DollarSign
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const fmtCurrency = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const TopSellingPage = ({ showToast }) => {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [topProducts, setTopProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [summary, setSummary] = useState({ totalQuantity: 0, totalRevenue: 0, productCount: 0 });
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [productInvoices, setProductInvoices] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState({});

  const fetchTopSelling = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const db = await getDb();
      const catFilter = selectedCategory !== "all" ? "AND p.category = ?" : "";
      const params = [startDate, endDate];
      if (selectedCategory !== "all") params.push(selectedCategory);

      const rows = await db.select(
        `SELECT 
          p.id,
          p.name,
          p.category,
          COALESCE(SUM(ii.quantity), 0) as total_quantity,
          COALESCE(SUM(ii.total_price), 0) as total_revenue
         FROM products p
         LEFT JOIN invoice_items ii ON ii.product_id = p.id
         LEFT JOIN invoices i ON ii.invoice_id = i.id
         WHERE i.created_at >= date(?) AND i.created_at <= date(?) AND i.status = 'completed'
         ${catFilter}
         GROUP BY p.id
         ORDER BY total_quantity DESC
         LIMIT 50`,
        params
      );

      setTopProducts(rows || []);
      const totalQuantity = rows.reduce((s, r) => s + r.total_quantity, 0);
      const totalRevenue = rows.reduce((s, r) => s + r.total_revenue, 0);
      const productCount = rows.length;
      setSummary({ totalQuantity, totalRevenue, productCount });
      setExpandedProduct(null);
      setProductInvoices({});
      setLoadingInvoices({});
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const db = await getDb();
      const cats = await db.select("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category");
      setCategories(cats.map(c => c.category));
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    fetchTopSelling();
  }, [startDate, endDate, selectedCategory]);

  const fetchProductInvoices = async (productId) => {
    if (productInvoices[productId]) return;
    setLoadingInvoices(prev => ({ ...prev, [productId]: true }));
    try {
      const db = await getDb();
      const invoices = await db.select(
        `SELECT 
          i.id,
          i.invoice_number,
          i.customer_name,
          i.created_at,
          ii.quantity,
          ii.total_price
         FROM invoices i
         JOIN invoice_items ii ON ii.invoice_id = i.id
         WHERE ii.product_id = ? 
           AND i.created_at >= date(?) AND i.created_at <= date(?) 
           AND i.status = 'completed'
         ORDER BY i.created_at DESC`,
        [productId, startDate, endDate]
      );
      setProductInvoices(prev => ({ ...prev, [productId]: invoices }));
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل فواتير المنتج", "error");
    } finally {
      setLoadingInvoices(prev => ({ ...prev, [productId]: false }));
    }
  };

  const toggleExpand = (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
    } else {
      setExpandedProduct(productId);
      if (!productInvoices[productId]) {
        fetchProductInvoices(productId);
      }
    }
  };

  const filteredProducts = topProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        .card-quantity .stat-glow { background: #10b981; }
        .card-revenue .stat-glow { background: #3b82f6; }
        .card-count .stat-glow { background: #f59e0b; }
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
        .card-quantity .stat-icon { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-revenue .stat-icon { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-count .stat-icon { color: #fbbf24; background: rgba(245,158,11,0.1); }
        
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
          flex-wrap: wrap;
          gap: 16px;
        }
        .hero-icon {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          padding: 12px;
          border-radius: 16px;
          box-shadow: 0 0 20px rgba(59,130,246,0.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 16px;
        }
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
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
        .threshold-control {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0b0f19;
          padding: 6px 16px;
          border-radius: 40px;
        }
        .date-range-group {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0b0f19;
          padding: 6px 16px;
          border-radius: 40px;
        }
        .date-picker { display: flex; align-items: center; gap: 6px; }
        .date-picker input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-size: 13px;
        }
        .date-sep { color: #64748b; font-size: 12px; }
        .select-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0b0f19;
          padding: 6px 16px;
          border-radius: 40px;
        }
        .select-wrapper select {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-size: 13px;
        }
        
        .cyber-table-container {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .cyber-table {
          width: 100%;
          border-collapse: collapse;
          text-align: right;
        }
        .cyber-table th {
          background: rgba(15, 23, 42, 0.8);
          padding: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
        }
        .cyber-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .cyber-row-main:hover { background: rgba(30, 41, 59, 0.3); }
        .product-row { cursor: pointer; }
        .product-row.active { background: rgba(59,130,246,0.08); }
        .expand-cell { text-align: center; color: #64748b; width: 40px; }
        .arrow-icon { transition: transform 0.2s; display: inline-flex; }
        .arrow-icon.rotated { transform: rotate(-90deg); color: #60a5fa; }
        .rank-cell { width: 70px; }
        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8;
        }
        .rank-badge.top-1 { background: rgba(251,191,36,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.3); }
        .rank-badge.top-2 { background: rgba(203,213,225,0.15); color: #e2e8f0; border-color: rgba(203,213,225,0.3); }
        .rank-badge.top-3 { background: rgba(245,158,11,0.15); color: #f59e0b; border-color: rgba(245,158,11,0.3); }
        .product-name { font-weight: 600; color: #f1f5f9; }
        .category-badge {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          color: #94a3b8;
        }
        .quantity-value { font-weight: 700; color: #34d399; font-size: 16px; }
        .unit-label { font-size: 11px; color: #64748b; margin-right: 2px; }
        .revenue-value { font-weight: 700; color: #60a5fa; font-size: 16px; }
        .empty-row { text-align: center; padding: 50px !important; color: #64748b; }
        
        .expandable-row { background: rgba(0,0,0,0.2); }
        .expandable-row td { padding: 0 !important; }
        .expandable-container {
          padding: 20px 28px;
          border-top: 1px solid rgba(59,130,246,0.15);
        }
        .sub-title {
          font-size: 13px;
          font-weight: 700;
          color: #94a3b8;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .invoice-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .grid-header-row {
          display: grid;
          grid-template-columns: 1.2fr 2fr 1.8fr 1.2fr 1.5fr;
          padding: 10px 16px;
          background: rgba(15,23,42,0.6);
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 4px;
        }
        .invoice-item-card {
          display: grid;
          grid-template-columns: 1.2fr 2fr 1.8fr 1.2fr 1.5fr;
          align-items: center;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 12px 16px;
          transition: all 0.2s;
        }
        .invoice-item-card:hover {
          background: rgba(30,41,59,0.4);
          border-color: rgba(59,130,246,0.3);
        }
        .badge-invoice {
          background: rgba(59,130,246,0.1);
          color: #60a5fa;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          font-family: monospace;
        }
        .customer-name-text { color: #e2e8f0; font-weight: 500; }
        .date-text { color: #64748b; font-size: 12px; }
        .qty-text { color: #10b981; font-weight: 600; }
        .price-text { color: #34d399; font-weight: 700; }
        .sub-loading, .sub-empty {
          text-align: center;
          padding: 30px;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
        }
        .loading-state {
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
        @media (max-width: 768px) {
          .grid-header-row { display: none; }
          .invoice-item-card { grid-template-columns: 1fr; gap: 8px; }
          .inv-cell { display: flex; justify-content: space-between; }
          .mobile-label { display: inline-block; }
        }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="hero-icon"><TrendingUp size={28} /></div>
            <div>
              <h2 className="main-title">المنتجات الأكثر مبيعاً</h2>
              <p className="sub-title">تحليل ذكي ومتقدم لحجم المبيعات، التدفقات النقدية، ومعدلات الطلب</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="date-range-group">
            <div className="date-picker"><Calendar size={14} /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <span className="date-sep">إلى</span>
            <div className="date-picker"><Calendar size={14} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="select-wrapper">
            <Layers size={14} />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="all">كل الفئات والتصنيفات</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="search-neon-wrapper">
            <input type="text" placeholder="البحث السريع باسم المنتج..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-neon-input" style={{ width: 220 }} />
            <Search size={15} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchTopSelling}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            تحديث
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-quantity">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي القطع المباعة</div>
              <div className="stat-value">{fmt(summary.totalQuantity)}</div>
            </div>
            <div className="stat-icon"><ShoppingCart size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-revenue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي الإيرادات</div>
              <div className="stat-value">{fmtCurrency(summary.totalRevenue)}</div>
            </div>
            <div className="stat-icon"><DollarSign size={20} /></div>
          </div>
        </div>
        <div className="premium-stat-card card-count">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">العناصر النشطة</div>
              <div className="stat-value">{summary.productCount}</div>
            </div>
            <div className="stat-icon"><Package size={20} /></div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <Loader2 size={36} className="spin" style={{ color: "#60a5fa" }} />
          <p>جاري سحب جداول البيانات وتحليل العمليات المكتملة...</p>
        </div>
      ) : (
        <div className="cyber-table-container">
          <div className="cyber-table">
            <table className="cyber-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ width: 70 }}>الترتيب</th>
                  <th>اسم المنتج</th>
                  <th>الفئة</th>
                  <th>حجم المبيعات</th>
                  <th style={{ textAlign: "left" }}>صافي الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr className="cyber-row-main">
                    <td colSpan="6" className="empty-row">لا توجد سجلات مبيعات مكتملة تطابق الفلاتر المحددة خلال هذه الفترة.</td>
                  </tr>
                ) : (
                  filteredProducts.map((prod, idx) => {
                    const isExpanded = expandedProduct === prod.id;
                    const invoices = productInvoices[prod.id] || [];
                    const isLoadingInvoices = loadingInvoices[prod.id];
                    const isTop3 = idx < 3;
                    return (
                      <Fragment key={prod.id}>
                        <tr className={`cyber-row-main product-row ${isExpanded ? "active" : ""}`} onClick={() => toggleExpand(prod.id)}>
                          <td className="expand-cell"><div className={`arrow-icon ${isExpanded ? "rotated" : ""}`}><ChevronLeft size={16} /></div></td>
                          <td className="rank-cell"><span className={`rank-badge ${isTop3 ? `top-${idx + 1}` : ""}`}>{idx + 1}</span></td>
                          <td><span className="product-name">{prod.name}</span></td>
                          <td><span className="category-badge">{prod.category || "عام"}</span></td>
                          <td><span className="quantity-value font-numeric">{fmt(prod.total_quantity)}</span><span className="unit-label"> قطعة</span></td>
                          <td style={{ textAlign: "left" }}><span className="revenue-value font-numeric">{fmtCurrency(prod.total_revenue)}</span></td>
                        </tr>
                        {isExpanded && (
                          <tr className="expandable-row">
                            <td colSpan="6">
                              <div className="expandable-container">
                                <div className="sub-title"><FileText size={14} /><span>سجل المبيعات التفصيلي وحركات الفواتير ذات الصلة</span></div>
                                {isLoadingInvoices ? (
                                  <div className="sub-loading"><Loader2 size={18} className="spin" /> جاري استعلام الفواتير من قاعدة البيانات...</div>
                                ) : invoices.length === 0 ? (
                                  <div className="sub-empty">لم يتم العثور على حركات فواتير مسجلة للمنتج ضمن النطاق الزمني الحالي.</div>
                                ) : (
                                  <div className="invoice-grid">
                                    <div className="grid-header-row">
                                      <div>رقم المرجع</div><div>المشتري / العميل</div><div>تاريخ المعاملة</div><div>الكمية المباعة</div><div style={{ textAlign: "left" }}>القيمة الكلية</div>
                                    </div>
                                    {invoices.map(inv => (
                                      <div key={inv.id} className="invoice-item-card">
                                        <div className="inv-cell"><span className="badge-invoice">#{inv.invoice_number}</span></div>
                                        <div className="inv-cell"><span className="customer-name-text">{inv.customer_name || "عميل نقدي"}</span></div>
                                        <div className="inv-cell"><span className="date-text">{new Date(inv.created_at).toLocaleDateString("ar-EG", { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
                                        <div className="inv-cell"><span className="qty-text">{inv.quantity} قطعة</span></div>
                                        <div className="inv-cell" style={{ textAlign: "left" }}><span className="price-text">{fmtCurrency(inv.total_price)}</span></div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopSellingPage;