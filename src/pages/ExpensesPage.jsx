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
  
  // Modals: addExpense | addCategory | deleteConfirm (expense) | deleteCategoryConfirm
  const [modalType, setModalType] = useState(null); 
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Forms State
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

  // --- Logic: Filtering ---
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

  // --- Actions ---
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
    <div dir="rtl" className="page-container animate-fade-in" style={{ padding: "25px", color: "white", minHeight: "100vh" ,background:'#0f172a'}}>
      
      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 style={{ fontSize: "24px", fontWeight: "800", margin: 0 }}>إدارة المصروفات</h2>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "5px" }}>تتبع جميع المصاريف التشغيلية للمحل</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => setModalType("addCategory")} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 15px", borderRadius: "12px", border: "1px solid #2d364f", color: "#94a3b8", cursor: "pointer", background: "#161b2c" }}>
                <Tag size={18} /> الفئات
            </button>
            <button onClick={() => setModalType("addExpense")} className="btn-save">
                <Plus size={18} /> إضافة مصروف
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "20px", padding: "20px" }}>
            <span style={{ color: "#f87171", fontSize: "14px" }}>إجمالي مصروفات الشهر</span>
            <div style={{ fontSize: "28px", fontWeight: "800", marginTop: "10px" }}>{fmt(stats.thisMonth)}</div>
        </div>
        <div style={{ background: "rgba(22, 27, 44, 0.6)", border: "1px solid #2d364f", borderRadius: "20px", padding: "20px" }}>
            <span style={{ color: "#64748b", fontSize: "14px" }}>إجمالي البحث الحالي</span>
            <div style={{ fontSize: "28px", fontWeight: "800", marginTop: "10px", color: "#60a5fa" }}>{fmt(stats.totalFiltered)}</div>
        </div>
        <div style={{ background: "rgba(96, 165, 250, 0.1)", border: "1px solid rgba(96, 165, 250, 0.2)", borderRadius: "20px", padding: "20px" }}>
            <span style={{ color: "#60a5fa", fontSize: "14px" }}>إجمالي الفترة المختارة</span>
            <div style={{ fontSize: "28px", fontWeight: "800", marginTop: "10px" }}>{fmt(stats.totalFiltered)}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ background: "#161b2c", padding: "15px", borderRadius: "15px", border: "1px solid #2d364f", marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: "200px", position: "relative" }}>
            <Search style={{ position: "absolute", right: "12px", top: "12px", color: "#475569" }} size={18} />
            <input 
                type="text" placeholder="بحث في الملاحظات أو الفئات..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", color: "white", padding: "10px 40px 10px 10px" }}
            />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", color: "white", padding: "10px" }}>
            <option value="all">جميع الفئات</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: "5px", flex: 2 }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", color: "white", padding: "10px" }} />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", color: "white", padding: "10px" }} />
        </div>
        <button onClick={() => { setSearchTerm(""); setFilterCategory("all"); setStartDate(""); setEndDate(""); }} style={{ background: "#1e293b", border: "none", color: "#94a3b8", padding: "10px 15px", borderRadius: "10px", cursor: "pointer" }}>
            <RefreshCcw size={18} />
        </button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>جاري تحميل البيانات...</div>
        ) : filteredExpenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b", border: "2px dashed #2d364f", borderRadius: "15px" }}>لا توجد مصروفات مسجلة تطابق بحثك</div>
        ) : (
            filteredExpenses.map(exp => (
                <div key={exp.id} style={{ background: "rgba(22, 27, 44, 0.4)", border: "1px solid #2d364f", borderRadius: "12px", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "0.3s" }}>
                    <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                        <div style={{ background: "#ef444415", padding: "10px", borderRadius: "10px" }}><Receipt color="#ef4444" size={20} /></div>
                        <div>
                            <div style={{ fontWeight: "700", fontSize: "16px" }}>{fmt(exp.amount)} <span style={{ fontSize: "11px", color: "#64748b", marginRight: "10px", background: "#0f172a", padding: "2px 8px", borderRadius: "5px" }}>{exp.category_name}</span></div>
                            <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "3px" }}>{exp.note || "لا توجد ملاحظات"}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "#475569" }}>{fmtDate(exp.expense_date)}</span>
                        <button 
                            onClick={() => { setSelectedExpense(exp); setModalType("deleteConfirm"); }} 
                            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}
                            className="hover-red"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* --- MODAL: Confirm Delete Expense --- */}
      {modalType === "deleteConfirm" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#0f172a", width: "380px", borderRadius: "24px", border: "1px solid #1e293b", padding: "25px", textAlign: "center", animation: "scaleUp 0.2s ease-out" }}>
            <div style={{ background: "#ef444420", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px" }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>
            <h3 style={{ margin: "0 0 10px 0" }}>تأكيد الحذف</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>هل أنت متأكد من حذف هذا المصروف بقيمة <br/> <b style={{color: "white"}}>{fmt(selectedExpense?.amount)}</b>؟</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
              <button onClick={confirmDeleteExpense} style={{ flex: 1, background: "#ef4444", color: "white", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>حذف نهائي</button>
              <button onClick={() => setModalType(null)} style={{ flex: 1, background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", padding: "12px", borderRadius: "12px", cursor: "pointer" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Add Expense --- */}
      {modalType === "addExpense" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", width: "450px", borderRadius: "20px", border: "1px solid #1e293b", padding: "25px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px" }}>
              <h3 style={{ margin: 0 }}>تسجيل مصروف جديد</h3>
              <X style={{ cursor: "pointer", color: "#475569" }} onClick={() => setModalType(null)} />
            </div>
            <form onSubmit={handleAddExpense} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input type="number" placeholder="المبلغ" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} style={{ background: "#1e293b", border: "1px solid #334155", padding: "12px", borderRadius: "10px", color: "white" }} />
              <select required value={expenseForm.category_id} onChange={e => setExpenseForm({...expenseForm, category_id: e.target.value})} style={{ background: "#1e293b", border: "1px solid #334155", padding: "12px", borderRadius: "10px", color: "white" }}>
                <option value="">اختر الفئة...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} style={{ background: "#1e293b", border: "1px solid #334155", padding: "12px", borderRadius: "10px", color: "white" }} />
              <textarea placeholder="ملاحظات" value={expenseForm.note} onChange={e => setExpenseForm({...expenseForm, note: e.target.value})} style={{ background: "#1e293b", border: "1px solid #334155", padding: "12px", borderRadius: "10px", color: "white", height: "80px" }} />
              <button type="submit" className="btn-save" style={{ background: "#ef4444", border: "none", color: "white", padding: "15px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>حفظ العملية</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Manage Categories --- */}
      {modalType === "addCategory" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", width: "400px", borderRadius: "20px", border: "1px solid #1e293b", padding: "25px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ margin: 0 }}>إدارة فئات المصروفات</h3>
              <X style={{ cursor: "pointer" }} onClick={() => setModalType(null)} />
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <input type="text" placeholder="اسم الفئة الجديدة..." value={catName} onChange={e => setCatName(e.target.value)} style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", padding: "12px", borderRadius: "10px", color: "white" }} />
              <button onClick={handleAddCategory} className="btn-save" style={{ background: "#60a5fa", border: "none", padding: "12px 20px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", color: "white" }}>إضافة</button>
            </div>
            <div style={{ maxHeight: "250px", overflowY: "auto", borderTop: "1px solid #1e293b", paddingTop: "15px" }}>
              {categories.map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(30, 41, 59, 0.5)", padding: "10px 15px", borderRadius: "10px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{c.name}</span>
                    <button onClick={() => openDeleteCategoryModal(c)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }} className="hover-red">
                        <Trash2 size={16} />
                    </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Confirm Delete Category --- */}
      {modalType === "deleteCategoryConfirm" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
          <div style={{ background: "#0f172a", width: "360px", borderRadius: "24px", border: "1px solid #1e293b", padding: "25px", textAlign: "center" }}>
            <div style={{ background: "#ef444420", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px" }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>
            <h3 style={{ margin: "0 0 10px 0" }}>حذف الفئة</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>هل أنت متأكد من حذف فئة <br/> <b style={{color: "white"}}>"{selectedCategory?.name}"</b>؟</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
              <button onClick={confirmDeleteCategory} style={{ flex: 1, background: "#ef4444", color: "white", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>تأكيد الحذف</button>
              <button onClick={() => setModalType("addCategory")} style={{ flex: 1, background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", padding: "12px", borderRadius: "12px", cursor: "pointer" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .hover-red:hover { color: #ef4444 !important; }
        .btn-save { transition: 0.3s; }
        .btn-save:hover { opacity: 0.8; transform: translateY(-2px); }
      `}</style>

    </div>
  );
};

export default ExpensesPage;