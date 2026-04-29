import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import DashboardLayout from "./layouts/DashboardLayout";
import AccountsPage from "./pages/AccountsPage";
import SettingsPage from "./pages/SettingsPage";
import Login from "./pages/Login";

import './App.css';
import ProductsPage from "./pages/ProductsPage";
import CashierPage from "./pages/CashierPage";
import SalesLog from "./pages/SalesLog";
import StatsPage from "./pages/StatsPage";
import ReturnsPage from "./pages/ReturnsPage";
import DeletedInvoices from "./pages/DeletedInvoices";
import CategoriesPage from "./pages/CategoriesPage";
import InventoryPage from "./pages/InventoryPage";
import EditBill from "./pages/EditBill";
import InstallmentCollection from "./pages/InstallmentCollection";
import CustomersPage from "./pages/CustomersPage";
import BarcodePrintPage from "./pages/BarcodePrintPage";
import ExpensesPage from "./pages/ExpensesPage";
import AttendancePage from "./pages/AttendancePage";

import PurchasesPage from "./pages/PurchasesPage";
import SuppliersPage from "./pages/SuppliersPage";

function App() {
  // 1. استرجاع بيانات اليوزر من المتصفح عند التحميل لأول مرة
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("cc_auth") === "true";
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("cc_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const handleLoginSuccess = (user) => {
    if (!user) {
      console.error("Login Error: No user data received");
      return;
    }

    // 2. حفظ الحالة في الـ State وفي الـ LocalStorage
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem("cc_auth", "true");
    localStorage.setItem("cc_user", JSON.stringify(user));

    const name = user?.username || "مستخدم"; 
    showToast(`أهلاً بك يا ${name}`, "success");
  };

  const handleLogout = () => {
    // 3. مسح البيانات عند تسجيل الخروج
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem("cc_auth");
    localStorage.removeItem("cc_user");
    showToast("تم تسجيل الخروج بنجاح", "info");
  };

  return (
    <Router>
      {toast.show && (
        <div className={`toast-container toast-${toast.type} animate-fade-in`}>
          {toast.message}
        </div>
      )}

      <Routes>
        <Route 
          path="/login" 
element={!isAuthenticated ? <Login onLogin={handleLoginSuccess} showToast={showToast} /> : <Navigate replace to="/stats" />}        />

        <Route 
          path="/" 
          element={isAuthenticated ? <DashboardLayout onLogout={handleLogout} currentUser={currentUser} /> : <Navigate replace to="/login" />}
        >
          <Route index element={<Navigate replace to="/stats" />} />
          
          <Route path="accounts" element={<AccountsPage showToast={showToast} />} />
          <Route path="products" element={<ProductsPage showToast={showToast} />} />
          <Route path="cashier" element={<CashierPage showToast={showToast} />} />
          <Route path="salesLog" element={<SalesLog showToast={showToast} />} />
          <Route path="returns" element={<ReturnsPage showToast={showToast} />} />
          <Route path="installments" element={<InstallmentCollection showToast={showToast} />} />
          <Route path="deletedInvoices" element={<DeletedInvoices showToast={showToast} />} />
          <Route path="categories" element={<CategoriesPage showToast={showToast} />} />
          <Route path="customers" element={<CustomersPage showToast={showToast} />} />
          <Route path="barcode" element={<BarcodePrintPage showToast={showToast} />} />
          <Route path="expenses" element={<ExpensesPage showToast={showToast} />} />
          <Route path="attendance" element={<AttendancePage showToast={showToast} />} />
          <Route path="inventory" element={<InventoryPage showToast={showToast} />} />
          <Route path="editBill" element={<EditBill showToast={showToast} />} />
          <Route path="settings" element={<SettingsPage showToast={showToast} />} />
          <Route path="stats" element={<StatsPage showToast={showToast} />} />

          <Route path="/suppliers" element={<SuppliersPage showToast={showToast} />} />
          <Route path="/purchases" element={<PurchasesPage showToast={showToast} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;