// import { useState, useEffect } from "react";
// import { NavLink, Outlet, useLocation } from "react-router-dom"; // أضف useLocation
// import {
//   LayoutDashboard,
//   ShoppingCart,
//   Box,
//   Users,
//   BarChart3,
//   Settings,
//   LogOut,
//   ChevronDown,
//   Menu,
//   X,
//   Receipt,
//   UserCheck,
//   Wallet,
//   Percent,
//   Truck,
//   RotateCcw,
//   PackageSearch,
//   Tags,
//   History,
//   Trash2,
//   Barcode,
//   ClipboardList,
//   TrendingDown,
//   Layers,
//   Edit3,
//   HandCoins,
//   CheckIcon,
//   TrendingUp,
//   Package,
// } from "lucide-react";
// import { getDb } from "../lib/db";

// const DashboardLayout = ({ onLogout, currentUser }) => {
//   const [isSidebarOpen, setSidebarOpen] = useState(true);
//   const [pendingCount, setPendingCount] = useState(0);
//   const location = useLocation(); // للحصول على المسار الحالي

//   const [openMenus, setOpenMenus] = useState({
//     sales: true,
//     inventory: false,
//     people: false,
//     reports: false,
//     accounting: false,
//   });

//   const toggleMenu = (menu) => {
//     setOpenMenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
//   };

//   // جلب عدد الفواتير المعلقة من قاعدة البيانات
//   const fetchPendingCount = async () => {
//     try {
//       const db = await getDb();
//       const result = await db.select(
//         "SELECT COUNT(*) as count FROM invoices WHERE status = 'pending'"
//       );
//       setPendingCount(result[0]?.count || 0);
//     } catch (error) {
//       console.error("Error fetching pending count:", error);
//     }
//   };

//   // تحديث العدد عند تحميل المكون وعند أي تغيير في الفواتير (عبر الحدث المخصص)
//   useEffect(() => {
//     fetchPendingCount();

//     // الاستماع للحدث المخصص لتحديث العداد (يُرسل من CashierPage و EditBill)
//     const handlePendingUpdate = () => {
//       fetchPendingCount();
//     };
//     window.addEventListener('pendingCountUpdated', handlePendingUpdate);
    
//     // تحديث العدد عند تغيير المسار (مثلاً العودة من صفحة الفواتير المعلقة)
//     // يمكن استخدام dependency على location.pathname
//     return () => {
//       window.removeEventListener('pendingCountUpdated', handlePendingUpdate);
//     };
//   }, [location.pathname]); // إعادة التنفيذ عند تغيير المسار

//   // بالإضافة إلى ذلك، يمكن تحديث العدد عند رؤية الصفحة (عند العودة من علامة تبويب أخرى)
//   useEffect(() => {
//     const handleVisibilityChange = () => {
//       if (document.visibilityState === 'visible') {
//         fetchPendingCount();
//       }
//     };
//     document.addEventListener('visibilitychange', handleVisibilityChange);
//     return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
//   }, []);

//   const DropdownTrigger = ({ title, icon: Icon, isOpen, onClick }) => (
//     <div
//       className={`nav-item dropdown-trigger ${isOpen ? "active-parent" : ""}`}
//       onClick={onClick}
//     >
//       <div className="nav-icon">
//         <Icon size={20} />
//       </div>
//       <span className="nav-text">{title}</span>
//       <ChevronDown
//         className={`chevron-icon ${isOpen ? "rotate" : ""}`}
//         size={16}
//       />
//     </div>
//   );

//   return (
//     <div
//       className={`dashboard-wrapper ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
//       dir="rtl"
//     >
//       <aside className="main-sidebar">
//         <div className="sidebar-header">
//           <div className="logo-box">
//             <div className="logo-icon">
//               <Box size={24} color="#fff" />
//             </div>
//             <span className="nav-text">فاشون برو</span>
//           </div>
//         </div>

//         <nav className="sidebar-nav">
//           {/* 1. الرئيسية */}
//           <NavLink
//             to="/stats"
//             className={({ isActive }) =>
//               isActive ? "nav-item active" : "nav-item"
//             }
//           >
//             <div className="nav-icon">
//               <LayoutDashboard size={20} />
//             </div>
//             <span className="nav-text">لوحة التحكم</span>
//           </NavLink>

//           {/* 2. قسم المبيعات */}
//           <DropdownTrigger
//             title="المبيعات"
//             icon={ShoppingCart}
//             isOpen={openMenus.sales}
//             onClick={() => toggleMenu("sales")}
//           />
//           {openMenus.sales && (
//             <div className="dropdown-content">
//               <NavLink to="/cashier" className="sub-nav-item">
//                 <Receipt size={16} /> نقطة البيع
//               </NavLink>
//               <NavLink to="/editBill" className="sub-nav-item">
//                 <Edit3 size={16} />  تعديل الفواتير
//               </NavLink>
//               <NavLink to="/salesLog" className="sub-nav-item">
//                 <History size={16} /> سجل الفواتير
//               </NavLink>
//               <NavLink to="/returns" className="sub-nav-item">
//                 <RotateCcw size={16} /> المرتجعات
//               </NavLink>
//               <NavLink to="/pending-invoices" className="sub-nav-item">
//                 <ClipboardList size={16} /> فواتير معلقة
//                 {pendingCount > 0 && (
//                   <span className="pending-badge">{pendingCount}</span>
//                 )}
//               </NavLink>
//               <NavLink to="/deletedInvoices" className="sub-nav-item">
//                 <Trash2 size={16} /> الفواتير المحذوفة
//               </NavLink>
//               <NavLink to="/offers" className="sub-nav-item">
//                 <Percent size={16} /> العروض والخصومات
//               </NavLink>
//             </div>
//           )}

//           {/* 3. المخازن والمنتجات */}
//           <DropdownTrigger
//             title="المخزون"
//             icon={Box}
//             isOpen={openMenus.inventory}
//             onClick={() => toggleMenu("inventory")}
//           />
//           {openMenus.inventory && (
//             <div className="dropdown-content">
//               <NavLink to="/products" className="sub-nav-item">
//                 <Tags size={16} /> قائمة الملابس
//               </NavLink>
//               <NavLink to="/categories" className="sub-nav-item">
//                 <Layers size={16} /> التصنيفات
//               </NavLink>
//               <NavLink to="/suppliers" className="sub-nav-item">
//                 <Truck size={16} /> الموردين
//               </NavLink>
//               <NavLink to="/purchases" className="sub-nav-item">
//                 <ShoppingCart size={16} /> المشتريات
//               </NavLink>
//               <NavLink to="/inventory" className="sub-nav-item">
//                 <PackageSearch size={16} /> جرد المخزن
//               </NavLink>
//               <NavLink to="/barcode" className="sub-nav-item">
//                 <Barcode size={16} /> طباعة الباركود
//               </NavLink>
//             </div>
//           )}

//           {/* المالية */}
//           <DropdownTrigger
//             title="المالية"
//             icon={Wallet}
//             isOpen={openMenus.accounting}
//             onClick={() => toggleMenu("accounting")}
//           />
//           {openMenus.accounting && (
//             <div className="dropdown-content">
//               <NavLink to="/safe" className="sub-nav-item">
//                 <Wallet size={16} /> حركة الخزينة
//               </NavLink>
//               <NavLink to="/installments" className="sub-nav-item">
//                 <HandCoins size={16} /> تحصيل الأقساط
//               </NavLink>
//               <NavLink to="/expenses" className="sub-nav-item">
//                 <TrendingDown size={16} /> المصروفات
//               </NavLink>
//               <NavLink to="/supplier-payments" className="sub-nav-item">
//                 <Truck size={16} /> مستحقات الموردين
//               </NavLink>
//             </div>
//           )}

//           {/* 5. الأشخاص */}
//           <DropdownTrigger
//             title="الأشخاص"
//             icon={Users}
//             isOpen={openMenus.people}
//             onClick={() => toggleMenu("people")}
//           />
//           {openMenus.people && (
//             <div className="dropdown-content">
//               <NavLink to="/customers" className="sub-nav-item">
//                 <UserCheck size={16} /> العملاء
//               </NavLink>
//               <NavLink to="/attendance" className="sub-nav-item">
//                 <CheckIcon size={16} /> الحضور والانصراف
//               </NavLink>
//               {currentUser?.role === "Admin" && (
//                 <NavLink to="/accounts" className="sub-nav-item">
//                   <Users size={16} /> الموظفين والصلاحيات
//                 </NavLink>
//               )}
//             </div>
//           )}

//           {/* 6. التقارير */}
//           <DropdownTrigger
//             title="التقارير"
//             icon={BarChart3}
//             isOpen={openMenus.reports}
//             onClick={() => toggleMenu("reports")}
//           />
//           {openMenus.reports && (
//             <div className="dropdown-content">
//               <NavLink to="/reports/daily" className="sub-nav-item">
//                 التقرير اليومي
//               </NavLink>
//               <NavLink to="/reports/top-selling" className="sub-nav-item">
//                 الأكثر مبيعاً
//               </NavLink>
// <NavLink to="/reports/product-performance" className="sub-nav-item">
//   <Package size={16} /> أداء المنتجات
// </NavLink>
// <NavLink to="/reports/profit-loss" className="sub-nav-item">
//   <TrendingDown size={16} /> تقرير الأرباح والخسائر
// </NavLink>
//               <NavLink to="/reports/stock-alerts" className="sub-nav-item">
//                 تقارير النواقص
//               </NavLink>
//               <NavLink to="/commission-report" className="sub-nav-item">
//                 <TrendingUp size={16} /> تقرير العمولة
//               </NavLink>
//             </div>
//           )}

//           <NavLink
//             to="/settings"
//             className={({ isActive }) =>
//               isActive ? "nav-item active" : "nav-item"
//             }
//           >
//             <div className="nav-icon">
//               <Settings size={20} />
//             </div>
//             <span className="nav-text">الإعدادات</span>
//           </NavLink>
//         </nav>

//         <div className="sidebar-footer">
//           <button className="logout-btn" onClick={onLogout}>
//             <span className="nav-text">تسجيل الخروج</span>
//             <LogOut size={20} />
//           </button>
//         </div>
//       </aside>

//       <main className="content-area">
//         <header className="top-navbar">
//           <button
//             className="toggle-btn"
//             onClick={() => setSidebarOpen(!isSidebarOpen)}
//           >
//             {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
//           </button>
//           <div className="user-profile-nav">
//             <div className="user-info">
//               <span className="user-name">
//                 {currentUser?.username || "أحمد"}
//               </span>
//               <span className="user-role">
//                 {currentUser?.role === "Admin" ? "مدير النظام" : "كاشير"}
//               </span>
//             </div>
//             <div className="user-avatar">
//               {currentUser?.username?.charAt(0).toUpperCase() || "A"}
//             </div>
//           </div>
//         </header>
//         <div className="page-content-wrapper">
//           <Outlet />
//         </div>
//       </main>

//       <style jsx>{`
//         .pending-badge {
//           background-color: #ef4444;
//           color: white;
//           border-radius: 9999px;
//           padding: 0px 8px;
//           font-size: 11px;
//           font-weight: bold;
//           margin-right: 8px;
//           display: inline-flex;
//           align-items: center;
//           justify-content: center;
//           min-width: 20px;
//           height: 20px;
//         }
//       `}</style>
//     </div>
//   );
// };

// export default DashboardLayout;

import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Box,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Receipt,
  UserCheck,
  Wallet,
  Percent,
  Truck,
  RotateCcw,
  PackageSearch,
  Tags,
  History,
  Trash2,
  Barcode,
  ClipboardList,
  TrendingDown,
  Layers,
  Edit3,
  HandCoins,
  CheckIcon,
  TrendingUp,
  Package,
} from "lucide-react";
import { getDb } from "../lib/db";

const DashboardLayout = ({ onLogout, currentUser }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();

  const [openMenus, setOpenMenus] = useState({
    sales: true,
    inventory: false,
    people: false,
    reports: false,
    accounting: false,
  });

  const toggleMenu = (menu) => {
    setOpenMenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const fetchPendingCount = async () => {
    try {
      const db = await getDb();
      const result = await db.select(
        "SELECT COUNT(*) as count FROM invoices WHERE status = 'pending'"
      );
      setPendingCount(result[0]?.count || 0);
    } catch (error) {
      console.error("Error fetching pending count:", error);
    }
  };

  useEffect(() => {
    fetchPendingCount();
    const handlePendingUpdate = () => fetchPendingCount();
    window.addEventListener('pendingCountUpdated', handlePendingUpdate);
    
    return () => {
      window.removeEventListener('pendingCountUpdated', handlePendingUpdate);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPendingCount();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const DropdownTrigger = ({ title, icon: Icon, isOpen, onClick }) => (
    <div
      className={`nav-item dropdown-trigger ${isOpen ? "parent-active" : ""}`}
      onClick={onClick}
    >
      <div className="nav-icon-wrapper">
        <Icon size={18} className="nav-icon" />
      </div>
      <span className="nav-text">{title}</span>
      <ChevronDown
        className={`chevron-icon ${isOpen ? "rotate" : ""}`}
        size={14}
      />
    </div>
  );

  return (
    <div className={`dashboard-container ${isSidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"}`} dir="rtl">
      {/* الشريط الجانبي */}
      <aside className="cyber-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Box size={22} className="logo-svg" />
          </div>
          <span className="brand-name">فاشون برو</span>
        </div>

        <nav className="sidebar-navigation">
          {/* الرئيسية */}
          <NavLink
            to="/stats"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <div className="nav-icon-wrapper">
              <LayoutDashboard size={18} />
            </div>
            <span className="nav-text">لوحة التحكم</span>
          </NavLink>

          {/* قسم المبيعات */}
          <DropdownTrigger
            title="المبيعات"
            icon={ShoppingCart}
            isOpen={openMenus.sales}
            onClick={() => toggleMenu("sales")}
          />
          <div className={`dropdown-wrapper ${openMenus.sales ? "menu-open" : "menu-closed"}`}>
            <div className="dropdown-inner">
              <NavLink to="/cashier" className="sub-nav-item">
                <Receipt size={14} /> <span>نقطة البيع</span>
              </NavLink>
              <NavLink to="/editBill" className="sub-nav-item">
                <Edit3 size={14} /> <span>تعديل الفواتير</span>
              </NavLink>
              <NavLink to="/salesLog" className="sub-nav-item">
                <History size={14} /> <span>سجل الفواتير</span>
              </NavLink>
              <NavLink to="/returns" className="sub-nav-item">
                <RotateCcw size={14} /> <span>المرتجعات</span>
              </NavLink>
              <NavLink to="/pending-invoices" className="sub-nav-item justify-between">
                <div className="flex-layout">
                  <ClipboardList size={14} /> <span>فواتير معلقة</span>
                </div>
                {pendingCount > 0 && (
                  <span className="pending-badge">{pendingCount}</span>
                )}
              </NavLink>
              <NavLink to="/deletedInvoices" className="sub-nav-item">
                <Trash2 size={14} /> <span>الفواتير المحذوفة</span>
              </NavLink>
              <NavLink to="/offers" className="sub-nav-item">
                <Percent size={14} /> <span>العروض والخصومات</span>
              </NavLink>
            </div>
          </div>

          {/* المخزون */}
          <DropdownTrigger
            title="المخزون"
            icon={Box}
            isOpen={openMenus.inventory}
            onClick={() => toggleMenu("inventory")}
          />
          <div className={`dropdown-wrapper ${openMenus.inventory ? "menu-open" : "menu-closed"}`}>
            <div className="dropdown-inner">
              <NavLink to="/products" className="sub-nav-item">
                <Tags size={14} /> <span>قائمة الملابس</span>
              </NavLink>
              <NavLink to="/categories" className="sub-nav-item">
                <Layers size={14} /> <span>التصنيفات</span>
              </NavLink>
              <NavLink to="/suppliers" className="sub-nav-item">
                <Truck size={14} /> <span>الموردين</span>
              </NavLink>
              <NavLink to="/purchases" className="sub-nav-item">
                <ShoppingCart size={14} /> <span>المشتريات</span>
              </NavLink>
              <NavLink to="/inventory" className="sub-nav-item">
                <PackageSearch size={14} /> <span>جرد المخزن</span>
              </NavLink>
              <NavLink to="/barcode" className="sub-nav-item">
                <Barcode size={14} /> <span>طباعة الباركود</span>
              </NavLink>
            </div>
          </div>

          {/* المالية */}
          <DropdownTrigger
            title="المالية"
            icon={Wallet}
            isOpen={openMenus.accounting}
            onClick={() => toggleMenu("accounting")}
          />
          <div className={`dropdown-wrapper ${openMenus.accounting ? "menu-open" : "menu-closed"}`}>
            <div className="dropdown-inner">
              <NavLink to="/safe" className="sub-nav-item">
                <Wallet size={14} /> <span>حركة الخزينة</span>
              </NavLink>
              <NavLink to="/installments" className="sub-nav-item">
                <HandCoins size={14} /> <span>تحصيل الأقساط</span>
              </NavLink>
              <NavLink to="/expenses" className="sub-nav-item">
                <TrendingDown size={14} /> <span>المصروفات</span>
              </NavLink>
              <NavLink to="/supplier-payments" className="sub-nav-item">
                <Truck size={14} /> <span>مستحقات الموردين</span>
              </NavLink>
            </div>
          </div>

          {/* الأشخاص */}
          <DropdownTrigger
            title="الأشخاص"
            icon={Users}
            isOpen={openMenus.people}
            onClick={() => toggleMenu("people")}
          />
          <div className={`dropdown-wrapper ${openMenus.people ? "menu-open" : "menu-closed"}`}>
            <div className="dropdown-inner">
              <NavLink to="/customers" className="sub-nav-item">
                <UserCheck size={14} /> <span>العملاء</span>
              </NavLink>
              <NavLink to="/attendance" className="sub-nav-item">
                <CheckIcon size={14} /> <span>الحضور والانصراف</span>
              </NavLink>
              {currentUser?.role === "Admin" && (
                <NavLink to="/accounts" className="sub-nav-item">
                  <Users size={14} /> <span>الموظفين والصلاحيات</span>
                </NavLink>
              )}
            </div>
          </div>

          {/* التقارير */}
          <DropdownTrigger
            title="التقارير"
            icon={BarChart3}
            isOpen={openMenus.reports}
            onClick={() => toggleMenu("reports")}
          />
          <div className={`dropdown-wrapper ${openMenus.reports ? "menu-open" : "menu-closed"}`}>
            <div className="dropdown-inner">
              <NavLink to="/reports/daily" className="sub-nav-item">
                <span>التقرير اليومي</span>
              </NavLink>
              <NavLink to="/reports/monthly" className="sub-nav-item">
                <span>التقرير الشهري</span>
              </NavLink>
              <NavLink to="/reports/top-selling" className="sub-nav-item">
                <span>الأكثر مبيعاً</span>
              </NavLink>
              <NavLink to="/reports/product-performance" className="sub-nav-item">
                <Package size={14} /> <span>أداء المنتجات</span>
              </NavLink>
              <NavLink to="/reports/profit-loss" className="sub-nav-item">
                <TrendingDown size={14} /> <span>تقرير الأرباح والخسائر</span>
              </NavLink>
              <NavLink to="/reports/stock-alerts" className="sub-nav-item">
                <span>تقارير النواقص</span>
              </NavLink>
              <NavLink to="/commission-report" className="sub-nav-item">
                <TrendingUp size={14} /> <span>تقرير العمولة</span>
              </NavLink>
            </div>
          </div>

          {/* الإعدادات */}
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <div className="nav-icon-wrapper">
              <Settings size={18} />
            </div>
            <span className="nav-text">الإعدادات</span>
          </NavLink>
        </nav>

        <div className="sidebar-action-footer">
          <button className="cyber-logout-btn" onClick={onLogout}>
            <LogOut size={18} />
            <span className="nav-text">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* منطقة المحتوى الرئيسي */}
      <main className="main-viewport">
        <header className="glass-navbar">
          <button
            className="navbar-toggle-trigger"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle Sidebar"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="profile-session-widget">
            <div className="profile-details">
              <span className="account-title">
                {currentUser?.username || "أحمد"}
              </span>
              <span className="account-badge">
                {currentUser?.role === "Admin" ? "المشرف العام" : "نقطة البيع"}
              </span>
            </div>
            <div className="avatar-sphere">
              {currentUser?.username?.charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </header>
        
        <div className="dynamic-view-container">
          <Outlet />
        </div>
      </main>

      <style jsx global>{`
        :root {
          --bg-main: #0a0c10;
          --sidebar-bg: rgba(13, 16, 23, 0.75);
          --navbar-bg: rgba(13, 16, 23, 0.65);
          --border-color: rgba(255, 255, 255, 0.06);
          --text-muted: #8b949e;
          --text-bright: #f0f6fc;
          --accent-primary: #38bdf8;
          --accent-glow: rgba(56, 189, 248, 0.15);
          --danger-glow: #f87171;
          --glass-blur: blur(14px);
          --transition-smooth: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body {
          background-color: var(--bg-main);
          color: var(--text-bright);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
        }

        .dashboard-container {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg-main);
          overflow-x: hidden;
        }

        .sidebar-expanded .cyber-sidebar { width: 260px;background: rgb(7, 10, 19); }
        .sidebar-expanded .main-viewport { margin-right: 260px; width: calc(100% - 260px);background: rgb(7, 10, 19); }
        .sidebar-collapsed .cyber-sidebar { width: 68px; }
        .sidebar-collapsed .main-viewport { margin-right: 68px; width: calc(100% - 68px); }
        
        .sidebar-collapsed .nav-text,
        .sidebar-collapsed .brand-name,
        .sidebar-collapsed .chevron-icon,
        .sidebar-collapsed .dropdown-wrapper,
        .sidebar-collapsed .account-title,
        .sidebar-collapsed .account-badge {
          display: none !important;
        }

        .cyber-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          background: var(--sidebar-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border-left: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          z-index: 50;
          transition: var(--transition-smooth);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
        }

        .brand-logo {
          background: linear-gradient(135deg, var(--accent-primary), #0284c7);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.25);
        }

        .brand-name {
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.5px;
          background: linear-gradient(120deg, #fff, #c9d1d9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .sidebar-navigation {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .nav-item {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          text-decoration: none;
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-smooth);
          font-size: 14px;
          user-select: none;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-bright);
        }

        .nav-item.active {
          background: var(--accent-glow);
          color: var(--accent-primary);
          font-weight: 500;
        }

        .nav-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
        }

        .chevron-icon {
          margin-right: auto;
          transition: transform 0.2s ease;
          opacity: 0.6;
        }

        .chevron-icon.rotate {
          transform: rotate(180deg);
          color: var(--accent-primary);
        }

        .dropdown-wrapper {
          display: grid;
          transition: grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .menu-closed { grid-template-rows: 0fr; }
        .menu-open { grid-template-rows: 1fr; }

        .dropdown-inner {
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.04);
        }

        .sub-nav-item {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          text-decoration: none;
          border-radius: 6px;
          font-size: 13px;
          transition: var(--transition-smooth);
        }

        .sub-nav-item:hover, .sub-nav-item.active {
          color: var(--text-bright);
          background: rgba(255, 255, 255, 0.02);
        }
        
        .sub-nav-item.active {
          color: var(--accent-primary);
        }

        .justify-between { justify-content: space-between; }
        .flex-layout { display: flex; align-items: center; }

        .pending-badge {
          background-color: rgba(239, 68, 68, 0.15);
          color: var(--danger-glow);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.1);
        }

        .sidebar-action-footer {
          border-top: 1px solid var(--border-color);
          padding: 12px;
        }

        .cyber-logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          background: rgba(248, 113, 113, 0.08);
          border: none;
          color: #f87171;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: var(--transition-smooth);
          padding: 8px;
          gap: 8px;
          justify-content: center;
        }

        .cyber-logout-btn:hover {
          background: rgba(248, 113, 113, 0.15);
        }

        .main-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: var(--transition-smooth);
          overflow: auto;
        }

        .glass-navbar {
          background: rgb(7, 10, 19);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 40;
          padding: 17px;
    margin: 0 0px 10px 0;
        }

        .navbar-toggle-trigger {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .navbar-toggle-trigger:hover {
          color: var(--text-bright);
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.02);
        }

        .profile-session-widget {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 30px;
          border: 1px solid var(--border-color);
              padding: 6px 10px;
        }

        .profile-details {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.3;
        }

        .account-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-bright);
        }

        .account-badge {
          font-size: 11px;
          color: var(--text-muted);
        }

        .avatar-sphere {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--accent-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .dynamic-view-container {
          flex: 1;
        }

        .sidebar-navigation::-webkit-scrollbar { width: 4px; }
        .sidebar-navigation::-webkit-scrollbar-track { background: transparent; }
        .sidebar-navigation::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default DashboardLayout;