import React, { useState, useMemo, useEffect, useCallback } from "react";
import { getDb } from "../lib/db";
import {
  Search, Package, Printer, RefreshCw, Eye, Trash2,
  AlertTriangle, PieChart, ArrowUpRight, DollarSign,
  LayoutDashboard, History, Receipt, User, Calendar,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  BarChart2, ShoppingBag, RotateCcw, Layers, Tag, X,
  CheckCircle2, AlertCircle, HandCoins, CreditCard, Repeat,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ثوابت
// ─────────────────────────────────────────────────────────────────────────────
const PAYMENT_LABELS = {
  cash: { label: "كاش", bg: "#dcfce7", text: "#166534", border: "#bbf7d0", icon: <HandCoins size={11} /> },
  visa: { label: "فيزا", bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe", icon: <CreditCard size={11} /> },
  installment: { label: "تقسيط", bg: "#fef3c7", text: "#92400e", border: "#fde68a", icon: <Repeat size={11} /> },
};

// ─────────────────────────────────────────────────────────────────────────────
// مكوّنات مساعدة صغيرة (مُعدلة لتتناسب مع الثيم)
// ─────────────────────────────────────────────────────────────────────────────
const Badge = ({ bg, text, border, icon, label }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 9px", borderRadius: 50, fontSize: 11, fontWeight: 700,
    backgroundColor: bg, color: text, border: `1px solid ${border}`,
  }}>
    {icon}{label}
  </span>
);

const ProfitIndicator = ({ margin }) => {
  if (margin >= 30) return (
    <span style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700 }}>
      <TrendingUp size={13} /> {margin.toFixed(1)}%
    </span>
  );
  if (margin >= 15) return (
    <span style={{ color: "#fbbf24", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700 }}>
      <Minus size={13} /> {margin.toFixed(1)}%
    </span>
  );
  return (
    <span style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700 }}>
      <TrendingDown size={13} /> {margin.toFixed(1)}%
    </span>
  );
};

const ProgressBar = ({ value, max, color = "#60a5fa" }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 6, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color, transition: "width .4s" }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// صفحة الجرد الرئيسية (بالتصميم الزجاجي الموحد)
// ─────────────────────────────────────────────────────────────────────────────
const InventoryPage = ({ showToast }) => {
  const [inventory, setInventory]         = useState([]);
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState("");
  const [filterCategory, setFilterCategory] = useState("الكل");
  const [sortBy, setSortBy]               = useState("id_desc");
  const [expandedRow, setExpandedRow]     = useState(null);
  const [viewProduct, setViewProduct]     = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // ─── جلب البيانات ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const rows = await db.select(`
        SELECT
          p.*,
          COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id = p.id), 0)
            AS total_current_stock,
          COALESCE((
            SELECT SUM(ii.quantity)
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE ii.product_id = p.id AND i.status IN ('completed','partial_returned')
          ), 0) AS total_sold,
          COALESCE((
            SELECT SUM(ii.quantity * ii.unit_price)
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE ii.product_id = p.id AND i.status IN ('completed','partial_returned')
          ), 0) AS total_revenue,
          COALESCE((
            SELECT SUM(r.quantity)
            FROM returns r
            WHERE r.product_id = p.id
          ), 0) AS total_returned_qty,
          COALESCE((
            SELECT SUM(r.amount)
            FROM returns r
            WHERE r.product_id = p.id
          ), 0) AS total_returned_amount,
          (
            SELECT json_group_array(json_object(
              'id',              v.id,
              'color',           v.color,
              'size',            v.size,
              'variant_barcode', v.variant_barcode,
              'current_stock',   CAST(v.stock AS INTEGER),
              'sold_count',      COALESCE((
                SELECT SUM(ii.quantity)
                FROM invoice_items ii
                JOIN invoices i ON ii.invoice_id = i.id
                WHERE ii.variant_id = v.id AND i.status IN ('completed','partial_returned')
              ), 0),
              'returned_qty',    COALESCE((
                SELECT SUM(r.quantity) FROM returns r WHERE r.variant_id = v.id
              ), 0)
            ))
            FROM product_variants v WHERE v.product_id = p.id
          ) AS variants_json,
          (
            SELECT json_group_array(json_object(
              'invoice_id',  i.id,
              'invoice_num', i.invoice_number,
              'customer',    COALESCE(i.customer_name,'عميل نقدي'),
              'qty',         ii.quantity,
              'unit_price',  ii.unit_price,
              'payment',     i.payment_method,
              'status',      i.status,
              'date',        i.created_at,
              'variant_info',ii.product_name
            ))
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE ii.product_id = p.id
            ORDER BY i.created_at DESC
            LIMIT 20
          ) AS sales_history_json
        FROM products p
        ORDER BY p.id DESC
      `);

      const formatted = rows.map((r) => {
        const variants      = JSON.parse(r.variants_json      || "[]");
        const sales_history = JSON.parse(r.sales_history_json || "[]");
        const grand_total   = (r.total_current_stock || 0) + (r.total_sold || 0);
        const net_revenue   = (r.total_revenue || 0) - (r.total_returned_amount || 0);
        const cost_sold     = (r.total_sold || 0) * (r.cost_price || 0);
        const gross_profit  = net_revenue - cost_sold;
        const margin        = net_revenue > 0 ? (gross_profit / net_revenue) * 100 : 0;
        const turnover      = grand_total  > 0 ? ((r.total_sold || 0) / grand_total) * 100 : 0;

        return {
          ...r,
          variants: variants.map((v) => ({
            ...v,
            initial_stock: (v.current_stock || 0) + (v.sold_count || 0),
          })),
          sales_history,
          grand_total,
          net_revenue,
          gross_profit,
          margin,
          turnover,
        };
      });

      setInventory(formatted);
      const cats = await db.select("SELECT * FROM categories");
      setCategories(cats);
    } catch (err) {
      console.error(err);
      showToast("خطأ في جلب بيانات الجرد", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── جلب تفاصيل فاتورة ────────────────────────────────────────────────────
  const openInvoice = async (invoiceId) => {
    try {
      const db = await getDb();
      const [inv] = await db.select("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
      const items = await db.select(
        `SELECT ii.*, pv.size, pv.color
         FROM invoice_items ii
         LEFT JOIN product_variants pv ON ii.variant_id = pv.id
         WHERE ii.invoice_id = ?`,
        [invoiceId]
      );
      const returns = await db.select(
        `SELECT r.*, p.name as product_name FROM returns r
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.invoice_id = ?`,
        [invoiceId]
      );
      if (inv) setSelectedInvoice({ ...inv, items, returns });
    } catch {
      showToast("فشل في تحميل الفاتورة", "error");
    }
  };

  // ─── حذف منتج ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM product_variants WHERE product_id = ?", [deleteConfirm.id]);
      await db.execute("DELETE FROM products WHERE id = ?",                 [deleteConfirm.id]);
      showToast("تم الحذف", "success");
      setDeleteConfirm(null);
      fetchData();
    } catch {
      showToast("فشل الحذف", "error");
    }
  };

  // ─── فلترة وترتيب ─────────────────────────────────────────────────────────
  const { filtered, stats } = useMemo(() => {
    let list = inventory.filter((p) => {
      const s = searchTerm.toLowerCase();
      const matchName    = p.name.toLowerCase().includes(s);
      const matchBarcode = p.variants.some((v) => (v.variant_barcode || "").includes(s));
      const matchCat     = filterCategory === "الكل" || p.category === filterCategory;
      return (matchName || matchBarcode) && matchCat;
    });

    const sortFns = {
      id_desc:  (a, b) => b.id - a.id,
      margin:   (a, b) => b.margin - a.margin,
      turnover: (a, b) => b.turnover - a.turnover,
      stock:    (a, b) => b.total_current_stock - a.total_current_stock,
    };
    list = [...list].sort(sortFns[sortBy] || sortFns.id_desc);

    const totalCostStock    = list.reduce((s, p) => s + p.total_current_stock * (p.cost_price || 0), 0);
    const totalSaleStock    = list.reduce((s, p) => s + p.total_current_stock * (p.sale_price || 0), 0);
    const totalRevenue      = list.reduce((s, p) => s + p.net_revenue, 0);
    const totalProfit       = list.reduce((s, p) => s + p.gross_profit, 0);
    const outOfStock        = list.filter((p) => p.total_current_stock <= 0).length;
    const avgMargin         = list.length > 0 ? list.reduce((s, p) => s + p.margin, 0) / list.length : 0;
    const avgTurnover       = list.length > 0 ? list.reduce((s, p) => s + p.turnover, 0) / list.length : 0;

    return {
      filtered: list,
      stats: { totalCostStock, totalSaleStock, totalRevenue, totalProfit, outOfStock, avgMargin, avgTurnover },
    };
  }, [inventory, searchTerm, filterCategory, sortBy]);

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
        .card-blue .stat-glow { background: #3b82f6; }
        .card-emerald .stat-glow { background: #10b981; }
        .card-amber .stat-glow { background: #f59e0b; }
        .card-red .stat-glow { background: #ef4444; }
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
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
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
        .modal-cyber-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: white;
        }
        .modal-close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .cyber-modal-body {
          overflow-y: auto;
          padding: 24px;
        }
        .cyber-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .category-filter-btn {
          padding: 5px 14px;
          border-radius: 50px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid;
          cursor: pointer;
          transition: all 0.2s;
        }
        .category-filter-active {
          border-color: #60a5fa;
          background: rgba(96,165,250,0.15);
          color: #60a5fa;
        }
        .category-filter-inactive {
          border-color: rgba(255,255,255,0.1);
          background: transparent;
          color: #94a3b8;
        }
        .category-filter-inactive:hover {
          border-color: rgba(255,255,255,0.2);
          color: #e2e8f0;
        }
        .sort-btn {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid;
          cursor: pointer;
        }
        .sort-active {
          border-color: #a78bfa;
          background: rgba(167,139,250,0.15);
          color: #a78bfa;
        }
        .sort-inactive {
          border-color: rgba(255,255,255,0.08);
          background: transparent;
          color: #64748b;
        }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LayoutDashboard size={26} style={{ color: "#60a5fa" }} />
            <h2 className="main-title">جرد المخزون الكامل</h2>
          </div>
          <p className="sub-title">{inventory.length} موديل مسجل — تحليل شامل للربحية والدوران</p>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="بحث باسم الموديل أو الباركود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
              style={{ width: 260 }}
            />
            <Search size={15} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={() => window.print()}>
            <Printer size={18} />
          </button>
          <button className="btn-action-neon btn-secondary" onClick={fetchData} style={{ opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Cards (Premium) */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><DollarSign size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">رأس مال المخزون (تكلفة)</div>
              <div className="stat-value">{stats.totalCostStock.toLocaleString()} ج.م</div>
              <div className="stat-sub" style={{ fontSize: 11, color: "#64748b" }}>سعر بيع: {stats.totalSaleStock.toLocaleString()} ج.م</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><ArrowUpRight size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي الإيرادات المحققة</div>
              <div className="stat-value">{stats.totalRevenue.toLocaleString()} ج.م</div>
              <div className="stat-sub" style={{ fontSize: 11, color: "#64748b" }}>صافي ربح: {stats.totalProfit.toLocaleString()} ج.م</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><BarChart2 size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">متوسط هامش الربح</div>
              <div className="stat-value">{stats.avgMargin.toFixed(1)}%</div>
              <div className="stat-sub" style={{ fontSize: 11, color: "#64748b" }}>متوسط دوران: {stats.avgTurnover.toFixed(1)}%</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-red">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><AlertTriangle size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">موديلات نفذت من المخزن</div>
              <div className="stat-value" style={{ color: "#f87171" }}>{stats.outOfStock} موديل</div>
              <div className="stat-sub" style={{ fontSize: 11, color: "#64748b" }}>من إجمالي {filtered.length} موديل</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter + Sort Bar */}
      <div className="premium-control-bar" style={{ padding: "12px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {["الكل", ...categories.map((c) => c.name)].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`category-filter-btn ${filterCategory === cat ? "category-filter-active" : "category-filter-inactive"}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>ترتيب:</span>
          {[
            { key: "id_desc",  label: "الأحدث" },
            { key: "margin",   label: "الأعلى ربحاً" },
            { key: "turnover", label: "الأعلى دوراناً" },
            { key: "stock",    label: "الأعلى مخزوناً" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`sort-btn ${sortBy === s.key ? "sort-active" : "sort-inactive"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th>الموديل</th>
              <th>القسم / الموسم</th>
              <th>التسعير والربحية</th>
              <th>حالة المخزون</th>
              <th>الأداء التجاري</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <RefreshCw size={18} style={{ animation: "spin 1s linear infinite", display: "inline", marginLeft: 8 }} />
                جاري جلب الجرد...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>لا توجد منتجات</td></tr>
            ) : filtered.map((prod) => (
              <React.Fragment key={prod.id}>
                <tr
                  className="cyber-row-main"
                  style={{ cursor: "pointer" }}
                  onClick={() => setExpandedRow(expandedRow === prod.id ? null : prod.id)}
                >
                  {/* اسم الموديل */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: prod.total_current_stock <= 0 ? "#f87171"
                          : prod.total_current_stock <= 5 ? "#fbbf24" : "#34d399",
                      }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{prod.name}</div>
                        <div style={{ color: "#64748b", fontSize: 11 }}>باركود: {prod.barcode || "—"}</div>
                      </div>
                    </div>
                   </td>

                  {/* القسم */}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Badge bg="rgba(96,165,250,0.1)" text="#60a5fa" border="rgba(96,165,250,0.2)" label={prod.category || "—"} />
                      {prod.season && <Badge bg="rgba(167,139,250,0.1)" text="#a78bfa" border="rgba(167,139,250,0.2)" label={prod.season} />}
                    </div>
                   </td>

                  {/* التسعير والربحية */}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontWeight: 700, color: "#34d399", fontSize: 14 }}>
                        {(prod.sale_price || 0).toLocaleString()} ج.م
                      </div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>
                        تكلفة: {(prod.cost_price || 0).toLocaleString()} ج.م
                      </div>
                      <ProfitIndicator margin={prod.margin} />
                    </div>
                   </td>

                  {/* المخزون */}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 130 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#94a3b8" }}>متاح:</span>
                        <span style={{
                          fontWeight: 700,
                          color: prod.total_current_stock <= 0 ? "#f87171"
                            : prod.total_current_stock <= 5 ? "#fbbf24" : "#34d399",
                        }}>
                          {prod.total_current_stock} قطعة
                        </span>
                      </div>
                      <ProgressBar
                        value={prod.total_current_stock}
                        max={prod.grand_total}
                        color={prod.total_current_stock <= 0 ? "#f87171"
                          : prod.total_current_stock <= 5 ? "#fbbf24" : "#34d399"}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
                        <span>مباع: {prod.total_sold}</span>
                        <span>إجمالي: {prod.grand_total}</span>
                      </div>
                    </div>
                   </td>

                  {/* الأداء التجاري */}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <TrendingUp size={13} style={{ color: "#34d399" }} />
                        <span style={{ color: "#94a3b8" }}>إيراد:</span>
                        <span style={{ fontWeight: 700, color: "#34d399" }}>
                          {prod.net_revenue.toLocaleString()} ج.م
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <BarChart2 size={13} style={{ color: "#a78bfa" }} />
                        <span style={{ color: "#94a3b8" }}>دوران:</span>
                        <span style={{ fontWeight: 700, color: "#a78bfa" }}>
                          {prod.turnover.toFixed(1)}%
                        </span>
                      </div>
                      {prod.total_returned_qty > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <RotateCcw size={13} style={{ color: "#fb923c" }} />
                          <span style={{ color: "#94a3b8" }}>مرتجع:</span>
                          <span style={{ fontWeight: 700, color: "#fb923c" }}>
                            {prod.total_returned_qty} قطعة
                          </span>
                        </div>
                      )}
                    </div>
                   </td>

                  {/* الإجراءات */}
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      <button
                        className="action-btn edit"
                        onClick={(e) => { e.stopPropagation(); setViewProduct(prod); }}
                        title="تفاصيل كاملة"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(prod); }}
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        style={{
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "#94a3b8",
                        }}
                        onClick={(e) => { e.stopPropagation(); setExpandedRow(expandedRow === prod.id ? null : prod.id); }}
                        title="عرض المتاريانتس"
                      >
                        {expandedRow === prod.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                   </td>
                </tr>

                {/* ── صف الـ Variants المتوسع ── */}
                {expandedRow === prod.id && (
                  <tr className="cyber-row-main" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div style={{ padding: "14px 20px" }}>
                        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>
                          تفاصيل المقاسات والألوان
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                          {prod.variants.map((v, i) => (
                            <div key={i} style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 10, padding: "10px 12px",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{v.color}</span>
                                <span style={{
                                  background: "rgba(96,165,250,0.15)", color: "#60a5fa",
                                  border: "1px solid rgba(96,165,250,0.2)",
                                  borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                                }}>{v.size}</span>
                              </div>
                              <ProgressBar
                                value={v.sold_count || 0}
                                max={v.initial_stock || 1}
                                color="#a78bfa"
                              />
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: "#64748b" }}>
                                <span>مباع: <strong style={{ color: "#a78bfa" }}>{v.sold_count}</strong></span>
                                <span>متاح: <strong style={{ color: v.current_stock <= 0 ? "#f87171" : "#34d399" }}>{v.current_stock}</strong></span>
                              </div>
                              {v.returned_qty > 0 && (
                                <div style={{ fontSize: 10, color: "#fb923c", marginTop: 3 }}>↩ مرتجع: {v.returned_qty}</div>
                              )}
                              {v.variant_barcode && (
                                <div style={{ fontSize: 9, color: "#475569", marginTop: 4, fontFamily: "monospace" }}>{v.variant_barcode}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: تفاصيل المنتج (View) */}
      {viewProduct && (
        <div className="blur-overlay" onClick={() => setViewProduct(null)}>
          <div className="cyber-modal" style={{ maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="icon-box" style={{ width: 42, height: 42, background: "rgba(96,165,250,0.15)" }}>
                  <Package size={22} style={{ color: "#60a5fa" }} />
                </div>
                <div>
                  <h3>{viewProduct.name}</h3>
                  <p style={{ color: "#64748b", fontSize: 12 }}>{viewProduct.category} — {viewProduct.season}</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setViewProduct(null)}><X size={20} /></button>
            </div>
            <div className="cyber-modal-body">
              {/* بطاقات الأداء */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "إجمالي الإيراد الصافي", value: `${viewProduct.net_revenue.toLocaleString()} ج.م`, color: "#34d399" },
                  { label: "صافي الربح المحقق",      value: `${viewProduct.gross_profit.toLocaleString()} ج.م`, color: viewProduct.gross_profit >= 0 ? "#34d399" : "#f87171" },
                  { label: "هامش الربح",              value: `${viewProduct.margin.toFixed(1)}%`, color: viewProduct.margin >= 30 ? "#34d399" : viewProduct.margin >= 15 ? "#fbbf24" : "#f87171" },
                  { label: "معدل دوران المخزون",      value: `${viewProduct.turnover.toFixed(1)}%`, color: "#a78bfa" },
                ].map((c, i) => (
                  <div key={i} className="premium-stat-card" style={{ padding: "12px" }}>
                    <div className="stat-label">{c.label}</div>
                    <div className="stat-value" style={{ fontSize: 18, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* تقييم الموديل */}
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: 16, marginBottom: 20,
              }}>
                <div className="stat-label" style={{ fontWeight: 700, marginBottom: 12 }}>تقييم أداء الموديل</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {/* الربحية */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>الربحية</span>
                      <ProfitIndicator margin={viewProduct.margin} />
                    </div>
                    <ProgressBar value={Math.min(viewProduct.margin, 100)} max={100}
                      color={viewProduct.margin >= 30 ? "#34d399" : viewProduct.margin >= 15 ? "#fbbf24" : "#f87171"} />
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                      {viewProduct.margin >= 30 ? "✅ هامش ممتاز (30%+)" : viewProduct.margin >= 15 ? "⚠️ هامش مقبول (15-30%)" : "❌ هامش منخفض (أقل من 15%)"}
                    </div>
                  </div>
                  {/* الدوران */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>دوران المخزون</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>{viewProduct.turnover.toFixed(1)}%</span>
                    </div>
                    <ProgressBar value={viewProduct.turnover} max={100} color="#a78bfa" />
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                      {viewProduct.turnover >= 70 ? "✅ دوران سريع (70%+)" : viewProduct.turnover >= 40 ? "⚠️ دوران متوسط" : "❌ دوران بطيء — راجع التسعير"}
                    </div>
                  </div>
                  {/* المرتجعات */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>نسبة المرتجع</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fb923c" }}>
                        {viewProduct.grand_total > 0 ? ((viewProduct.total_returned_qty / viewProduct.grand_total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <ProgressBar value={viewProduct.total_returned_qty} max={viewProduct.grand_total || 1} color="#fb923c" />
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                      {viewProduct.total_returned_qty} قطعة مرتجعة من {viewProduct.grand_total}
                    </div>
                  </div>
                </div>
              </div>

              {/* ملخص المخزون + المتاريانتس */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
                  <div className="stat-label" style={{ fontWeight: 700, marginBottom: 12 }}>ملخص المخزون</div>
                  {[
                    { label: "المخزون الأصلي (إجمالي)",   value: `${viewProduct.grand_total} قطعة`,               color: "#e2e8f0" },
                    { label: "إجمالي المباع",               value: `${viewProduct.total_sold} قطعة`,                color: "#60a5fa" },
                    { label: "إجمالي المرتجع",              value: `${viewProduct.total_returned_qty} قطعة`,        color: "#fb923c" },
                    { label: "المتاح حالياً",               value: `${viewProduct.total_current_stock} قطعة`,       color: viewProduct.total_current_stock <= 0 ? "#f87171" : "#34d399" },
                    { label: "تكلفة المخزون الحالي",        value: `${(viewProduct.total_current_stock * (viewProduct.cost_price || 0)).toLocaleString()} ج.م`, color: "#fbbf24" },
                    { label: "القيمة البيعية للمخزون",      value: `${(viewProduct.total_current_stock * (viewProduct.sale_price || 0)).toLocaleString()} ج.م`, color: "#34d399" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                      <span style={{ color: "#94a3b8" }}>{r.label}</span>
                      <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
                  <div className="stat-label" style={{ fontWeight: 700, marginBottom: 12 }}>المقاسات والألوان</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                    {viewProduct.variants.map((v, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                            <span style={{ fontWeight: 700 }}>{v.color} / {v.size}</span>
                            <span style={{ color: "#64748b", fontSize: 10 }}>{v.sold_count} مباع / {v.current_stock} متاح</span>
                          </div>
                          <ProgressBar value={v.sold_count || 0} max={v.initial_stock || 1} color="#a78bfa" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* سجل الفواتير */}
              <div>
                <div className="stat-label" style={{ fontWeight: 700, marginBottom: 12 }}>
                  <History size={13} style={{ display: "inline", marginLeft: 5 }} />
                  سجل الفواتير (آخر 20 عملية)
                </div>
                <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <table className="cyber-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>رقم الفاتورة</th>
                        <th>العميل</th>
                        <th>الصنف المباع</th>
                        <th style={{ textAlign: "center" }}>الكمية</th>
                        <th>سعر الوحدة</th>
                        <th>الإجمالي</th>
                        <th>طريقة الدفع</th>
                        <th>التاريخ</th>
                        <th style={{ textAlign: "center" }}>فتح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewProduct.sales_history.length === 0 ? (
                        <tr><td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: 20 }}>لا توجد مبيعات مسجلة</td></tr>
                      ) : viewProduct.sales_history.map((s, i) => {
                        const pm = PAYMENT_LABELS[s.payment] || PAYMENT_LABELS.cash;
                        return (
                          <tr key={i} className="cyber-row-main">
                            <td style={{ color: "#34d399", fontWeight: 700 }}>#{s.invoice_num}</td>
                            <td>{s.customer}</td>
                            <td style={{ color: "#cbd5e1", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.variant_info}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700 }}>{s.qty}</td>
                            <td>{(s.unit_price || 0).toLocaleString()} ج.م</td>
                            <td style={{ fontWeight: 700, color: "#34d399" }}>
                              {((s.qty || 0) * (s.unit_price || 0)).toLocaleString()} ج.م
                            </td>
                            <td><Badge {...pm} /></td>
                            <td style={{ color: "#64748b", fontSize: 10 }}>
                              {new Date(s.date).toLocaleDateString("ar-EG")}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button className="action-btn edit" style={{ width: 28, height: 28 }} onClick={() => openInvoice(s.invoice_id)}>
                                <Eye size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="cyber-modal-footer">
              <button className="btn-action-neon btn-secondary" onClick={() => window.print()}><Printer size={16} /> طباعة</button>
              <button className="btn-action-neon btn-secondary" onClick={() => setViewProduct(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تفاصيل الفاتورة */}
      {selectedInvoice && (
        <div className="blur-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="cyber-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Receipt size={18} style={{ color: "#34d399" }} />
                <h3>فاتورة #{selectedInvoice.invoice_number}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedInvoice(null)}><X size={18} /></button>
            </div>
            <div className="cyber-modal-body">
              {/* معلومات العميل */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "العميل", value: selectedInvoice.customer_name || "عميل نقدي", icon: <User size={13} /> },
                  { label: "التاريخ", value: new Date(selectedInvoice.created_at).toLocaleDateString("ar-EG", { year:"numeric", month:"long", day:"numeric" }), icon: <Calendar size={13} /> },
                  { label: "التليفون", value: selectedInvoice.customer_phone || "—", icon: <User size={13} /> },
                  { label: "العنوان", value: selectedInvoice.customer_address || "—", icon: <User size={13} /> },
                ].map((r, i) => (
                  <div key={i} className="premium-stat-card" style={{ padding: "10px 14px" }}>
                    <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      {r.icon} {r.label}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* الأصناف */}
              <div className="cyber-table-container">
                <table className="cyber-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>المقاس / اللون</th>
                      <th style={{ textAlign: "center" }}>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, i) => (
                      <tr key={i} className="cyber-row-main">
                        <td>{item.product_name}</td>
                        <td>{item.size || "—"} / {item.color || "—"}</td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{item.quantity}</td>
                        <td>{(item.unit_price || 0).toLocaleString()} ج.م</td>
                        <td style={{ fontWeight: 700, color: "#34d399" }}>
                          {((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* المرتجعات */}
              {selectedInvoice.returns?.length > 0 && (
                <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(251,146,60,0.25)", marginBottom: 16 }}>
                  <div className="stat-label" style={{ padding: "8px 12px", color: "#fb923c" }}>الأصناف المرتجعة</div>
                  <table className="cyber-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>الصنف</th>
                        <th>الكمية</th>
                        <th>القيمة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.returns.map((r, i) => (
                        <tr key={i} className="cyber-row-main">
                          <td>{r.product_name}</td>
                          <td style={{ color: "#fb923c", fontWeight: 700 }}>{r.quantity}</td>
                          <td style={{ color: "#f87171" }}>{(r.amount || 0).toLocaleString()} ج.م</td>
                          <td style={{ color: "#64748b" }}>{new Date(r.return_date).toLocaleDateString("ar-EG")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ملخص الفاتورة */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div>
                  {(selectedInvoice.discount_value || 0) > 0 && (
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      خصم: {selectedInvoice.discount_value}{selectedInvoice.discount_type === "percent" ? "%" : " ج.م"}
                    </div>
                  )}
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                    طريقة الدفع: <Badge {...(PAYMENT_LABELS[selectedInvoice.payment_method] || PAYMENT_LABELS.cash)} />
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div className="stat-label">إجمالي الفاتورة</div>
                  <div className="stat-value" style={{ fontSize: 22, color: "#34d399" }}>
                    {(selectedInvoice.total_after_discount || 0).toLocaleString()} ج.م
                  </div>
                </div>
              </div>
            </div>
            <div className="cyber-modal-footer">
              <button className="btn-action-neon btn-secondary" style={{ width: "100%" }} onClick={() => setSelectedInvoice(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تأكيد الحذف */}
      {deleteConfirm && (
        <div className="blur-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cyber-modal" style={{ maxWidth: 380, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3 style={{ color: "#f87171" }}>تأكيد الحذف</h3>
              <button className="modal-close-btn" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
            </div>
            <div className="cyber-modal-body" style={{ padding: "24px", textAlign: "center" }}>
              <AlertTriangle size={48} style={{ color: "#f87171", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>حذف المنتج "{deleteConfirm.name}"؟</div>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>
                سيتم حذف المنتج من المخزون نهائياً ولن يمكن استرجاعه.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="cyber-btn-submit danger-bg" style={{ background: "#ef4444" }} onClick={handleDelete}>حذف نهائياً</button>
                <button className="cyber-btn-dismiss" onClick={() => setDeleteConfirm(null)}>تراجع</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;