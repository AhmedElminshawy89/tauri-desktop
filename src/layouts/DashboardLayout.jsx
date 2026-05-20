import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom"; // أضف useLocation
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
} from "lucide-react";
import { getDb } from "../lib/db";

const DashboardLayout = ({ onLogout, currentUser }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation(); // للحصول على المسار الحالي

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

  // جلب عدد الفواتير المعلقة من قاعدة البيانات
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

  // تحديث العدد عند تحميل المكون وعند أي تغيير في الفواتير (عبر الحدث المخصص)
  useEffect(() => {
    fetchPendingCount();

    // الاستماع للحدث المخصص لتحديث العداد (يُرسل من CashierPage و EditBill)
    const handlePendingUpdate = () => {
      fetchPendingCount();
    };
    window.addEventListener('pendingCountUpdated', handlePendingUpdate);
    
    // تحديث العدد عند تغيير المسار (مثلاً العودة من صفحة الفواتير المعلقة)
    // يمكن استخدام dependency على location.pathname
    return () => {
      window.removeEventListener('pendingCountUpdated', handlePendingUpdate);
    };
  }, [location.pathname]); // إعادة التنفيذ عند تغيير المسار

  // بالإضافة إلى ذلك، يمكن تحديث العدد عند رؤية الصفحة (عند العودة من علامة تبويب أخرى)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPendingCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const DropdownTrigger = ({ title, icon: Icon, isOpen, onClick }) => (
    <div
      className={`nav-item dropdown-trigger ${isOpen ? "active-parent" : ""}`}
      onClick={onClick}
    >
      <div className="nav-icon">
        <Icon size={20} />
      </div>
      <span className="nav-text">{title}</span>
      <ChevronDown
        className={`chevron-icon ${isOpen ? "rotate" : ""}`}
        size={16}
      />
    </div>
  );

  return (
    <div
      className={`dashboard-wrapper ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      dir="rtl"
    >
      <aside className="main-sidebar">
        <div className="sidebar-header">
          <div className="logo-box">
            <div className="logo-icon">
              <Box size={24} color="#fff" />
            </div>
            <span className="nav-text">فاشون برو</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* 1. الرئيسية */}
          <NavLink
            to="/stats"
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
          >
            <div className="nav-icon">
              <LayoutDashboard size={20} />
            </div>
            <span className="nav-text">لوحة التحكم</span>
          </NavLink>

          {/* 2. قسم المبيعات */}
          <DropdownTrigger
            title="المبيعات"
            icon={ShoppingCart}
            isOpen={openMenus.sales}
            onClick={() => toggleMenu("sales")}
          />
          {openMenus.sales && (
            <div className="dropdown-content">
              <NavLink to="/cashier" className="sub-nav-item">
                <Receipt size={16} /> نقطة البيع
              </NavLink>
              <NavLink to="/editBill" className="sub-nav-item">
                <Edit3 size={16} />  تعديل الفواتير
              </NavLink>
              <NavLink to="/salesLog" className="sub-nav-item">
                <History size={16} /> سجل الفواتير
              </NavLink>
              <NavLink to="/returns" className="sub-nav-item">
                <RotateCcw size={16} /> المرتجعات
              </NavLink>
              <NavLink to="/pending-invoices" className="sub-nav-item">
                <ClipboardList size={16} /> فواتير معلقة
                {pendingCount > 0 && (
                  <span className="pending-badge">{pendingCount}</span>
                )}
              </NavLink>
              <NavLink to="/deletedInvoices" className="sub-nav-item">
                <Trash2 size={16} /> الفواتير المحذوفة
              </NavLink>
              <NavLink to="/offers" className="sub-nav-item">
                <Percent size={16} /> العروض والخصومات
              </NavLink>
            </div>
          )}

          {/* 3. المخازن والمنتجات */}
          <DropdownTrigger
            title="المخزون"
            icon={Box}
            isOpen={openMenus.inventory}
            onClick={() => toggleMenu("inventory")}
          />
          {openMenus.inventory && (
            <div className="dropdown-content">
              <NavLink to="/products" className="sub-nav-item">
                <Tags size={16} /> قائمة الملابس
              </NavLink>
              <NavLink to="/categories" className="sub-nav-item">
                <Layers size={16} /> التصنيفات
              </NavLink>
              <NavLink to="/suppliers" className="sub-nav-item">
                <Truck size={16} /> الموردين
              </NavLink>
              <NavLink to="/purchases" className="sub-nav-item">
                <ShoppingCart size={16} /> المشتريات
              </NavLink>
              <NavLink to="/inventory" className="sub-nav-item">
                <PackageSearch size={16} /> جرد المخزن
              </NavLink>
              <NavLink to="/barcode" className="sub-nav-item">
                <Barcode size={16} /> طباعة الباركود
              </NavLink>
            </div>
          )}

          {/* المالية */}
          <DropdownTrigger
            title="المالية"
            icon={Wallet}
            isOpen={openMenus.accounting}
            onClick={() => toggleMenu("accounting")}
          />
          {openMenus.accounting && (
            <div className="dropdown-content">
              <NavLink to="/safe" className="sub-nav-item">
                <Wallet size={16} /> حركة الخزينة
              </NavLink>
              <NavLink to="/installments" className="sub-nav-item">
                <HandCoins size={16} /> تحصيل الأقساط
              </NavLink>
              <NavLink to="/expenses" className="sub-nav-item">
                <TrendingDown size={16} /> المصروفات
              </NavLink>
              <NavLink to="/supplier-payments" className="sub-nav-item">
                <Truck size={16} /> مستحقات الموردين
              </NavLink>
            </div>
          )}

          {/* 5. الأشخاص */}
          <DropdownTrigger
            title="الأشخاص"
            icon={Users}
            isOpen={openMenus.people}
            onClick={() => toggleMenu("people")}
          />
          {openMenus.people && (
            <div className="dropdown-content">
              <NavLink to="/customers" className="sub-nav-item">
                <UserCheck size={16} /> العملاء
              </NavLink>
              <NavLink to="/attendance" className="sub-nav-item">
                <CheckIcon size={16} /> الحضور والانصراف
              </NavLink>
              {currentUser?.role === "Admin" && (
                <NavLink to="/accounts" className="sub-nav-item">
                  <Users size={16} /> الموظفين والصلاحيات
                </NavLink>
              )}
            </div>
          )}

          {/* 6. التقارير */}
          <DropdownTrigger
            title="التقارير"
            icon={BarChart3}
            isOpen={openMenus.reports}
            onClick={() => toggleMenu("reports")}
          />
          {openMenus.reports && (
            <div className="dropdown-content">
              <NavLink to="/reports/daily" className="sub-nav-item">
                التقرير اليومي
              </NavLink>
              <NavLink to="/reports/profits" className="sub-nav-item">
                الأرباح والخسائر
              </NavLink>
              <NavLink to="/reports/top-selling" className="sub-nav-item">
                الأكثر مبيعاً
              </NavLink>
              <NavLink to="/reports/stock-alerts" className="sub-nav-item">
                تقارير النواقص
              </NavLink>
              <NavLink to="/commission-report" className="sub-nav-item">
                <TrendingUp size={16} /> تقرير العمولة
              </NavLink>
            </div>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
          >
            <div className="nav-icon">
              <Settings size={20} />
            </div>
            <span className="nav-text">الإعدادات</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <span className="nav-text">تسجيل الخروج</span>
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="content-area">
        <header className="top-navbar">
          <button
            className="toggle-btn"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="user-profile-nav">
            <div className="user-info">
              <span className="user-name">
                {currentUser?.username || "أحمد"}
              </span>
              <span className="user-role">
                {currentUser?.role === "Admin" ? "مدير النظام" : "كاشير"}
              </span>
            </div>
            <div className="user-avatar">
              {currentUser?.username?.charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </header>
        <div className="page-content-wrapper">
          <Outlet />
        </div>
      </main>

      <style jsx>{`
        .pending-badge {
          background-color: #ef4444;
          color: white;
          border-radius: 9999px;
          padding: 0px 8px;
          font-size: 11px;
          font-weight: bold;
          margin-right: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
        }
      `}</style>
    </div>
  );
};

export default DashboardLayout;