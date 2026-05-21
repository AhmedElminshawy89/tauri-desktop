import React, { useEffect, useState, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Plus, Search, Trash2, Calendar, 
  X, Tag, Receipt, RefreshCcw, 
  AlertCircle, ChevronLeft
} from "lucide-react";

// --- Helpers ---
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";
const fmtDate = (d) => new Date(d).toLocaleDateString("ar-EG", {
  year: 'numeric', month: 'long', day: 'numeric'
});

const ExpensesPage = ({ showToast }) => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [modalType, setModalType] = useState(null); 
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    amount: "", category_id: "", note: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [catName, setCatName] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const expRes = await db.select(`
        SELECT e.*, ec.name as category_name 
        FROM expenses e
        LEFT JOIN expense_categories ec ON e.category_id = ec.id
        ORDER BY e.expense_date DESC
      `);
      const catRes = await db.select("SELECT * FROM expense_categories ORDER BY name ASC");
      setExpenses(expRes || []);
      setCategories(catRes || []);
    } catch (err) {
      showToast?.("خطأ في تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = e.note?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === "all" || e.category_id === parseInt(filterCategory);
      const expDate = new Date(e.expense_date).getTime();
      const start = startDate ? new Date(startDate).getTime() : null;
      const end = endDate ? new Date(endDate).getTime() : null;
      return matchSearch && matchCat && (!start || expDate >= start) && (!end || expDate <= end);
    });
  }, [expenses, searchTerm, filterCategory, startDate, endDate]);

  const stats = useMemo(() => {
    const totalFiltered = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const thisMonth = expenses.filter(e => {
        const d = new Date(e.expense_date);
        return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
    }).reduce((s, e) => s + Number(e.amount), 0);
    return { totalFiltered, thisMonth, count: filteredExpenses.length };
  }, [filteredExpenses, expenses]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.category_id) return showToast?.("برجاء إدخال المبلغ والفئة", "error");
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO expenses (amount, category_id, note, expense_date) VALUES ($1, $2, $3, $4)",
        [expenseForm.amount, expenseForm.category_id, expenseForm.note, expenseForm.date]
      );
      showToast?.("تم تسجيل المصروف بنجاح", "success");
      setModalType(null);
      setExpenseForm({ amount: "", category_id: "", note: "", date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch { showToast?.("حدث خطأ أثناء الحفظ", "error"); }
  };

  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    try {
      const db = await getDb();
      await db.execute("INSERT INTO expense_categories (name) VALUES ($1)", [catName]);
      showToast?.("تمت إضافة الفئة الجديدة", "success");
      setCatName("");
      fetchData();
    } catch { showToast?.("هذه الفئة موجودة بالفعل", "error"); }
  };

  const confirmDeleteExpense = async () => {
    if (!selectedExpense) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM expenses WHERE id = $1", [selectedExpense.id]);
      showToast?.("تم الحذف بنجاح", "success");
      setModalType(null);
      setSelectedExpense(null);
      fetchData();
    } catch { showToast?.("فشل عملية الحذف", "error"); }
  };

  const openDeleteCategoryModal = (cat) => {
    const isUsed = expenses.some(e => e.category_id === cat.id);
    if (isUsed) return showToast?.("لا يمكن حذف الفئة لأنها تحتوي على مصروفات مسجلة", "error");
    setSelectedCategory(cat);
    setModalType("deleteCategoryConfirm");
  };

  const confirmDeleteCategory = async () => {
    if (!selectedCategory) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM expense_categories WHERE id = $1", [selectedCategory.id]);
      showToast?.("تم حذف الفئة بنجاح", "success");
      setModalType("addCategory");
      setSelectedCategory(null);
      fetchData();
    } catch { showToast?.("خطأ في الحذف", "error"); }
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
        .card-expense-red .stat-glow { background: #ef4444; }
        .card-expense-blue .stat-glow { background: #3b82f6; }
        .card-expense-cyan .stat-glow { background: #06b6d4; }
        .stat-content { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
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
        .card-expense-red .icon-box { color: #f87171; background: rgba(239,68,68,0.1); }
        .card-expense-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-expense-cyan .icon-box { color: #22d3ee; background: rgba(6,182,212,0.1); }
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
        .expense-item {
          background: rgba(22,27,44,0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s;
        }
        .expense-item:hover {
          background: rgba(30,41,59,0.7);
          border-color: rgba(59,130,246,0.3);
        }
        .expense-amount {
          font-size: 16px;
          font-weight: 700;
          color: #f87171;
        }
        .expense-category-badge {
          background: rgba(255,255,255,0.05);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          color: #94a3b8;
        }
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
          max-width: 480px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
        }
        .modal-cyber-header {
          padding: 18px 24px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-cyber-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: white; }
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .cyber-form { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .cyber-input-group { display: flex; flex-direction: column; gap: 8px; }
        .cyber-input-group label { font-size: 13px; color: #94a3b8; }
        .cyber-input-group input, .cyber-input-group select, .cyber-input-group textarea {
          background: #070a12;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 12px;
          color: white;
          font-size: 14px;
          transition: border 0.2s ease;
        }
        .cyber-input-group input:focus, .cyber-input-group select:focus, .cyber-input-group textarea:focus {
          border-color: #2563eb;
          outline: none;
        }
        .cyber-modal-actions { display: flex; gap: 12px; margin-top: 8px; }
        .cyber-btn-submit { flex: 1; padding: 12px; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-submit.danger-bg { background: #ef4444; }
        .cyber-btn-submit.danger-bg:hover { background: #dc2626; }
        .cyber-btn-dismiss { padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #94a3b8; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-dismiss:hover { background: #334155; color: white; }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">إدارة المصروفات</h2>
          <p className="sub-title">تتبع جميع المصاريف التشغيلية للمحل</p>
        </div>
        <div className="header-actions-group">
          <button onClick={() => setModalType("addCategory")} className="btn-action-neon btn-secondary">
            <Tag size={18} /> الفئات
          </button>
          <button onClick={() => setModalType("addExpense")} className="btn-action-neon btn-primary">
            <Plus size={18} /> إضافة مصروف
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-expense-red">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Receipt size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي مصروفات الشهر</div>
              <div className="stat-value" style={{ color: "#f87171" }}>{fmt(stats.thisMonth)}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-expense-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Search size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي البحث الحالي</div>
              <div className="stat-value" style={{ color: "#60a5fa" }}>{fmt(stats.totalFiltered)}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-expense-cyan">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Calendar size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي الفترة المختارة</div>
              <div className="stat-value" style={{ color: "#22d3ee" }}>{fmt(stats.totalFiltered)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="premium-control-bar">
        <div className="search-neon-wrapper" style={{ flex: 2 }}>
          <input
            type="text"
            placeholder="بحث في الملاحظات أو الفئات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-neon-input"
            style={{ width: "100%" }}
          />
          <Search size={18} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="search-neon-input"
          style={{ width: "180px" }}
        >
          <option value="all">جميع الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="search-neon-input"
            style={{ width: "140px" }}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="search-neon-input"
            style={{ width: "140px" }}
          />
        </div>
        <button
          onClick={() => { setSearchTerm(""); setFilterCategory("all"); setStartDate(""); setEndDate(""); }}
          className="btn-action-neon btn-secondary"
        >
          <RefreshCcw size={18} />
        </button>
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="cyber-table-container" style={{ textAlign: "center", padding: "60px" }}>
          <div className="loader">جاري تحميل البيانات...</div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="cyber-table-container" style={{ textAlign: "center", padding: "60px", color: "#64748b", border: "2px dashed rgba(255,255,255,0.05)" }}>
          لا توجد مصروفات مسجلة تطابق بحثك
        </div>
      ) : (
        <div className="cyber-table-container" style={{ padding: "0" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Receipt size={18} /> سجل المصروفات
            </div>
          </div>
          {filteredExpenses.map(exp => (
            <div key={exp.id} className="expense-item">
              <div style={{ display: "flex", gap: "15px", alignItems: "center", flex: 1 }}>
                <div className="icon-box" style={{ width: "40px", height: "40px", background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span className="expense-amount">{fmt(exp.amount)}</span>
                    <span className="expense-category-badge">{exp.category_name}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{exp.note || "لا توجد ملاحظات"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{fmtDate(exp.expense_date)}</span>
                <button
                  onClick={() => { setSelectedExpense(exp); setModalType("deleteConfirm"); }}
                  className="cyber-btn-mini delete"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", width: "32px", height: "32px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Expense */}
      {modalType === "addExpense" && (
        <div className="blur-overlay" onClick={() => setModalType(null)}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>تسجيل مصروف جديد</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="cyber-form">
                <div className="cyber-input-group">
                  <label>المبلغ</label>
                  <input type="number" placeholder="المبلغ" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
                </div>
                <div className="cyber-input-group">
                  <label>الفئة</label>
                  <select required value={expenseForm.category_id} onChange={e => setExpenseForm({...expenseForm, category_id: e.target.value})}>
                    <option value="">اختر الفئة...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="cyber-input-group">
                  <label>التاريخ</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
                </div>
                <div className="cyber-input-group">
                  <label>ملاحظات</label>
                  <textarea rows="3" placeholder="ملاحظات..." value={expenseForm.note} onChange={e => setExpenseForm({...expenseForm, note: e.target.value})} />
                </div>
                <div className="cyber-modal-actions">
                  <button type="submit" className="cyber-btn-submit danger-bg" style={{ background: "#ef4444" }}>حفظ العملية</button>
                  <button type="button" className="cyber-btn-dismiss" onClick={() => setModalType(null)}>إلغاء</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Categories */}
      {modalType === "addCategory" && (
        <div className="blur-overlay" onClick={() => setModalType(null)}>
          <div className="cyber-modal" style={{ maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>إدارة فئات المصروفات</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className="cyber-form">
              <div style={{ display: "flex", gap: "10px" }}>
                <input type="text" placeholder="اسم الفئة الجديدة..." value={catName} onChange={e => setCatName(e.target.value)} className="search-neon-input" style={{ flex: 1 }} />
                <button onClick={handleAddCategory} className="cyber-btn-submit" style={{ flex: "none", padding: "12px 20px" }}>إضافة</button>
              </div>
              <div style={{ maxHeight: "250px", overflowY: "auto", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px", marginTop: "8px" }}>
                {categories.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{c.name}</span>
                    <button onClick={() => openDeleteCategoryModal(c)} className="cyber-btn-mini delete" style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>لا توجد فئات بعد</div>}
              </div>
              <div className="cyber-modal-actions">
                <button type="button" className="cyber-btn-dismiss" onClick={() => setModalType(null)}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Expense */}
      {modalType === "deleteConfirm" && (
        <div className="blur-overlay" onClick={() => setModalType(null)}>
          <div className="cyber-modal" style={{ maxWidth: "380px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3 style={{ color: "#f87171" }}>تأكيد الحذف</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className="cyber-form" style={{ textAlign: "center" }}>
              <AlertCircle size={48} style={{ color: "#f87171", margin: "0 auto 16px" }} />
              <p style={{ fontSize: "14px", color: "#94a3b8" }}>هل أنت متأكد من حذف هذا المصروف بقيمة <strong style={{ color: "#f87171" }}>{fmt(selectedExpense?.amount)}</strong>؟</p>
              <div className="cyber-modal-actions">
                <button onClick={confirmDeleteExpense} className="cyber-btn-submit danger-bg">حذف نهائي</button>
                <button onClick={() => setModalType(null)} className="cyber-btn-dismiss">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Category */}
      {modalType === "deleteCategoryConfirm" && (
        <div className="blur-overlay" onClick={() => setModalType("addCategory")}>
          <div className="cyber-modal" style={{ maxWidth: "380px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3 style={{ color: "#f87171" }}>حذف الفئة</h3>
              <button className="modal-close-btn" onClick={() => setModalType("addCategory")}><X size={18} /></button>
            </div>
            <div className="cyber-form" style={{ textAlign: "center" }}>
              <AlertCircle size={48} style={{ color: "#f87171", margin: "0 auto 16px" }} />
              <p style={{ fontSize: "14px", color: "#94a3b8" }}>هل أنت متأكد من حذف فئة <strong style={{ color: "#f87171" }}>"{selectedCategory?.name}"</strong>؟</p>
              <div className="cyber-modal-actions">
                <button onClick={confirmDeleteCategory} className="cyber-btn-submit danger-bg">تأكيد الحذف</button>
                <button onClick={() => setModalType("addCategory")} className="cyber-btn-dismiss">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;