import React, { useEffect, useState } from 'react';
import { getDb } from "../lib/db";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, Package, 
  ShoppingBag, RefreshCw, ArrowUpRight 
} from 'lucide-react';

const StatsPage = ({ showToast }) => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalInvoices: 0,
    totalProducts: 0,
    totalCustomers: 0,
    chartData: [],
    topProducts: []
  });
  const [loading, setLoading] = useState(true);

  const fetchRealData = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      // جلب البيانات الأساسية
      const salesRes = await db.select("SELECT SUM(total_after_discount) as total FROM invoices");
      const invCount = await db.select("SELECT COUNT(*) as count FROM invoices");
      const prodCount = await db.select("SELECT COUNT(*) as count FROM products");
      const custCount = await db.select("SELECT COUNT(*) as count FROM customers");
      
      // جلب بيانات المخطط البياني (آخر 7 أيام)
      const chartRes = await db.select(`
        SELECT strftime('%m/%d', created_at) as date, SUM(total_after_discount) as total 
        FROM invoices GROUP BY date ORDER BY date DESC LIMIT 7
      `);

      // جلب المنتجات الأكثر مبيعاً
      const topProds = await db.select(`
        SELECT product_name as name, SUM(quantity) as value 
        FROM invoice_items GROUP BY product_name ORDER BY value DESC LIMIT 5
      `);

      setStats({
        totalSales: salesRes[0]?.total || 0,
        totalInvoices: invCount[0]?.count || 0,
        totalProducts: prodCount[0]?.count || 0,
        totalCustomers: custCount[0]?.count || 0,
        chartData: chartRes.reverse(),
        topProducts: topProds
      });
    } catch (error) {
      console.error(error);
      if(showToast) showToast("حدث خطأ أثناء تحديث البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRealData(); }, []);

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      
      {/* الهيدر الموحد */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">لوحة التحليلات الذكية</h2>
          <p className="sub-title">مراقبة الأداء المالي، حركة المخزون، وتفاعل العملاء لحظياً</p>
        </div>

        <div className="header-actions-group">
          <button className={`btn-save ${loading ? 'opacity-50' : ''}`} onClick={fetchRealData} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* كروت الإحصائيات - بتنسيق Premium */}
      <div className="stats-grid-premium">
        <StatCard 
          title="إجمالي الدخل" 
          value={`${stats.totalSales.toLocaleString()} ج.م`} 
          icon={<DollarSign size={24} />} 
          type="indigo" 
        />
        <StatCard 
          title="عدد الفواتير" 
          value={stats.totalInvoices} 
          icon={<ShoppingBag size={24} />} 
          type="emerald" 
        />
        <StatCard 
          title="أصناف المنتجات" 
          value={stats.totalProducts} 
          icon={<Package size={24} />} 
          type="amber" 
        />
        <StatCard 
          title="قاعدة العملاء" 
          value={stats.totalCustomers} 
          icon={<Users size={24} />} 
          type="rose" 
        />
      </div>

      <div className="charts-main-layout">
        
        {/* المخطط البياني الكبير */}
        <div className="chart-card-premium area-chart-section">
          <div className="chart-header">
            <div className="flex items-center gap-2">
               <div className="status-dot-active"></div>
               <h3 className="chart-title">منحنى المبيعات الأسبوعي</h3>
            </div>
            <span className="trend-badge-positive">
              <ArrowUpRight size={14} /> مباشر
            </span>
          </div>
          
          <div className="chart-visual-container">
            {loading ? (
              <div className="loader-placeholder">جاري معالجة البيانات...</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* قائمة الأكثر مبيعاً */}
        <div className="chart-card-premium top-products-section">
          <h3 className="chart-title mb-6">الأصناف الأكثر طلباً</h3>
          <div className="top-items-list">
            {stats.topProducts.length > 0 ? stats.topProducts.map((prod, idx) => (
              <div key={idx} className="top-item-row">
                <div className="item-info">
                  <div className={`rank-badge rank-${idx + 1}`}>
                    {idx + 1}
                  </div>
                  <span className="item-name">{prod.name}</span>
                </div>
                <div className="item-value">
                  <span className="value-number">{prod.value}</span>
                  <span className="value-unit">قطعة</span>
                </div>
              </div>
            )) : (
              <div className="empty-state">لا توجد بيانات حركة حالياً</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// مكون الكارت الموحد
const StatCard = ({ title, value, icon, type }) => {
  return (
    <div className={`stat-card-premium ${type}`}>
      <div className="stat-icon-wrapper">
        {icon}
      </div>
      <div className="stat-content">
        <p className="stat-label">{title}</p>
        <h3 className="stat-value">{value}</h3>
      </div>
      <div className="stat-decoration"></div>
    </div>
  );
};

export default StatsPage;