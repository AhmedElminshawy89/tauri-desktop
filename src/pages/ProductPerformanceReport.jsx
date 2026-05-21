import React, { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronLeft,
  BarChart3,
  PieChart as PieIcon,
  DollarSign
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

// تنسيقات مخصصة للعملة والأرقام
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const fmtCurrency = (n) => 
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(n || 0);

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const ProductPerformanceReport = ({ showToast }) => {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [productInvoices, setProductInvoices] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState({});
  const [activeTab, setActiveTab] = useState("top");

  const fetchProductData = async () => {
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
         ORDER BY total_quantity DESC`,
        params
      );

      setAllProducts(rows || []);
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
    fetchProductData();
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

  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const topProducts = [...filteredProducts].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 10);
  const bottomProducts = [...filteredProducts].sort((a, b) => a.total_quantity - b.total_quantity).slice(0, 10);
  const topByQuantity = [...filteredProducts].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 5).map(p => ({
    name: p.name.length > 12 ? p.name.slice(0, 10) + "..." : p.name,
    الكمية: p.total_quantity,
  }));

  const categoryMap = new Map();
  filteredProducts.forEach(p => {
    const cat = p.category || "بدون فئة";
    const rev = p.total_revenue;
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + rev);
  });
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  const totalQuantity = filteredProducts.reduce((s, p) => s + p.total_quantity, 0);
  const totalRevenue = filteredProducts.reduce((s, p) => s + p.total_revenue, 0);
  const productCount = filteredProducts.length;
  const productsWithSales = filteredProducts.filter(p => p.total_quantity > 0).length;
  const currentTableData = activeTab === "top" ? topProducts : bottomProducts;

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
        .card-emerald .stat-glow { background: #10b981; }
        .card-blue .stat-glow { background: #3b82f6; }
        .card-amber .stat-glow { background: #f59e0b; }
        .stat-content {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-emerald .icon-box { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .stat-details { flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }
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
          gap: 24px;
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
        .premium-control-bar {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 18px 24px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
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
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .analytics-hub-row {
          display: flex;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .analytics-card {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s;
        }
        .analytics-card:hover {
          border-color: rgba(59,130,246,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .flex-2 { flex: 2; min-width: 360px; }
        .flex-1 { flex: 1; min-width: 230px; }
        .flex-1\.5 { flex: 1.5; min-width: 280px; }
        .card-inline-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #94a3b8;
          font-weight: 600;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 10px;
        }
        .chart-wrapper { width: 100%; min-height: 220px; }
        .flex-center { display: flex; align-items: center; justify-content: center; }
        .summary-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          justify-content: center;
          height: 100%;
        }
        .sum-box {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
          padding: 12px;
        }
        .sum-box .lbl { font-size: 11px; color: #64748b; margin-bottom: 4px; }
        .sum-box .val { font-size: 16px; font-weight: 700; }
        .data-card-full {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          overflow: hidden;
        }
        .card-tabs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0,0,0,0.2);
          padding: 0 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-wrap: wrap;
        }
        .tabs-buttons { display: flex; gap: 4px; }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: none;
          color: #64748b;
          padding: 14px 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }
        .tab-btn:hover { color: #cbd5e1; }
        .tab-btn.active { color: white; }
        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
        }
        .tab-btn.active.emerald::after { background: #10b981; }
        .tab-btn.active.rose::after { background: #ef4444; }
        .table-status-indicator { font-size: 12px; color: #475569; padding: 10px 0; }
        .product-row { cursor: pointer; transition: background 0.15s; }
        .product-row:hover { background: rgba(30,41,59,0.4); }
        .product-row.active { background: rgba(59,130,246,0.08); }
        .expand-cell { text-align: center; color: #475569; }
        .rank { font-weight: 700; font-size: 15px; }
        .text-emerald { color: #10b981; }
        .text-rose { color: #f43f5e; }
        .product-name { font-weight: 500; color: #f1f5f9; }
        .category-tag {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #64748b;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .quantity-cell { text-align: center !important; }
        .qty-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .qty-badge.bg-emerald { background: rgba(16,185,129,0.1); color: #34d399; }
        .qty-badge.bg-rose { background: rgba(239,68,68,0.1); color: #f87171; }
        .revenue-cell { font-weight: 600; color: #38bdf8; }
        .expandable-row { background: rgba(0,0,0,0.2); }
        .expandable-content { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .sub-table {
          width: 100%;
          border-collapse: collapse;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          overflow: hidden;
        }
        .sub-table th {
          background: rgba(15,23,42,0.6);
          color: #64748b;
          font-weight: 500;
          font-size: 12px;
          padding: 10px 12px;
        }
        .sub-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          font-size: 13px;
          color: #cbd5e1;
        }
        .sub-quantity { color: #10b981; font-weight: 500; }
        .sub-revenue { color: #38bdf8; font-weight: 500; }
        .sub-loading, .sub-empty { text-align: center; color: #64748b; padding: 20px; }
        .empty-row { text-align: center !important; color: #64748b; padding: 50px !important; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="icon-box" style={{ width: 48, height: 48, background: "rgba(59,130,246,0.15)" }}>
              <Package size={24} style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <h2 className="main-title">تحليلات أداء المنتجات المتقدمة</h2>
              <p className="sub-title">مراقبة حية للمبيعات وحصص الفئات في السوق خلال الفترة المحددة</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper" style={{ width: "auto" }}>
            <div className="date-range" style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0b0f19", padding: "6px 12px", borderRadius: "40px" }}>
              <Calendar size={14} />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="search-neon-input" style={{ width: "130px", padding: "6px 8px" }} />
              <span style={{ color: "#64748b" }}>←</span>
              <Calendar size={14} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="search-neon-input" style={{ width: "130px", padding: "6px 8px" }} />
            </div>
          </div>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="search-neon-input" style={{ width: "160px" }}>
            <option value="all">كل الفئات</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <div className="search-neon-wrapper">
            <input type="text" placeholder="ابحث باسم المنتج..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-neon-input" style={{ width: "200px" }} />
            <Search size={14} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchProductData}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            تحديث
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Package size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي القطع المباعة</div>
              <div className="stat-value">{fmt(totalQuantity)}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><DollarSign size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي الإيرادات</div>
              <div className="stat-value">{fmtCurrency(totalRevenue)}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><TrendingUp size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">المنتجات النشطة</div>
              <div className="stat-value">{productsWithSales}</div>
              <div className="stat-sub" style={{ fontSize: 11, color: "#64748b" }}>من إجمالي {productCount}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="cyber-table-container" style={{ textAlign: "center", padding: "60px" }}>
          <Loader2 size={36} className="spin" style={{ color: "#60a5fa" }} />
          <p style={{ marginTop: "16px", color: "#94a3b8" }}>جاري سحب وتحديث لوحة التحليلات البيانية...</p>
        </div>
      ) : (
        <>
          {/* Analytics Hub */}
          <div className="analytics-hub-row">
            <div className="analytics-card flex-2">
              <div className="card-inline-header"><BarChart3 size={16} className="text-emerald-400" /> الأكثر مبيعاً حسب الكمية</div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topByQuantity} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f1f5f9", borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="الكمية" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="analytics-card flex-1.5">
              <div className="card-inline-header"><PieIcon size={16} className="text-indigo-400" /> حصة الفئات من الإيرادات</div>
              <div className="chart-wrapper flex-center">
                {categoryData.length === 0 ? (
                  <div className="sub-empty">لا توجد بيانات فئات متاح عرضها</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <RePieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                        {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => fmtCurrency(value)} contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f1f5f9", borderRadius: '8px', fontSize: '12px' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="analytics-card flex-1">
              <div className="card-inline-header"><DollarSign size={16} className="text-amber-400" /> الملخص المالي للفترة</div>
              <div className="summary-list">
                <div className="sum-box"><span className="lbl">معدل العائد لكل صنف</span><span className="val text-blue-400">{fmtCurrency(totalRevenue / (productsWithSales || 1))}</span></div>
                <div className="sum-box"><span className="lbl">التنوع السلعي النشط</span><span className="val">{productsWithSales} صنف</span></div>
                <div className="sum-box"><span className="lbl">متوسط سعر القطعة المباعة</span><span className="val text-amber-400">{fmtCurrency(totalRevenue / (totalQuantity || 1))}</span></div>
              </div>
            </div>
          </div>

          {/* Data Table with Tabs */}
          <div className="data-card-full">
            <div className="card-tabs-header">
              <div className="tabs-buttons">
                <button className={`tab-btn ${activeTab === "top" ? "active emerald" : ""}`} onClick={() => { setActiveTab("top"); setExpandedProduct(null); }}>
                  <TrendingUp size={16} /> المنتجات الأعلى مبيعاً
                </button>
                <button className={`tab-btn ${activeTab === "bottom" ? "active rose" : ""}`} onClick={() => { setActiveTab("bottom"); setExpandedProduct(null); }}>
                  <TrendingDown size={16} /> المنتجات الأقل مبيعاً
                </button>
              </div>
              <div className="table-status-indicator">تصفح أعلى 10 منتجات بناءً على الفلاتر الحالية</div>
            </div>
            <div className="cyber-table-container" style={{ boxShadow: "none", borderRadius: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th style={{ width: 60 }}>الترتيب</th>
                    <th>اسم المنتج</th>
                    <th>الفئة</th>
                    <th style={{ textAlign: "center" }}>الكميات المباعة</th>
                    <th>صافي الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTableData.length === 0 ? (
                    <tr><td colSpan="6" className="empty-row">لا توجد سجلات مبيعات مطابقة للفلاتر الحالية</td></tr>
                  ) : (
                    currentTableData.map((prod, idx) => {
                      const isExpanded = expandedProduct === prod.id;
                      const invoices = productInvoices[prod.id] || [];
                      const isLoadingInv = loadingInvoices[prod.id];
                      return (
                        <React.Fragment key={prod.id}>
                          <tr className={`cyber-row-main product-row ${isExpanded ? 'active' : ''}`} onClick={() => toggleExpand(prod.id)}>
                            <td className="expand-cell">{isExpanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}</td>
                            <td className={`rank ${activeTab === "top" ? "text-emerald" : "text-rose"}`}>{idx + 1}</td>
                            <td><span className="product-name">{prod.name}</span></td>
                            <td><span className="category-tag">{prod.category || "عام / غير مصنف"}</span></td>
                            <td className="quantity-cell">
                              <span className={`qty-badge ${activeTab === "top" ? "bg-emerald" : "bg-rose"}`}>
                                {fmt(prod.total_quantity)} قطعة
                              </span>
                            </td>
                            <td className="revenue-cell">{fmtCurrency(prod.total_revenue)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="expandable-row">
                              <td colSpan="6">
                                <div className="expandable-content">
                                  {isLoadingInv ? (
                                    <div className="sub-loading"><Loader2 size={16} className="spin" /> جاري البحث وقراءة الفواتير...</div>
                                  ) : invoices.length === 0 ? (
                                    <div className="sub-empty">لا توجد فواتير تفصيلية مكتملة لهذا النطاق الزمني</div>
                                  ) : (
                                    <table className="sub-table">
                                      <thead><tr><th>رقم الفاتورة</th><th>اسم العميل</th><th>التاريخ</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
                                      <tbody>
                                        {invoices.map(inv => (
                                          <tr key={inv.id}>
                                            <td className="font-mono" style={{ color: "#60a5fa" }}>#{inv.invoice_number}</td>
                                            <td>{inv.customer_name || "عميل كاش نقدي"}</td>
                                            <td>{new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
                                            <td className="sub-quantity">{inv.quantity} قطعة</td>
                                            <td className="sub-revenue">{fmtCurrency(inv.total_price)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProductPerformanceReport;